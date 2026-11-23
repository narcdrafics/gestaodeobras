# Isolamento entre empresas (multi-tenant)

O tenant de um usuário é decidido pelo perfil no Realtime Database
(`profiles/<uid>/tenantId`) e propagado pelo servidor para as Custom Claims
(`role` + `tenantId`) via `syncCustomClaims`. Nenhuma decisão de acesso depende
de valor enviado pelo navegador.

## Realtime Database

- `users/<email>` (passaporte legado) e `invites/<email>` **não são mais
  legíveis por qualquer usuário autenticado**. A leitura é permitida apenas
  para o próprio usuário (por `uid` ou e-mail), Super Admin (allowlist
  `super_admins/<uid>`, e-mail mestre ou claim) e, no caso de convites, para o
  admin do tenant dono do convite.
- Admin só cria/altera convite com `tenantId` igual ao seu próprio tenant; o
  `tenantId` do convite é imutável depois da criação e o campo `email` precisa
  bater com a chave do nó. Admin de A não apaga convite de B.
- Usuário comum não pode se auto-convidar (a exceção de autoescrita em
  `invites` serve somente para remover o próprio convite após o login).
- `tenants_public/<slug>` não pode ser reapropriado: o `tenantId` é imutável
  após a criação e a escrita exige que o nó pertença ao tenant do chamador
  (ou que ele seja Super Admin). Isso fecha o sequestro de slug por admin de
  outra empresa. Na criação de `tenants/<slug>`, o `emailAdmin` precisa ser o
  e-mail autenticado (o bootstrap/master via Admin SDK continua livre).
- `admin_audit` deixou de aceitar `users/<email>/role === 'super_admin'` como
  autoridade: a leitura usa a allowlist `super_admins/<uid>`.
- Nós por tenant (`tenants/<id>`, `comprasPrivadas`, `auditoria`,
  `notificacoes`, `tarefas_pendentes`, estoque etc.) continuam exigindo
  `profiles/<uid>/tenantId === $tenantId`.

## Cloud Storage

`storage.rules` exige `request.auth.token.tenantId == tenantId` **e** um papel
válido no mesmo caminho `tenants/{tenantId}/...`. Super Admin precisa das duas
claims (`super_admin` + `MASTER_SYSTEM`). Escritas exigem arquivo de 1 byte a
10 MB, com `contentType` de imagem ou PDF; qualquer caminho fora de
`tenants/<tenantId>/` permanece negado.

Como as Storage Rules não conseguem consultar o Realtime Database, a revogação
de tokens no servidor é obrigatória sempre que cargo/tenant muda — já feita em
`functions/cargos.js` e `functions/super_admin.js`.

## Primeiro acesso do painel Master

`admin-login.html` não consulta mais `users/<email>` antes de autenticar. A
conta é criada e `auth_core.js` valida a claim final de `super_admin`; se o
e-mail não tiver autoridade, a sessão é encerrada. O bootstrap continua sendo
feito apenas por `functions/set_super_admin.js`.

## Deploy e verificação

```bash
firebase deploy --only database:rules,storage,functions:gerenciarCargo,functions:syncCustomClaims,hosting
npm test -- --run   # inclui tests/security/tenant-isolation.test.js
```

Os testes leem as expressões reais de `database.rules.json` e as executam com
snapshots falsos, simulando admin A tentando ler/gravar dados do tenant B.
