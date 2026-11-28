# Tokens consolidados — obra-real

> 🟢 = definido em CSS (`:root`, temas ou `light-mode`). 🟡 = inferido do uso. 🔴 = referenciado mas não definido.

## Variáveis CSS customizadas 🟢

| Token | Padrão | `indigo` | `amber` | `emerald` | `light-mode` |
|---|---|---|---|---|---|
| `--font-main` | `'DM Sans', -apple-system, …` | — | — | — | — |
| `--font-serif` | `'DM Serif Display', Georgia, serif` | — | — | — | — |
| `--font-mono` | `'JetBrains Mono', …` | — | — | — | — |
| `--bg` | `#0D0D0D` | — | — | — | `#F5F5F5` |
| `--bg2` | `#111111` | — | — | — | `#FFFFFF` |
| `--bg3` | `#161616` | — | — | — | `#EBEBEB` |
| `--card` | `#141414` | — | — | — | `#FFFFFF` |
| `--card2` | `#1A1A1A` | — | — | — | `#F0F0F0` |
| `--border` | `#222222` | — | — | — | `#DDDDDD` |
| `--border2` | `#2A2A2A` | — | — | — | `#CCCCCC` |
| `--text` | `#FFFFFF` | — | — | — | `#1A1A1A` |
| `--text2` | `#E5E5E5` | — | — | — | `#444444` |
| `--text3` | 🔴 indefinido | — | — | — | `#777777` |
| `--muted` | `#6B6B6B` | — | — | — | `#888888` |
| `--muted2` | `#444444` | — | — | — | `#AAAAAA` |
| `--accent` | `#FF6B35` | `#4A9EFF` | `#FFB347` | `#10b981` | (herda) |
| `--accent2` | `#E55A25` | — | — | — | — |
| `--accent-text` | `#ffffff` | — | — | — | — |
| `--accent-hover` | `#E55A25` | `#3B82F6` | `#F59E0B` | `#059669` | — |
| `--gold` | `#F5A623` | — | — | — | — |
| `--blue` | `#4A9EFF` | — | — | — | — |
| `--green` | `#10b981` | — | — | — | — |
| `--red` | `#FF4D4D` | — | — | — | — |
| `--orange` | `#FFB347` | — | — | — | — |
| `--sb-bg` | `#0D0D0D` | — | — | — | `#F5F5F5` |
| `--sb-text` | `#6B6B6B` | — | — | — | `#444444` |
| `--sb-active-bg` | `rgba(255,107,53,0.1)` | `rgba(74,158,255,0.1)` | `rgba(255,179,71,0.1)` | `rgba(16,185,129,0.1)` | `rgba(255,107,53,0.1)` |

### Landing page (`style.css`) 🟢

| Token | Padrão | `amber` | `emerald` |
|---|---|---|---|
| `--lp-bg` | `#09090b` | — | — |
| `--lp-text` | `#fafafa` | — | — |
| `--lp-accent` | `#6366f1` | `#f59e0b` | `#10b981` |
| `--lp-zinc` | `#27272a` | — | — |

## Contagem 🟢

- `app.css`: 27 nomes de variáveis únicos; 1 `:root` base, 4 blocos `data-theme`/`data-schema`, 1 bloco `light-mode`.
- `style.css`: 4 variáveis; 2 blocos `data-theme`.
- Total de variáveis únicas nos dois arquivos: **31**.

## Valores literais não tokenizados 🔴

| Categoria | Quantidade aproximada | Exemplos |
|---|---|---|
| Tamanhos de fonte | 24 valores | `8px`, `11.5px`, `1.75rem` |
| Gaps | 15 valores + 2 compostos | `6px`, `28px`, `10px 20px` |
| Paddings | 20+ valores | `6px 14px`, `16px 20px` |
| Border-radius | 13 valores | `9px`, `999px`, `14px 14px 0 0` |
| Breakpoints | 7 valores | `480`, `520`, `768`, `769`, `1024`, `1100`, `1400` |
| Z-index | 8 valores | `50`, `999`, `1000`, `9999` |
| Durações de transição | 4 valores | `0.1s`, `0.15s`, `0.2s`, `0.3s` |

## Componentes 🟡

258 classes em `app.css`; famílias identificadas:

- **Ação:** `btn`, `btn-primary`, `btn-secondary`, `btn-danger`, `btn-sm`, `link-btn`, `view-btn`, `theme-btn`, `sync-retry-btn`, `header-*`
- **Superfície:** `card`, `kpi-card`, `obra-card`, `fin-card`, `audit-card`, `kanban-card`, `photo-card`, `md-photo-card`, `tf-photo-card`, `alert-card`
- **Formulário:** `form-control`, `form-group`, `form-grid`, `form-label`, `form-hint`, `search-input`, `med-form*`
- **Feedback:** `badge` (7 variantes de cor), `alert-*`, `toast`, `toast-container`, `toast-undo`
- **Estrutura:** `sidebar`, `nav-item`, `nav-section`, `modal*`, `table-wrap`, `table-responsive`, `table-toolbar`, `audit-table`

> 🔴 Não há biblioteca de componentes documentada, Storybook nem arquivo de tokens (`tokens.json`); variantes são apenas classes CSS.

## Lacunas 🔴

- 🔴 Dois sistemas de tema paralelos (`--accent` × `--lp-accent`) com valores padrão diferentes.
- 🔴 `--text3` sem definição no tema escuro.
- 🔴 Nenhum spacing/radius/shadow/z-index tokenizado.
- 🟡 Screenshots não analisados nesta passada (Visor bloqueado por falta de suporte a imagem no modelo).
