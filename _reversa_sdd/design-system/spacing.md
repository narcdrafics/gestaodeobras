# Espaçamento, grid e breakpoints — obra-real

> 🟢 Extraído de `public/css/app.css` (1475 linhas) e `public/css/style.css` (600 linhas). 🟡 Escala inferida da frequência de valores literais. 🔴 Tokens de spacing inexistentes.

## Escala de gaps 🟡

Valores mais frequentes em `gap`: `2`, `3`, `4`, `6`, `8`, `10`, `12`, `14`, `15`, `16`, `18`, `20`, `22`, `28`, `46` px (além de combinações `10px 20px`, `10px 22px`). 🔴 Sem `--space-1…n`.

| Nível sugerido | Valor | Uso observado |
|---|---|---|
| xs | `4px`–`6px` | ícones, chips |
| sm | `8px`–`10px` | botões, controles |
| md | `12px`–`16px` | campos, linhas de tabela |
| lg | `20px`–`28px` | cards, blocos |
| xl | `40px`–`46px` | seções |

## Padding 🟡

Valores recorrentes: `0`, `4px`, `6px`, `8px`, `10px`, `12px`, `14px`, `16px`, `20px`, `24px`, `40px`. Padrão de card: `16px 20px` ou `12px 20px`; botão: `6px 14px` / `4px 12px`.

## Largura e container 🟢

| Elemento | Valor | Fonte |
|---|---|---|
| `.container` (landing) | `max-width: 1100px`, `padding: 0 24px` | `style.css:26-30` |
| Nav | `height: 64px`, reduz para `60px` quando `.scrolled` | `style.css:33-53` |

## Breakpoints 🟢

| Breakpoint | Ocorrências |
|---|---|
| `max-width: 480px` | 1 |
| `max-width: 520px` | 1 |
| `max-width: 768px` | 2 (um com espaço, um sem) |
| `min-width: 769px` | 1 |
| `max-width: 1024px` | 1 |
| `max-width: 1100px` | 1 |
| `max-width: 1400px` | 1 |
| `@media print` | 1 |

> 🔴 Sete breakpoints diferentes, sem tokens nem convenção única (`(max-width: 768px)` × `(max-width:768px)`). 🟡 Não há grid declarations (`display: grid` com `grid-template-columns`) consistente — layout é baseado em flex.

## Border-radius 🟢

`0`, `4px`, `6px`, `7px`, `8px`, `9px`, `10px`, `12px`, `14px`, `20px`, `50%`, `999px`, e variantes `12px 12px 0 0` / `14px 14px 0 0` (cards com topo arredondado).

## Sombras 🟢

- `none !important` (reset)
- `0 2px 8px rgba(0,0,0,.35)` — elevação baixa
- `0 24px 60px rgba(0,0,0,.5)` — modal/overlay
- `inset 3px 0 0 var(--red)` / `inset 3px 0 0 var(--orange)` — faixa de status

## Z-index 🟢

`0`, `3`, `20`, `50`, `999`, `1000` (nav sticky em `style.css:38`), `2000`, `9999`. 🔴 Sem escala nomeada.

## Transições 🟢

Durações: `0.1s`, `0.15s`, `0.2s`, `0.3s`. Easing: `ease`, `cubic-bezier(0.16, 1, 0.3, 1)`. Propriedades comuns: `all`, `transform`, `opacity`, `color`, `background`, `border-color`, `width`, `margin-left`, `left`.

## Opacidades 🟡

`0.8` (hover de logo), `0.1` e `0.03` (bordas/fundos translúcidos na nav), `0.5` (sombra), `0.35` (sombra). 🔴 Sem tokens semânticos de opacidade.

## Lacunas 🔴

- 🔴 Nenhum token de spacing, radius, shadow, z-index ou easing declarado — tudo literal.
- 🟡 Dois conjuntos de breakpoints (landing × app) sem reconciliação.
- 🟡 Screenshots disponíveis em `public/img/` não foram analisados nesta passada (modelo sem suporte a imagem — ver status do Visor).
