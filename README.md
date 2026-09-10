# Portfólio 3D — Gabriel Ribeiro Ramos (Ribas)

Portfólio pessoal como uma caminhada por um corredor 3D. Você rola a página e
caminha; cada porta é uma seção. Um clique aproxima, o segundo abre a porta —
a maçaneta gira, a luz quente invade o corredor e a câmera entra — e o conteúdo
da seção aparece.

**Stack:** HTML/CSS/JS puro, Three.js, GSAP e Lenis via CDN. Sem build, sem
bundler, sem dependências instaladas.

## Rodando localmente

Precisa de um servidor HTTP (os módulos ES e as texturas não carregam via
`file://`):

```bash
npx serve .
```

## Estrutura

| Arquivo | O que é |
|---|---|
| `index.html` | Casca da página e espaçadores de scroll |
| `scene.js` | Mundo 3D: corredor, portas, câmera, iluminação, interação |
| `sections.js` | **Conteúdo das seções e projetos — edite aqui** |
| `styles.css` | Design da camada 2D (HUD, hero, painéis) |
| `index-classic.html` | Versão 2D simples, usada como fallback sem WebGL |

Para adicionar ou editar um projeto, mexa apenas em `sections.js`.

## Parâmetros de URL

- `?motion=full` — força a experiência com todas as animações
- `?motion=reduce` — força o modo sem animação
- `?quality=low` — modo leve: sem bloom, sombra, grão nem poeira
- `?quality=high` — força a qualidade máxima

Sem parâmetro, o movimento respeita o `prefers-reduced-motion` do sistema e a
qualidade se ajusta sozinha: começa no mínimo se detectar renderização por
software (aceleração de hardware desligada) e cai de nível se o FPS não
sustentar.

## Créditos

Texturas e HDRI: [Poly Haven](https://polyhaven.com) (CC0).
