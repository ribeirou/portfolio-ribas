# Plan — Portfólio 3D (Ribas)

## Stack
- Three.js 0.160 (ES modules + importmap via CDN), GSAP 3.12, Lenis 1.1 — sem bundler, sem build.
- `index.html` (casca + spacers de scroll) · `scene.js` (mundo 3D, câmera, interação) · `sections.js` (conteúdo editável) · `styles.css` (design 2D).
- Assets locais: `assets/textures/{door,wall,floor}_{diffuse,normal,roughness}.jpg` e `assets/hdri/studio_small_08_1k.hdr` — todos Poly Haven, CC0.
- `index-classic.html` + `*-classic.*`: versão 2D preservada como fallback.

## Decisões técnicas
| Decisão | Alternativa | Por quê |
|---|---|---|
| Corredor com portas na parede lateral | Porta flutuando no vazio | O pedido era "ir andando e passar por portas" — corredor dá contexto, escala e ambientação; porta solta no preto parecia amadora |
| Porta construída com geometria (montantes/travessas/almofadas/dobradiças/alavanca) | Slab plana com foto de porta | Em 3D a silhueta e as sombras entregam a leitura; textura sozinha achata |
| Scroll → posição da câmera (mapeamento linear) + magnetismo perto da porta | ScrollTrigger com pin/scroll-jacking | Mantém o scroll nativo do usuário; o magnetismo resolve o enquadramento sem sequestrar o controle |
| `lookAt` interpolado entre "fundo do corredor" e "porta ativa" | Câmera sempre reta | É o que faz a cabeça "virar" naturalmente ao passar pela porta |
| UV escalado por peça (`scaleUV`) com material compartilhado | Uma textura clonada por segmento | `texture.clone()` não herda a imagem carregada depois; escalar UV mantém 1 material e tiling correto |
| Uma única luz com sombra (spot que segue a porta ativa) | Sombra em todas as luzes | Sombra de point light é cubemap — caro; o spot dá o drama onde importa |
| Bloom + ACES + vinheta/grão em ShaderPass próprio, `OutputPass` antes | Só bloom | Grão e vinheta precisam vir depois do tone mapping; é o que dá o acabamento cinematográfico |
| Poeira como `THREE.Points` aditivo | Sprites/instâncias | 420 pontos custam quase nada e vendem a atmosfera |
| FOV adaptativo por aspect ratio | FOV fixo | Em retrato o campo horizontal encolhe e cortava a porta |
| `?motion=full` como override | Só `prefers-reduced-motion` | O preview de teste reporta reduced-motion, o que escondia todas as animações e impedia validação |

## Trade-offs assumidos
- Conteúdo é painel 2D sobre a cena (com o topo translúcido pra sentir a luz do cômodo), não sala 3D navegável.
- Uma única luz projeta sombra; o resto é iluminação direta + HDRI.
- Sem áudio.
- Página romântica segue sem link público (card mostra "em breve").
