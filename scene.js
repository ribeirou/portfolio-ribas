import * as THREE from "three";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { SECTIONS, PROJECT_SCREENS } from "./sections.js";

// `?motion=full` força a experiência completa mesmo em ambientes que
// reportam prefers-reduced-motion (headless, VM, preview); `?motion=reduce`
// força o oposto. Sem parâmetro, respeita a preferência do sistema.
const MOTION_OVERRIDE = new URLSearchParams(location.search).get("motion");
const REDUCED = MOTION_OVERRIDE === "full" ? false
  : MOTION_OVERRIDE === "reduce" ? true
  : window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (!REDUCED) document.documentElement.classList.add("force-motion");

/* ---------------- geometria do mundo ---------------- */
const HALF_W = 3;          // corredor: paredes em x = ±3
const CEIL_Y = 3.2;
const WALL_T = 0.25;
const SPACING = 6;         // distância entre portas
const OPEN_W = 1.3;        // vão da porta (ao longo de z)
const OPEN_H = 2.35;
const DOOR_W = 1.24;
const DOOR_H = 2.3;
const DOOR_T = 0.07;
const START_Z = 5;
const Z_RANGE = 35;
const EYE_Y = 1.5;
const IDLE_X = 0.75;
const doorZ = (i) => -3 - i * SPACING;
const END_Z = START_Z - Z_RANGE;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

/* ---------------- boot ---------------- */
function supportsWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch (e) {
    return false;
  }
}

// Em reduced-motion a intenção é *reduzir* movimento, não eliminar: sem isso
// a porta pulava de fechada pra aberta e o site parecia quebrado. Os gestos
// essenciais continuam, curtos e diretos; o que some é o movimento ambiente
// (parallax, sway, poeira, scroll suave, viagens longas de câmera).
function tween(target, vars) {
  if (!REDUCED) return gsap.to(target, vars);
  const { duration = 0.3, delay = 0, ease, ...rest } = vars;
  return gsap.to(target, {
    ...rest,
    duration: Math.min(duration * 0.4, 0.45),
    delay: Math.min(delay * 0.3, 0.1),
    ease: "power2.out",
  });
}

/* ---------------- helpers ---------------- */
function scaleUV(geo, sx, sy) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy);
  uv.needsUpdate = true;
  return geo;
}

function boxUV(w, h, d, tile = 2.4) {
  return scaleUV(new THREE.BoxGeometry(w, h, d), Math.max(w, d) / tile, h / tile);
}

