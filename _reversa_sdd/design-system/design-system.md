# Design System — obra-real (documentado)

> 🟢 CONFIRMADO em `public/css/app.css` e `public/css/style.css`. 🟡 INFERIDO do uso. 🔴 Lacunas.
> Este é o documento consolidado; detalhes em [`color-palette.md`](color-palette.md), [`typography.md`](typography.md), [`spacing.md`](spacing.md) e [`tokens.md`](tokens.md).

## Visão geral 🟢

| Aspecto | Estado |
|---|---|
| Arquivos de estilo | `public/css/app.css` (1475 linhas), `public/css/style.css` (600 linhas) |
| Variáveis CSS | 31 únicas (27 no app + 4 na landing) |
| Temas | escuro padrão, claro (`body.light-mode`), `indigo`, `amber`, `emerald`, `data-schema="1"` |
| Fontes | DM Sans, DM Serif Display, JetBrains Mono, Material Symbols Outlined |
| Componentes | 258 classes CSS, sem biblioteca própria documentada |
| Storybook / tokens.json | 🔴 ausentes |

## Identidade visual 🟢

- Tema "dark premium" com fundo `#0D0D0D`, card `#141414`, texto `#FFFFFF`.
- Accent padrão laranja `#FF6B35`; alternativas índigo `#4A9EFF`, âmbar `#FFB347`, esmeralda `#10b981`.
- Landing page usa esquema separado, com accent índigo `#6366f1` por padrão.
- hierarchy tipográfica mista: serif para destaque, sans para interface, mono para código.

## Regras de uso observadas 🟡

- Sidebar e nav consomem `--sb-*`; cards consomem `--card`/`--card2`; estados usam `--green`/`--red`/`--orange`/`--blue`.
- Badges têm 7 variantes (`blue`, `gray`, `green`, `orange`, `purple`, `red`, `yellow`).
- Toasts e modais usam as maiores elevações (`0 24px 60px rgba(0,0,0,.5)`).
- Nav é sticky com `z-index: 1000` e reduz altura de 64px para 60px no scroll.

## Fluxo de tema 🟡

1. 🟢 `:root` define tema escuro + accent laranja.
2. 🟢 `data-theme`/`data-schema` sobrescrevem `--accent`, `--accent-hover` e `--sb-active-bg`.
3. 🟢 `body.light-mode` troca fundos, bordas e textos.
4. 🟡 O seletor de tema (`theme-switcher`, `color-btn`) persiste a escolha — implementação em JS não auditada aqui.
5. 🔴 Landing (`--lp-*`) e app (`--*`) não compartilham variáveis.

## Lacunas e débito técnico 🔴

| ID | Lacuna | Impacto |
|---|---|---|
| 🔴 DS-01 | 24 tamanhos de fonte literais, sem escala tokenizada | inconsistência tipográfica |
| 🔴 DS-02 | 7 breakpoints sem convenção única | responsividade fragilizada |
| 🔴 DS-03 | Dois sistemas de tema paralelos (`--accent` × `--lp-accent`) | troca de tema não propaga entre app e landing |
| 🔴 DS-04 | `--text3` definido só em `light-mode` | risco de texto sem cor no tema escuro |
| 🔴 DS-05 | Sem spacing/radius/shadow/z-index tokens | difícil migração para design system formal |
| 🟡 DS-06 | Screenshots não analisados (Visor sem suporte a imagem neste modelo) | estados visuais não validados |

## Recomendações 🟡

- [ ] Unificar `--lp-accent` e `--accent` em uma única fonte de verdade (mesma decisão do GAP-07).
- [ ] Criar `--text3` no `:root` escuro.
- [ ] Normalizar breakpoints para `sm 480`, `md 768`, `lg 1024`, `xl 1400`.
- [ ] Extrair escala de spacing `4/8/12/16/20/24/40` e radius `4/8/12/20/999`.
- [ ] Rodar o Visor em modelo com suporte a imagem para validar estados das telas em `public/img/`.

## Escopo deste agente 🟢

Artefatos criados em `_reversa_sdd/design-system/`. Nenhum arquivo de `public/` foi modificado (diretiva non-destructive do Reversa).
