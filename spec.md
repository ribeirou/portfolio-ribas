# Spec — Portfólio 3D (Ribas)

## Objetivo
Portfólio como caminhada por um corredor 3D: você rola a página e caminha pelo corredor; cada porta é uma seção. Clique 1 aproxima, clique 2 abre a porta (maçaneta gira, luz quente invade o corredor, a câmera entra) e revela o conteúdo. Fechar traz a porta de volta e libera a caminhada.

## Usuário-alvo
Recrutador/dev. A navegação continua sendo scroll comum (nada de controle de jogo), com atalho pela rail lateral pra quem tem pressa e link permanente pra versão simples.

## Escopo (entregue)
- [x] Corredor 3D completo: piso de tábuas, paredes de reboco, teto, rodapés, luminárias, névoa volumétrica
- [x] 5 portas com geometria real — montantes, travessas, almofadas rebaixadas, dobradiças e maçaneta de alavanca em latão
- [x] Batente/moldura em cada vão + placa iluminada com o nome da seção + arandela
- [x] Fio de luz quente vazando por baixo de cada porta
- [x] Materiais PBR reais (Poly Haven, CC0): madeira de porta, reboco, tábuas de piso — diffuse + normal + roughness
- [x] Iluminação: HDRI de ambiente, luminárias de teto, spot com sombra suave seguindo a porta ativa, luz de preenchimento
- [x] Pós-processamento: bloom, tone mapping ACES, vinheta, grão de filme e aberração cromática sutil
- [x] Poeira suspensa reagindo à luz
- [x] Câmera cinematográfica: caminhada guiada pelo scroll, giro suave em direção à porta, magnetismo que encaixa o enquadramento, inércia, sway respiratório e parallax de cursor
- [x] Scroll suave (Lenis) sincronizado ao ticker do GSAP
- [x] Sequência de abertura: maçaneta gira → porta abre → luz invade → câmera entra → painel aparece com stagger
- [x] Design 2D: tipografia Space Grotesk/Inter/JetBrains Mono, loader com barra de progresso, hero, rail de seções, painéis de conteúdo redesenhados
- [x] Enquadramento adaptativo: FOV e distância de zoom se ajustam em telas retrato pra porta nunca cortar
- [x] Acessibilidade/robustez: `prefers-reduced-motion` (sem tweens, sem poeira, sem parallax), fallback automático pra `index-classic.html` sem WebGL
- [x] `?motion=full` / `?motion=reduce` força o modo de movimento (útil em ambientes que reportam reduced-motion por padrão)

## Fora de escopo
- Áudio
- Salas 3D navegáveis atrás de cada porta (o conteúdo é painel 2D sobre a cena)
- Testes automatizados

## Critério de pronto
Rolar caminha pelo corredor e as portas aparecem uma a uma; a câmera encaixa na porta ativa; 2 cliques abrem com animação completa e mostram o conteúdo real de cada seção (incluindo os iframes ao vivo em Projetos); Esc/fechar retorna. Roda a 60fps+ em desktop, enquadra corretamente em mobile retrato, e degrada com elegância sem WebGL ou com reduced-motion.
