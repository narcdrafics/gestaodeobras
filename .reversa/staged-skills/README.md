# Skills locais preparados para instalação

> `.reversa/reversa-config.json` está com `allowLegacyEdits: false` e `allowedPaths: []`. Por isso o Reversa não pode escrever em `.agents/skills/`.

## `reversa-tracer/`

Skill local de análise dinâmica (v0.1.0), criado em `.reversa/staged-skills/reversa-tracer/SKILL.md`.

### Instalação manual

1. Edite `.reversa/reversa-config.json` (ato exclusivo do usuário):

```json
{
  "version": 1,
  "allowLegacyEdits": true,
  "allowedPaths": [".agents/skills/**"]
}
```

2. Copie a pasta `reversa-tracer/` para `.agents/skills/reversa-tracer/`.
3. Reinicie a sessão para que o skill seja descoberto.
4. Opcional: peça ao Reversa para executar `/reversa-tracer` com a config liberada.

Nada foi commitado ou pushado.
