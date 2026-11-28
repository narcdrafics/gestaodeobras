# Paleta de cores — obra-real

> 🟢 Extraído de `public/css/app.css:4-77` e `public/css/style.css:3-17`. 🟡 Uso inferido de classes. 🔴 Tokens referenciados sem definição local.
> Fontes: `app.css` (app, tema escuro/claro) e `style.css` (landing page).

## Tema padrão (dark premium) 🟢

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#0D0D0D` | fundo da aplicação |
| `--bg2` | `#111111` | fundo secundário |
| `--bg3` | `#161616` | fundo terciário |
| `--card` | `#141414` | superfície de cards |
| `--card2` | `#1A1A1A` | superfície elevada |
| `--border` | `#222222` | borda padrão |
| `--border2` | `#2A2A2A` | borda forte |
| `--text` | `#FFFFFF` | texto primário |
| `--text2` | `#E5E5E5` | texto secundário |
| `--muted` | `#6B6B6B` | texto auxiliar / ícone inativo |
| `--muted2` | `#444444` | texto desabilitado |
| `--accent` | `#FF6B35` | laranja — ação primária |
| `--accent2` / `--accent-hover` | `#E55A25` | hover do accent |
| `--accent-text` | `#ffffff` | texto sobre accent |
| `--gold` | `#F5A623` | destaque financeiro |
| `--blue` | `#4A9EFF` | informação |
| `--green` | `#10b981` | sucesso |
| `--red` | `#FF4D4D` | erro / atraso |
| `--orange` | `#FFB347` | alerta |
| `--sb-bg` | `#0D0D0D` | sidebar |
| `--sb-text` | `#6B6B6B` | sidebar inativo |
| `--sb-active-bg` | `rgba(255,107,53,0.1)` | sidebar ativo |

## Tema claro 🟢 (`body.light-mode`)

`--bg #F5F5F5` · `--bg2 #FFFFFF` · `--bg3 #EBEBEB` · `--card #FFFFFF` · `--card2 #F0F0F0` · `--border #DDDDDD` · `--border2 #CCCCCC` · `--text #1A1A1A` · `--text2 #444444` · `--text3 #777777` · `--muted #888888` · `--muted2 #AAAAAA` · `--sb-bg #F5F5F5` · `--sb-text #444444`.

> 🔴 `--text3` não é definido no `:root` escuro — só existe em `light-mode`; uso fora do modo claro cai em valor herdado/não definido.

## Variantes de accent 🟢 (`data-theme`)

| Tema | `--accent` | `--accent-hover` | `--sb-active-bg` |
|---|---|---|---|
| padrão / `data-schema="1"` | `#FF6B35` | `#E55A25` | `rgba(255,107,53,0.1)` |
| `indigo` | `#4A9EFF` | `#3B82F6` | `rgba(74,158,255,0.1)` |
| `amber` | `#FFB347` | `#F59E0B` | `rgba(255,179,71,0.1)` |
| `emerald` | `#10b981` | `#059669` | `rgba(16,185,129,0.1)` |

## Landing page 🟢 (`style.css`)

| Token | Valor |
|---|---|
| `--lp-bg` | `#09090b` |
| `--lp-text` | `#fafafa` |
| `--lp-accent` | `#6366f1` (padrão `indigo`) |
| `--lp-accent[data-theme="amber"]` | `#f59e0b` |
| `--lp-accent[data-theme="emerald"]` | `#10b981` |
| `--lp-zinc` | `#27272a` |

> 🔴 Dois sistemas de tema coexistem com nomes diferentes (`--accent` vs `--lp-accent`) e valores padrão divergentes (laranja vs índigo). Não há ponte declarada entre eles (semelhante ao GAP-07 de config duplicada).

## Cores literais recorrentes 🟡

`#a1a1aa` (links da nav), `#fff`, `rgba(255,255,255,0.1)` e `rgba(255,255,255,0.03)` (bordas/fundos translúcidos na nav). 🟡 Consolidação em tokens não foi feita no legado.
