# API Admin — Criar usuário, Tarefas

> 🟢 CONFIRMADO · 🔴 LACUNA.

## Pré-requisitos

- [ ] Rewrite `/api/admin/criar-usuario` ativo.
- [ ] Convite gravado pelo cliente antes da chamada (`invites/<emailKey>`).

## Tarefas

- [ ] T-01, Validar método/corpo/cota IP antes do Auth — Origem: `functions/usuarios.js`, `functions/abuso.js`; Critério: 405/413/429 sem chamada ao Auth; 🟢
- [ ] T-02, Verificar Bearer com `checkRevoked` e resolver papel — Origem: `functions/usuarios.js`; Critério: 401/403 corretos; 🟢
- [ ] T-03, Consumir convite por transação — Origem: `functions/usuarios.js`; Critério: reuso ⇒ 409, falha devolve reserva; 🟢
- [ ] T-04, Criar/atualizar usuário com senha temporária — Origem: `functions/usuarios.js`; Critério: senha ausente do RTDB; 🟢
- [ ] T-05, Bloquear tenant cruzado de admin não-master — Origem: `flowcharts/usuarios-e-cargos.md` §1; Critério: 409; 🟢

## Tarefas de Teste

- [ ] TT-01, happy path com convite válido
- [ ] TT-02, convite reutilizado e ausente
- [ ] TT-03, e-mail vinculado a outro tenant
- [ ] TT-04, cota e corpo inválidos

## Lacunas Pendentes (🔴)

- 🔴 Definir se a criação deve gerar `admin_audit` obrigatório.
