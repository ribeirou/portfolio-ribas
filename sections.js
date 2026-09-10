// Uma porta por seção, na ordem que aparecem rolando a página.
// `html` é o conteúdo mostrado no painel quando a porta abre.
// "Projetos" é especial: o conteúdo dela é montado a partir de PROJECT_SCREENS.
export const SECTIONS = [
  {
    id: "sobre",
    label: "Sobre",
    html: `
      <h2>Sobre</h2>
      <p>Comecei em Desenvolvimento de Sistemas na ETEC Dra. Ruth Cardoso, formei
      técnico em 2023. De lá fui pra UFABC cursar Bacharelado em Ciência e
      Tecnologia, com formatura prevista pra dezembro de 2027.</p>
      <p>Hoje sou estagiário de CX no Santander, trabalhando com dados
      (QuickSight, Athena, SQL) no dia a dia. Em paralelo, mantenho projetos
      pessoais de front-end e venho estudando automação com IA — desde
      dashboards até fluxos de publicação com Claude Code.</p>
    `,
  },
  {
    id: "experiencia",
    label: "Experiência",
    html: `
      <h2>Experiência</h2>
      <article class="exp-card">
        <div class="exp-head">
          <h3>Estagiário de CX (Customer Experience)</h3>
          <span class="exp-meta">Santander</span>
        </div>
        <ul>
          <li>Trabalho direto com Amazon QuickSight, Amazon Athena, SQL e Excel pra análise e visualização de dados de experiência do cliente.</li>
          <li>Automatizei a atualização de dashboards, com destaque pro dashboard "Voz do Cliente", reduzindo trabalho manual e retrabalho da equipe.</li>
          <li>Construí queries e rotinas que tiraram etapas manuais repetitivas do processo de reporte.</li>
        </ul>
      </article>
    `,
  },
  { id: "projetos", label: "Projetos", html: null },
  {
    id: "skills",
    label: "Skills",
    html: `
      <h2>Skills</h2>
      <div class="skills-grid">
        <div class="skill-card">
          <h3>Dados &amp; BI</h3>
          <ul><li>Amazon QuickSight</li><li>Amazon Athena</li><li>SQL</li><li>Excel avançado</li></ul>
        </div>
        <div class="skill-card">
          <h3>Front-end</h3>
          <ul><li>HTML / CSS / JavaScript</li><li>GSAP &amp; Lenis</li><li>tsParticles</li><li>PWA</li></ul>
        </div>
        <div class="skill-card">
          <h3>Ferramentas &amp; Automação</h3>
          <ul><li>Git &amp; GitHub</li><li>Claude Code</li><li>Automação de posts (LinkedIn)</li><li>Vercel</li></ul>
        </div>
      </div>
    `,
  },
  {
    id: "contato",
    label: "Contato",
    html: `
      <h2>Contato</h2>
      <p>Bora trocar uma ideia sobre dev, dados ou automação.</p>
      <div class="contact-links">
        <a href="mailto:ribeiroramosgabriel@gmail.com">ribeiroramosgabriel@gmail.com</a>
        <a href="https://www.linkedin.com/in/gabriel-ribeiro-ramos-0bb00b237/" target="_blank" rel="noopener noreferrer">LinkedIn</a>
        <a href="https://github.com/ribeirou" target="_blank" rel="noopener noreferrer">GitHub</a>
      </div>
    `,
  },
];

// Monitores dentro do painel "Projetos" — cada um roda o site real ao vivo
// num iframe normal (2D, dentro do painel — sem 3D envolvido aqui).
export const PROJECT_SCREENS = [
  {
    title: "Contagem Regressiva — Show Luan Santana",
    description:
      "Setlist com links do Spotify, easter egg de constelação, instalável como PWA.",
    stack: ["HTML", "CSS", "JavaScript", "GSAP", "Lenis", "tsParticles", "PWA"],
    url: "https://luan-countdownv2.vercel.app",
  },
  {
    title: "Página Romântica — Fita Cassete / Spotify",
    description: "Identidade visual de fita cassete inspirada no Spotify, presente pessoal.",
    stack: ["HTML", "CSS", "JavaScript"],
    url: null,
  },
];
