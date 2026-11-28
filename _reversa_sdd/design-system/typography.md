# Tipografia — obra-real

> 🟢 Extraído de `public/css/app.css:2-7` e do uso em `app.css`/`style.css`. 🟡 Hierarquia inferida dos tamanhos; 🔴 valores sem token declarado.

## Famílias 🟢

| Token | Stack | Fonte carregada |
|---|---|---|
| `--font-main` | `'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif` | Google Fonts (`opsz,wght@9..40,300..800`) |
| `--font-serif` | `'DM Serif Display', Georgia, serif` | Google Fonts (ital 0/1) |
| `--font-mono` | `'JetBrains Mono', 'Cascadia Code', 'Segoe UI Mono', Consolas, 'SF Mono', Menlo, Monaco, monospace` | Google Fonts (`wght@400;500;600;700`) |
| — | `'Material Symbols Outlined'` | Google Fonts (`opsz 20..48`, `wght 100..700`, `FILL 0..1`, `GRAD -50..200`) — ícones |

> 🟢 `style.css:1` importa apenas Material Symbols; `app.css:2` importa DM Sans + DM Serif Display + JetBrains Mono.

## Escala de tamanhos 🟡

Valores literais encontrados (sem tokens): `8`, `9`, `10`, `10.5`, `11`, `11.5`, `12`, `12.5`, `13`, `14`, `15`, `16`, `17`, `18`, `20`, `22`, `24`, `26`, `28`, `32` px e `1.1rem`, `1.25rem`, `1.5rem`, `1.75rem`. 🔴 Não há escala nomeada (`--text-sm`, `--text-lg`, …).

| Uso provável | Tamanho | Confiança |
|---|---|---|
| corpo / tabelas | `13px`–`14px` | 🟡 |
| títulos de card | `16px`–`18px` | 🟡 |
| títulos de seção | `20px`–`24px` (`1.25rem`–`1.5rem`) | 🟡 |
| destaque / KPI | `26px`–`32px` (`1.75rem`) | 🟡 |
| caption / auxiliar | `10px`–`12px` | 🟡 |

## Pesos 🟢

`400` (normal), `500`, `600`, `700`, `800` (`brand-text` em `style.css:69`). `normal` aparece como reset.

## Line-height 🟡

`1`, `1.15`, `1.2`, `1.25`, `1.3`, `1.35`, `1.4`, `1.45`, `1.5`, `1.6` (global em `style.css:23`), `18px` (fixo em contexto de nav). 🔴 Sem token de line-height.

## Letter-spacing 🟡

`-1.5px` na marca (`style.css:71`); demais valores não normalizados. 🔴 Sem token.

## Hierarquia recomendada (🟡 inferida, não prescritiva no legado)

| Nível | Família | Tamanho | Peso |
|---|---|---|---|
| H1 | `--font-serif` | `1.75rem`–`32px` | 400 |
| H2 | `--font-main` | `1.5rem`–`24px` | 700 |
| H3 | `--font-main` | `1.25rem`–`20px` | 600 |
| Corpo | `--font-main` | `14px` | 400 |
| Label | `--font-main` | `12px`–`13px` | 500 |
| Código | `--font-mono` | `12px`–`13px` | 400 |
| Caption | `--font-main` | `10px`–`11px` | 400 |

## Lacunas 🔴

- 🔴 Nenhuma escala tipográfica tokenizada; 24 tamanhos literais diferentes.
- 🔴 `DM Serif Display` declarada mas uso real não confirmado em componentes (apenas import).
- 🟡 `Arial` e `system-ui` aparecem em stacks locais de fallback fora do `:root` — inconsistência com `--font-main`.
