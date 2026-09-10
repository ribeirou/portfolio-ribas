// Tema (dark padrão, alterna e persiste em localStorage)
(function setupTheme() {
  const root = document.documentElement;
  const toggle = document.getElementById("theme-toggle");
  const saved = localStorage.getItem("theme");
  if (saved) root.setAttribute("data-theme", saved);

  toggle.addEventListener("click", () => {
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    toggle.querySelector("span").textContent = next === "dark" ? "🌙" : "☀️";
  });

  toggle.querySelector("span").textContent =
    root.getAttribute("data-theme") === "dark" ? "🌙" : "☀️";
})();

// Renderiza os cards de projeto a partir de projects.js
(function renderProjects() {
  const grid = document.getElementById("projects-grid");
  if (!grid || typeof PROJECTS === "undefined") return;

  grid.innerHTML = PROJECTS.map((p) => `
    <article class="project-card reveal">
      <h3>${p.title}</h3>
      <p>${p.description}</p>
      <ul class="stack-list">
        ${p.stack.map((s) => `<li>${s}</li>`).join("")}
      </ul>
      <div class="project-links">
        ${p.demoUrl ? `<a href="${p.demoUrl}" target="_blank" rel="noopener noreferrer">Ver demo</a>` : ""}
        ${p.repoUrl ? `<a href="${p.repoUrl}" target="_blank" rel="noopener noreferrer">Código</a>` : ""}
        ${!p.demoUrl && !p.repoUrl ? `<span class="muted">Em breve</span>` : ""}
      </div>
    </article>
  `).join("");

  observeReveals();
})();

// Animação de entrada ao rolar (respeita prefers-reduced-motion)
function observeReveals() {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const targets = document.querySelectorAll(".reveal:not(.is-visible)");

  if (reduceMotion || !("IntersectionObserver" in window)) {
    targets.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  targets.forEach((el) => observer.observe(el));
}

observeReveals();