function plateTexture(text) {
  const W = 768, H = 192;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#2a2119");
  g.addColorStop(0.5, "#191410");
  g.addColorStop(1, "#241c15");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "rgba(255,190,130,0.75)";
  ctx.lineWidth = 5;
  ctx.strokeRect(12, 12, W - 24, H - 24);

  ctx.font = "700 78px 'Space Grotesk', 'Segoe UI', system-ui, sans-serif";
  ctx.fillStyle = "#ffd7ab";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  try { ctx.letterSpacing = "14px"; } catch (e) { /* navegador antigo */ }
  ctx.shadowColor = "rgba(255,170,100,0.8)";
  ctx.shadowBlur = 22;
  ctx.fillText(text.toUpperCase(), W / 2, H / 2 + 4);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function dustTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,235,205,1)");
  g.addColorStop(0.35, "rgba(255,225,190,0.35)");
  g.addColorStop(1, "rgba(255,220,180,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

function buildProjectsHTML() {
  const cards = PROJECT_SCREENS.map((p) => `
    <article class="project-card">
      <div class="project-screen ${p.url ? "" : "placeholder"}">
        ${p.url ? `<iframe src="${p.url}" loading="lazy" title="${p.title}"></iframe>` : "em breve"}
      </div>
      <h3>${p.title}</h3>
      <p>${p.description}</p>
      <ul class="stack-list">${p.stack.map((s) => `<li>${s}</li>`).join("")}</ul>
      <div class="project-links">
        ${p.url ? `<a href="${p.url}" target="_blank" rel="noopener noreferrer">abrir projeto ↗</a>` : ""}
      </div>
    </article>
  `).join("");
  return `<h2>Projetos</h2><div class="projects-grid">${cards}</div>`;
}

/* ---------------- shader cinematográfico (vinheta + grão + aberração) ---------------- */
const CinematicShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uGrain: { value: 0.055 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uGrain;
    varying vec2 vUv;
    float rand(vec2 c) { return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 d = vUv - 0.5;
      float r2 = dot(d, d);
      vec2 off = d * r2 * 0.02;
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - off).b;
      float vig = smoothstep(0.92, 0.18, length(d));
      col *= mix(0.28, 1.0, vig);
      float g = rand(vUv * 900.0 + fract(uTime) * 100.0);
      col += (g - 0.5) * uGrain;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

/* ---------------- cena ---------------- */
function init() {
  const loaderEl = document.getElementById("loader");
  const loaderFill = document.getElementById("loader-fill");

  const manager = new THREE.LoadingManager();
  manager.onProgress = (_u, loaded, total) => {
    loaderFill.style.width = `${Math.round((loaded / total) * 100)}%`;
  };
  manager.onLoad = () => {
    loaderFill.style.width = "100%";
    warmUp();
    setTimeout(() => {
      loaderEl.classList.add("is-done");
      if (REDUCED) return;
      gsap.from("#hero .hero-eyebrow, #hero .hero-title, #hero .hero-sub, #hero .hero-scroll", {
        opacity: 0, y: 28, duration: 1.1, stagger: 0.12, ease: "power3.out", delay: 0.25,
      });
      gsap.from("#hud .logo, #hud .simple-link", {
        opacity: 0, y: -14, duration: 0.9, stagger: 0.1, ease: "power2.out", delay: 0.5,
      });
    }, 350);
  };

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05070a, 0.058);

  const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.05, 120);
  camera.position.set(IDLE_X, EYE_Y, START_Z);

  // Em telas estreitas (retrato) o campo horizontal encolhe e a porta é
  // cortada — aqui o FOV vertical cresce o suficiente pra ela sempre caber.
  const BASE_TAN_V = Math.tan(THREE.MathUtils.degToRad(52) / 2);
  const DOOR_HALF_FIT = 1.15;
  function fitCamera() {
    camera.aspect = innerWidth / innerHeight;
    const sideDist = Math.abs(IDLE_X - (-HALF_W - 0.1));
    const needTanV = DOOR_HALF_FIT / sideDist / camera.aspect;
    const tanV = Math.min(Math.max(BASE_TAN_V, needTanV), Math.tan(THREE.MathUtils.degToRad(80) / 2));
    camera.fov = THREE.MathUtils.radToDeg(Math.atan(tanV) * 2);
    camera.updateProjectionMatrix();
    return tanV;
  }
  let tanV = fitCamera();
  // distância lateral mínima pro zoom não cortar a porta
  const zoomX = () => -HALF_W - 0.1 + Math.max(1.55, 0.78 / (tanV * camera.aspect));

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });

  // Sem aceleração de hardware o Chrome cai no SwiftShader (render por
  // software) e a cena engasga — detectamos isso pra já começar leve.
  let softwareGPU = false;
  try {
    const gl = renderer.getContext();
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
    softwareGPU = /swiftshader|llvmpipe|software|basic render|microsoft basic/i.test(name);
    if (name) console.info(`[portfolio] GPU: ${name}${softwareGPU ? " (software — modo leve)" : ""}`);
  } catch (e) { /* extensão indisponível: seguimos no padrão */ }

  const maxDpr = innerWidth < 800 ? 1.5 : 2;
  renderer.setPixelRatio(Math.min(devicePixelRatio, maxDpr));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.domElement.id = "webgl-canvas";
  document.body.appendChild(renderer.domElement);

  /* --- pós-processamento --- */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.62, 0.72);
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());
  const cinematicPass = new ShaderPass(CinematicShader);
  composer.addPass(cinematicPass);

  /* --- qualidade adaptativa ---
     Nível 2 = completo · 1 = sem bloom/sombra · 0 = mínimo.
     Cai sozinho quando o FPS não sustenta; `?quality=low|high` força. */
  const qualityParam = new URLSearchParams(location.search).get("quality");
  let quality = qualityParam === "low" ? 0 : qualityParam === "high" ? 2 : (softwareGPU ? 0 : 2);

  function applyQuality() {
    bloomPass.enabled = quality >= 2;
    cinematicPass.enabled = quality >= 1;

    const wantShadow = quality >= 2;
    if (renderer.shadowMap.enabled !== wantShadow) {
      renderer.shadowMap.enabled = wantShadow;
      keySpot.castShadow = wantShadow;
      scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
    }
    if (dust) dust.visible = quality >= 2;

    const dprCap = quality >= 2 ? maxDpr : quality === 1 ? 1 : 0.75;
    renderer.setPixelRatio(Math.min(devicePixelRatio, dprCap));
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
  }

  function downgrade() {
    if (quality === 0 || qualityParam) return;
    quality -= 1;
    applyQuality();
    console.info(`[portfolio] FPS baixo — qualidade reduzida para nível ${quality}`);
  }

  /* --- ambiente HDRI --- */
  const pmrem = new THREE.PMREMGenerator(renderer);
  new RGBELoader(manager).load("./assets/hdri/studio_small_08_1k.hdr", (hdr) => {
    scene.environment = pmrem.fromEquirectangular(hdr).texture;
    hdr.dispose();
    pmrem.dispose();
  });

  /* --- texturas --- */
  const tl = new THREE.TextureLoader(manager);
  const load = (url, srgb) => {
    const t = tl.load(url);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };

  const woodMaps = {
    map: load("./assets/textures/door_diffuse.jpg", true),
    normalMap: load("./assets/textures/door_normal.jpg"),
    roughnessMap: load("./assets/textures/door_roughness.jpg"),
  };
  const wallMaps = {
    map: load("./assets/textures/wall_diffuse.jpg", true),
    normalMap: load("./assets/textures/wall_normal.jpg"),
    roughnessMap: load("./assets/textures/wall_roughness.jpg"),
  };
  const floorMaps = {
    map: load("./assets/textures/floor_diffuse.jpg", true),
    normalMap: load("./assets/textures/floor_normal.jpg"),
    roughnessMap: load("./assets/textures/floor_roughness.jpg"),
  };

  const wallMat = new THREE.MeshStandardMaterial({
    ...wallMaps, color: 0x3c3f40, roughness: 0.97, metalness: 0, envMapIntensity: 0.18,
  });
  const floorMat = new THREE.MeshStandardMaterial({
    ...floorMaps, color: 0x4a3d31, roughness: 0.42, metalness: 0.12, envMapIntensity: 0.45,
  });
  const ceilMat = new THREE.MeshStandardMaterial({ color: 0x0a0c0d, roughness: 1, metalness: 0 });
  const doorMat = new THREE.MeshStandardMaterial({
    ...woodMaps, color: 0x9d7d5c, roughness: 0.8, metalness: 0, envMapIntensity: 0.35,
  });
  const frameMat = new THREE.MeshStandardMaterial({
    ...woodMaps, color: 0x5f4a35, roughness: 0.75, metalness: 0, envMapIntensity: 0.3,
  });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xe4b775, metalness: 1, roughness: 0.26, envMapIntensity: 1.2 });

  /* --- piso / teto / paredes --- */
  const CORR_START = 8;
  const CORR_END = END_Z - 6;
  const CORR_LEN = CORR_START - CORR_END;
  const CORR_MID = (CORR_START + CORR_END) / 2;

  const floor = new THREE.Mesh(
    scaleUV(new THREE.BoxGeometry(HALF_W * 2, 0.3, CORR_LEN), HALF_W * 2 / 2.2, CORR_LEN / 2.2),
    floorMat
  );
  floor.position.set(0, -0.15, CORR_MID);
  floor.receiveShadow = true;
  scene.add(floor);

  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(HALF_W * 2, 0.3, CORR_LEN), ceilMat);
  ceiling.position.set(0, CEIL_Y + 0.15, CORR_MID);
  scene.add(ceiling);

  const rightWall = new THREE.Mesh(
    scaleUV(new THREE.BoxGeometry(WALL_T, CEIL_Y, CORR_LEN), CORR_LEN / 2.4, CEIL_Y / 2.4),
    wallMat
  );
  rightWall.position.set(HALF_W + WALL_T / 2, CEIL_Y / 2, CORR_MID);
  rightWall.receiveShadow = true;
  scene.add(rightWall);

  // parede esquerda em pedaços, deixando um vão por porta
  function leftWallSegment(zA, zB) {
    const len = Math.abs(zA - zB);
    if (len < 0.02) return;
    const m = new THREE.Mesh(scaleUV(new THREE.BoxGeometry(WALL_T, CEIL_Y, len), len / 2.4, CEIL_Y / 2.4), wallMat);
    m.position.set(-HALF_W - WALL_T / 2, CEIL_Y / 2, (zA + zB) / 2);
    m.receiveShadow = true;
    scene.add(m);
  }
  let cursor = CORR_START;
  SECTIONS.forEach((_s, i) => {
    const z = doorZ(i);
    leftWallSegment(cursor, z + OPEN_W / 2);
    // verga acima do vão
    const header = new THREE.Mesh(
      scaleUV(new THREE.BoxGeometry(WALL_T, CEIL_Y - OPEN_H, OPEN_W), OPEN_W / 2.4, (CEIL_Y - OPEN_H) / 2.4),
      wallMat
    );
    header.position.set(-HALF_W - WALL_T / 2, OPEN_H + (CEIL_Y - OPEN_H) / 2, z);
    scene.add(header);
    cursor = z - OPEN_W / 2;
  });
  leftWallSegment(cursor, CORR_END);

  // rodapé: contínuo à direita, interrompido pelos vãos à esquerda
  const baseR = new THREE.Mesh(
    scaleUV(new THREE.BoxGeometry(0.06, 0.14, CORR_LEN), CORR_LEN / 2, 0.1), frameMat
  );
  baseR.position.set(HALF_W - 0.03, 0.07, CORR_MID);
  scene.add(baseR);

  cursor = CORR_START;
  SECTIONS.forEach((_s, i) => {
    const z = doorZ(i);
    const len = Math.abs(cursor - (z + OPEN_W / 2));
    if (len > 0.05) {
      const b = new THREE.Mesh(scaleUV(new THREE.BoxGeometry(0.06, 0.14, len), len / 2, 0.1), frameMat);
      b.position.set(-HALF_W + 0.03, 0.07, (cursor + z + OPEN_W / 2) / 2);
      scene.add(b);
    }
    cursor = z - OPEN_W / 2;
  });
  {
    const len = Math.abs(cursor - CORR_END);
    const b = new THREE.Mesh(scaleUV(new THREE.BoxGeometry(0.06, 0.14, len), len / 2, 0.1), frameMat);
    b.position.set(-HALF_W + 0.03, 0.07, (cursor + CORR_END) / 2);
    scene.add(b);
  }

  /* --- luminárias de teto ---
     As luminárias (geometria) existem todas; as PointLights são apenas 3 e
     saltam para as três mais próximas. Contagem fixa de luzes evita que o
     three recompile os shaders quando uma luz entra/sai de cena. */
  const lampSpots = [];
  const lampGeo = new THREE.BoxGeometry(0.5, 0.04, 0.5);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffd7a8, toneMapped: false });
  for (let z = 2; z > CORR_END; z -= SPACING) {
    const lamp = new THREE.Mesh(lampGeo, lampMat);
    lamp.position.set(0, CEIL_Y - 0.03, z);
    scene.add(lamp);
    lampSpots.push(z);
  }
  const ceilingLights = [0, 1, 2].map(() => {
    const l = new THREE.PointLight(0xffb173, 5.5, 10, 2);
    l.position.set(0, CEIL_Y - 0.25, 0);
    scene.add(l);
    return l;
  });

  const ambient = new THREE.AmbientLight(0x1e262b, 0.55);
  scene.add(ambient);

  // spot que segue a porta ativa (única luz com sombra, por performance)
  const keySpot = new THREE.SpotLight(0xffe9cf, 130, 14, Math.PI / 5.2, 0.8, 2);
  keySpot.position.set(1.4, 2.95, 0);
  keySpot.castShadow = true;
  keySpot.shadow.mapSize.set(1024, 1024);
  keySpot.shadow.bias = -0.0022;
  keySpot.shadow.radius = 3;
  scene.add(keySpot, keySpot.target);

  // preenchimento suave na porta ativa, pra ela não virar silhueta
  const fillLight = new THREE.PointLight(0xffcda0, 14, 5.5, 2);
  scene.add(fillLight);

  /* --- portas --- */
  function buildDoorLeaf() {
    const g = new THREE.Group();
    const stileW = 0.15;
    const railTop = 0.16, railMid = 0.2, railBot = 0.26;
    const innerW = DOOR_W - stileW * 2;

    const add = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
      return m;
    };

    // montantes (verticais) — porta se estende no -Z local a partir da dobradiça
    add(boxUV(DOOR_T, DOOR_H, stileW, 1.1), doorMat, 0, DOOR_H / 2, -stileW / 2);
    add(boxUV(DOOR_T, DOOR_H, stileW, 1.1), doorMat, 0, DOOR_H / 2, -(DOOR_W - stileW / 2));
    // travessas (horizontais)
    add(boxUV(DOOR_T, railTop, innerW, 1.1), doorMat, 0, DOOR_H - railTop / 2, -DOOR_W / 2);
    add(boxUV(DOOR_T, railMid, innerW, 1.1), doorMat, 0, DOOR_H * 0.44, -DOOR_W / 2);
    add(boxUV(DOOR_T, railBot, innerW, 1.1), doorMat, 0, railBot / 2, -DOOR_W / 2);
    // almofadas rebaixadas
    const upperH = DOOR_H - railTop - DOOR_H * 0.44 - railMid / 2 - 0.02;
    const lowerH = DOOR_H * 0.44 - railMid / 2 - railBot - 0.02;
    add(boxUV(DOOR_T * 0.45, upperH, innerW - 0.02, 0.9), doorMat,
      0, DOOR_H * 0.44 + railMid / 2 + upperH / 2 + 0.01, -DOOR_W / 2);
    add(boxUV(DOOR_T * 0.45, lowerH, innerW - 0.02, 0.9), doorMat,
      0, railBot + lowerH / 2 + 0.01, -DOOR_W / 2);

    // maçaneta de alavanca + espelho (o pivô permite girar a alavanca ao abrir)
    const roseGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.02, 20);
    const leverGeo = new THREE.CapsuleGeometry(0.017, 0.11, 4, 12);
    const levers = [];
    [1, -1].forEach((side) => {
      const rose = new THREE.Mesh(roseGeo, brassMat);
      rose.rotation.z = Math.PI / 2;
      rose.position.set(side * (DOOR_T / 2 + 0.012), 1.02, -(DOOR_W - 0.17));
      g.add(rose);

      const leverPivot = new THREE.Group();
      leverPivot.position.set(side * (DOOR_T / 2 + 0.05), 1.02, -(DOOR_W - 0.17));
      const lever = new THREE.Mesh(leverGeo, brassMat);
      lever.rotation.x = Math.PI / 2;
      lever.position.set(0, 0, 0.06);
      lever.castShadow = true;
      leverPivot.add(lever);
      g.add(leverPivot);
      levers.push(leverPivot);
    });
    g.userData.levers = levers;

    // dobradiças
    const hingeGeo = new THREE.BoxGeometry(DOOR_T + 0.02, 0.13, 0.03);
    [0.35, 1.15, 1.95].forEach((y) => {
      const h = new THREE.Mesh(hingeGeo, brassMat);
      h.position.set(0, y, -0.015);
      g.add(h);
    });

    return g;
  }

  function buildFrame(z) {
    const g = new THREE.Group();
    const t = 0.09, depth = WALL_T + 0.1;
    const side = scaleUV(new THREE.BoxGeometry(depth, OPEN_H + t, t), depth / 1.4, 0.2);
    const top = scaleUV(new THREE.BoxGeometry(depth, t, OPEN_W + t * 2), OPEN_W / 1.4, 0.2);
    const x = -HALF_W - WALL_T / 2 + 0.02;
    const a = new THREE.Mesh(side, frameMat); a.position.set(x, (OPEN_H + t) / 2, z + OPEN_W / 2 + t / 2);
    const b = new THREE.Mesh(side, frameMat); b.position.set(x, (OPEN_H + t) / 2, z - OPEN_W / 2 - t / 2);
    const c = new THREE.Mesh(top, frameMat); c.position.set(x, OPEN_H + t / 2, z);
    [a, b, c].forEach((m) => { m.castShadow = true; m.receiveShadow = true; g.add(m); });
    return g;
  }

  const doors = SECTIONS.map((section, i) => {
    const z = doorZ(i);

    scene.add(buildFrame(z));

    // "cômodo" atrás da porta: fundo quente que vaza luz quando abre
    const backWall = new THREE.Mesh(
      scaleUV(new THREE.PlaneGeometry(3.2, 2.9), 1.2, 1.1),
      new THREE.MeshStandardMaterial({ ...wallMaps, color: 0x8a6a4c, roughness: 0.9, envMapIntensity: 0.3 })
    );
    backWall.rotation.y = Math.PI / 2;
    backWall.position.set(-HALF_W - 2.1, 1.45, z);
    backWall.receiveShadow = true;
    scene.add(backWall);

    const roomLight = new THREE.PointLight(0xffa757, 0, 7.5, 2);
    roomLight.position.set(-HALF_W - 1.2, 1.6, z);
    scene.add(roomLight);

    // placa com o nome da seção
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.82, 0.205),
      new THREE.MeshBasicMaterial({ map: plateTexture(section.label), toneMapped: false })
    );
    plate.rotation.y = Math.PI / 2;
    plate.position.set(-HALF_W + 0.012, OPEN_H + 0.3, z);
    scene.add(plate);

    // arandela discreta iluminando a placa
    const sconce = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.035, 0.22),
      new THREE.MeshBasicMaterial({ color: 0xffd9a8, toneMapped: false })
    );
    sconce.position.set(-HALF_W + 0.05, OPEN_H + 0.62, z);
    scene.add(sconce);

    // fio de luz vazando por baixo da porta
    const leak = new THREE.Mesh(
      new THREE.PlaneGeometry(0.55, OPEN_W - 0.06),
      new THREE.MeshBasicMaterial({
        color: 0xffa14d, transparent: true, opacity: 0.75,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      })
    );
    leak.rotation.x = -Math.PI / 2;
    leak.position.set(-HALF_W + 0.24, 0.012, z);
    scene.add(leak);

    // folha da porta com dobradiça na borda +Z do vão
    const pivot = new THREE.Group();
    pivot.position.set(-HALF_W - WALL_T / 2, 0, z + DOOR_W / 2);
    const leaf = buildDoorLeaf();
    pivot.add(leaf);
    scene.add(pivot);

    return { index: i, z, pivot, roomLight, plate, leak, section, levers: leaf.userData.levers };
  });

  /* --- poeira suspensa --- */
  let dust = null;
  if (!REDUCED) {
    const COUNT = 420;
    const pos = new Float32Array(COUNT * 3);
    const speed = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 5.6;
      pos[i * 3 + 1] = Math.random() * CEIL_Y;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 26;
      speed[i] = 0.02 + Math.random() * 0.05;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    dust = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.028,
      map: dustTexture(),
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      toneMapped: false,
    }));
    dust.userData.speed = speed;
    scene.add(dust);
  }

  /* ---------------- DOM ---------------- */
  const sectionsEl = document.getElementById("sections");
  sectionsEl.innerHTML = Array.from({ length: SECTIONS.length + 2 }, () => `<div class="door-trigger"></div>`).join("");

  const railEl = document.getElementById("rail");
  railEl.innerHTML = SECTIONS.map((s, i) => `<button type="button" data-i="${i}"><i></i><span>${s.label}</span></button>`).join("");
  const railButtons = [...railEl.querySelectorAll("button")];

  const heroEl = document.getElementById("hero");
  const hintEl = document.getElementById("door-hint");
  const hintText = hintEl.querySelector("span");
  const overlay = document.getElementById("content-overlay");
  const contentBody = document.getElementById("content-body");
  const contentKicker = document.getElementById("content-kicker");
  const closeBtn = document.getElementById("close-overlay");

  /* --- scroll suave --- */
  let lenis = null;
  if (!REDUCED && window.Lenis) {
    lenis = new Lenis({ duration: 1.15, easing: (t) => 1 - Math.pow(1 - t, 3), wheelMultiplier: 0.9 });
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  const lockScroll = (on) => {
    if (lenis) on ? lenis.stop() : lenis.start();
    document.body.style.overflow = on ? "hidden" : "";
  };

  railButtons.forEach((btn) => btn.addEventListener("click", () => {
    const i = +btn.dataset.i;
    const p = (START_Z - doorZ(i)) / Z_RANGE;
    const y = p * (document.documentElement.scrollHeight - innerHeight);
    if (lenis) lenis.scrollTo(y, { duration: 1.4 });
    else window.scrollTo({ top: y, behavior: REDUCED ? "auto" : "smooth" });
  }));

  /* ---------------- estado ---------------- */
  let mode = "corridor"; // corridor | zoom | opening | open | closing
  let active = 0;
  let focus = 0;

  const camTarget = { x: IDLE_X, y: EYE_Y, z: START_Z };
  const basePos = new THREE.Vector3(IDLE_X, EYE_Y, START_Z);
  const lookNow = new THREE.Vector3(0, 1.35, START_Z - 7);
  const lookTarget = new THREE.Vector3();
  const corridorLook = new THREE.Vector3();
  const doorLook = new THREE.Vector3();
  const parallax = { x: 0, y: 0 };
  let lookOverride = null;
  const mouse = new THREE.Vector2(-2, -2);

  {
    const px = REDUCED ? null : gsap.quickTo(parallax, "x", { duration: 1.1, ease: "power3" });
    const py = REDUCED ? null : gsap.quickTo(parallax, "y", { duration: 1.1, ease: "power3" });
    addEventListener("pointermove", (e) => {
      mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
      if (px) { px((e.clientX / innerWidth) * 2 - 1); py((e.clientY / innerHeight) * 2 - 1); }
    });
  }

  function scrollP() {
    const max = document.documentElement.scrollHeight - innerHeight;
    return max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
  }

  function setHint(text) {
    if (!text) { hintEl.hidden = true; return; }
    hintEl.hidden = false;
    if (hintText.textContent !== text) hintText.textContent = text;
  }

  /* ---------------- interação ---------------- */
  function enterZoom() {
    mode = "zoom";
    lockScroll(true);
    const d = doors[active];
    tween(camTarget, { x: zoomX(), y: 1.3, z: d.z + 0.15, duration: 1, ease: "power3.inOut" });
    lookOverride = new THREE.Vector3(-HALF_W - 0.1, 1.2, d.z);
    tween(bloomPass, { strength: 0.62, duration: 1 });
    setHint("clique para entrar");
  }

  function exitZoom() {
    mode = "corridor";
    lookOverride = null;
    lockScroll(false);
    tween(bloomPass, { strength: 0.5, duration: 0.8 });
  }

  function openDoor() {
    mode = "opening";
    setHint(null);
    const d = doors[active];
    // maçaneta gira primeiro, depois a folha abre
    d.levers.forEach((l) => {
      gsap.timeline()
        .to(l.rotation, { x: -0.6, duration: REDUCED ? 0.12 : 0.22, ease: "power2.out" })
        .to(l.rotation, { x: 0, duration: REDUCED ? 0.2 : 0.4, ease: "power2.inOut" }, REDUCED ? 0.2 : 0.5);
    });
    tween(d.pivot.rotation, { y: 1.42, duration: 1.25, ease: "power3.inOut", delay: 0.2 });
    tween(d.roomLight, { intensity: 30, duration: 1.3, ease: "power2.out", delay: 0.2 });
    tween(d.leak.material, { opacity: 0, duration: 0.5, delay: 0.2 });
    tween(bloomPass, { strength: 0.95, duration: 1.2, delay: 0.2 });
    lookOverride = new THREE.Vector3(-HALF_W - 2.2, 1.3, d.z);
    tween(camTarget, {
      x: -HALF_W + 0.55, y: 1.32, z: d.z, duration: 1.6, ease: "power3.inOut", delay: 0.35,
      onComplete: () => {
        mode = "open";
        showContent();
        if (closeWhenOpen) { closeWhenOpen = false; closeContent(); }
      },
    });
  }

  function showContent() {
    const s = SECTIONS[active];
    contentKicker.textContent = `${String(active + 1).padStart(2, "0")} — ${s.label}`;
    contentBody.innerHTML = s.id === "projetos" ? buildProjectsHTML() : s.html;
    overlay.hidden = false;
    gsap.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: REDUCED ? 0.25 : 0.6, ease: "power2.out" });
    gsap.fromTo(
      [contentKicker, ...contentBody.children],
      { opacity: 0, y: REDUCED ? 0 : 34 },
      {
        opacity: 1, y: 0,
        duration: REDUCED ? 0.3 : 0.75,
        stagger: REDUCED ? 0.02 : 0.07,
        delay: REDUCED ? 0.05 : 0.1,
        ease: "power3.out",
      }
    );
  }

  let closeWhenOpen = false;

  function closeContent() {
    if (mode === "opening") { closeWhenOpen = true; return; }
    if (mode !== "open") return;
    mode = "closing";
    const d = doors[active];
    const finish = () => { overlay.hidden = true; };
    gsap.to(overlay, { opacity: 0, duration: REDUCED ? 0.2 : 0.45, ease: "power2.in", onComplete: finish });

    tween(d.pivot.rotation, { y: 0, duration: 1.1, ease: "power3.inOut", delay: 0.15 });
    tween(d.roomLight, { intensity: 0, duration: 1, delay: 0.15 });
    tween(d.leak.material, { opacity: 0.55, duration: 0.8, delay: 0.7 });
    tween(bloomPass, { strength: 0.5, duration: 1 });
    lookOverride = new THREE.Vector3(-HALF_W - 0.1, 1.2, d.z);
    tween(camTarget, {
      x: IDLE_X, y: EYE_Y, z: d.z, duration: 1.3, ease: "power3.inOut", delay: 0.2,
      onComplete: () => { mode = "corridor"; lookOverride = null; lockScroll(false); },
    });
  }

  closeBtn.addEventListener("click", closeContent);
  addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (mode === "open") closeContent();
    else if (mode === "zoom") exitZoom();
  });

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  addEventListener("pointerdown", (e) => {
    if (mode !== "corridor" && mode !== "zoom") return;
    pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(doors[active].pivot, true).length > 0;

    if (mode === "corridor" && hit && focus > 0.65) enterZoom();
    else if (mode === "zoom") { if (hit) openDoor(); else exitZoom(); }
  });

  /* ---------------- aquecimento ----------------
     O three compila shader e envia textura pra GPU na primeira vez que cada
     objeto aparece — o que causava um engasgo de ~200ms na primeira caminhada
     pelo corredor. Aqui pagamos esse custo durante a tela de carregamento,
     renderizando uma vez de cada porta. */
  function warmUp() {
    const pos = camera.position.clone();
    const quat = camera.quaternion.clone();
    try {
      renderer.compile(scene, camera);
      doors.forEach((d) => {
        camera.position.set(IDLE_X, EYE_Y, d.z);
        camera.lookAt(-HALF_W - 0.15, 1.15, d.z);
        keySpot.position.set(0.9, 2.95, d.z + 1.5);
        keySpot.target.position.set(-HALF_W - 0.2, 1.2, d.z);
        keySpot.target.updateMatrixWorld();
        keySpot.shadow.needsUpdate = true;
        composer.render();
      });
    } catch (e) {
      console.warn("[portfolio] aquecimento falhou (seguindo normalmente):", e);
    }
    camera.position.copy(pos);
    camera.quaternion.copy(quat);
  }

  /* ---------------- loop ---------------- */
  const clock = new THREE.Clock();
  applyQuality();

  let fpsFrames = 0;
  let fpsWindowStart = performance.now();
  let slowWindows = 0;
  const nearestLamps = [];
  let lastShadowDoor = -1;

  function watchPerformance(now) {
    fpsFrames++;
    if (now - fpsWindowStart < 2000) return;
    const fps = (fpsFrames * 1000) / (now - fpsWindowStart);
    fpsFrames = 0;
    fpsWindowStart = now;
    if (fps < 38) {
      slowWindows++;
      if (slowWindows >= 2) { slowWindows = 0; downgrade(); }
    } else {
      slowWindows = 0;
    }
  }

  function frame() {
    requestAnimationFrame(frame);
    watchPerformance(performance.now());
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.getElapsedTime();

    const p = scrollP();
    const scrollZ = lerp(START_Z, END_Z, p);

    // porta ativa + quanto ela está "à sua frente"
    let best = 0, bestD = Infinity;
    doors.forEach((d) => {
      const dist = Math.abs(scrollZ - d.z);
      if (dist < bestD) { bestD = dist; best = d.index; }
    });
    if (mode === "corridor") {
      active = best;
      // curva suave: 0 longe, 1 quando a porta está praticamente ao lado
      const raw = clamp(1 - (bestD - 0.9) / 2.2, 0, 1);
      focus = raw * raw * (3 - 2 * raw);

      camTarget.x = IDLE_X;
      camTarget.y = EYE_Y;
      // magnetismo: perto da porta a câmera "encaixa" na frente dela
      camTarget.z = lerp(scrollZ, doors[active].z, 0.45 * focus);
    }

    // posição da câmera com inércia + sway + parallax
    basePos.lerp(new THREE.Vector3(camTarget.x, camTarget.y, camTarget.z), REDUCED ? 1 : 1 - Math.pow(0.001, dt));
    camera.position.copy(basePos);
    if (!REDUCED) {
      camera.position.x += parallax.x * 0.12 + Math.sin(t * 0.7) * 0.018;
      camera.position.y += -parallax.y * 0.06 + Math.sin(t * 1.1 + 1.3) * 0.014;
    }

    // alvo do olhar: corredor → porta conforme se aproxima
    const d = doors[active];
    if (lookOverride) {
      lookTarget.copy(lookOverride);
    } else {
      corridorLook.set(0, 1.32, scrollZ - 7);
      doorLook.set(-HALF_W - 0.15, 1.15, d.z);
      lookTarget.lerpVectors(corridorLook, doorLook, focus);
    }
    lookNow.lerp(lookTarget, REDUCED ? 1 : 1 - Math.pow(0.004, dt));
    camera.lookAt(lookNow);

    // spot acompanha a porta ativa
    keySpot.position.set(0.9, 2.95, d.z + 1.5);
    keySpot.target.position.set(-HALF_W - 0.2, 1.2, d.z);
    keySpot.target.updateMatrixWorld();
    fillLight.position.set(-HALF_W + 1.5, 1.7, d.z + 0.9);

    // shadow map só é redesenhado quando a cena realmente muda (troca de
    // porta ou porta em movimento), não a cada frame do corredor
    keySpot.shadow.autoUpdate = false;
    if (active !== lastShadowDoor || mode !== "corridor") {
      keySpot.shadow.needsUpdate = true;
      lastShadowDoor = active;
    }

    // as 3 luzes saltam para as luminárias mais próximas da câmera
    nearestLamps.length = 0;
    for (const z of lampSpots) nearestLamps.push(z);
    nearestLamps.sort((a, b) => Math.abs(a - camera.position.z) - Math.abs(b - camera.position.z));
    ceilingLights.forEach((l, i) => { l.position.z = nearestLamps[i] ?? nearestLamps[0]; });

    // poeira flutuando ao redor da câmera
    if (dust) {
      const arr = dust.geometry.attributes.position.array;
      const sp = dust.userData.speed;
      for (let i = 0; i < sp.length; i++) {
        arr[i * 3 + 1] += sp[i] * dt;
        arr[i * 3] += Math.sin(t * 0.35 + i) * 0.0009;
        if (arr[i * 3 + 1] > CEIL_Y) arr[i * 3 + 1] = 0;
      }
      dust.geometry.attributes.position.needsUpdate = true;
      dust.position.z = camera.position.z;
    }

    // HUD
    heroEl.style.opacity = String(clamp(1 - p / 0.055, 0, 1));
    railEl.classList.toggle("is-visible", p > 0.03 && mode !== "open");
    railButtons.forEach((b, i) => b.classList.toggle("is-active", i === active && focus > 0.4));
    if (mode === "corridor") setHint(focus > 0.65 ? "clique na porta" : null);

    // cursor de "clicável" quando o mouse está sobre a porta ativa
    if ((mode === "corridor" && focus > 0.65) || mode === "zoom") {
      raycaster.setFromCamera(mouse, camera);
      const over = raycaster.intersectObject(d.pivot, true).length > 0;
      renderer.domElement.style.cursor = over ? "pointer" : "";
    } else {
      renderer.domElement.style.cursor = "";
    }

    cinematicPass.uniforms.uTime.value = t;
    composer.render();
  }
  frame();

  addEventListener("resize", () => {
    tanV = fitCamera();
    applyQuality();
    bloomPass.setSize(innerWidth, innerHeight);
  });
}

/* ---------------- boot ---------------- */
if (!supportsWebGL()) {
  document.getElementById("loader").classList.add("is-done");
  document.getElementById("webgl-unsupported").hidden = false;
  setTimeout(() => { location.href = "index-classic.html"; }, 1600);
} else {
  try {
    init();
  } catch (err) {
    console.error("Falha na cena 3D:", err);
    location.href = "index-classic.html";
  }
}
