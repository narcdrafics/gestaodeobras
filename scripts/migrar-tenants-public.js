// scripts/migrar-tenants-public.js
// Migra o nó público de branding para o modelo "slug como chave".
//
// Antes: tenants_public/{tenantId} = { slug, nomeEmpresa, ... }
// Depois: tenants_public/{slug}     = { slug, tenantId, nomeEmpresa, ... }
//
// Rodar uma única vez, com credenciais de admin:
//   node scripts/migrar-tenants-public.js
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

// Usa a chave de serviço local, se existir; senão, credenciais padrão do ambiente
// (GOOGLE_APPLICATION_CREDENTIALS ou `gcloud auth application-default login`).
const serviceAccountPath = path.join(__dirname, '..', 'functions', 'serviceAccountKey.json');
const credential = fs.existsSync(serviceAccountPath)
  ? admin.credential.cert(require(serviceAccountPath))
  : admin.credential.applicationDefault();

if (!admin.apps.length) {
  admin.initializeApp({
    credential,
    databaseURL: 'https://controle-obras-c889d-default-rtdb.firebaseio.com'
  });
}

const db = admin.database();

async function migrar() {
  const [tenantsSnap, publicSnap] = await Promise.all([
    db.ref('tenants').once('value'),
    db.ref('tenants_public').once('value')
  ]);

  const tenants = tenantsSnap.val() || {};
  const publico = publicSnap.val() || {};
  const updates = {};
  const slugsAtuais = new Set();

  // 1. Reconstrói o nó público a partir da fonte da verdade (tenants)
  for (const [tid, tenant] of Object.entries(tenants)) {
    // O nó público legado (chave = tenantId) guarda o slug mais recente.
    // Depois dele, prioriza subdominioSlug e, por fim, config.slug.
    const legacyPublic = publico[tid];
    const slug = legacyPublic?.slug || tenant?.subdominioSlug || tenant?.config?.slug || tid;
    if (!slug) continue;

    slugsAtuais.add(slug);
    updates[`tenants_public/${slug}`] = {
      slug,
      tenantId: tid,
      nomeEmpresa: tenant?.config?.nomeEmpresa || tenant?.nomeEmpresa || 'Obra Real',
      esquemaCores: tenant?.config?.esquemaCores || 'emerald',
      logoUrl: tenant?.config?.logoUrl || ''
    };

    // Normaliza os dois campos de slug para evitar divergência futura
    if (tenant?.config?.slug !== slug) updates[`tenants/${tid}/config/slug`] = slug;
    if (tenant?.subdominioSlug !== slug) updates[`tenants/${tid}/subdominioSlug`] = slug;

    // Remove a chave legada (ID do tenant) quando difere do slug
    if (tid !== slug && publico[tid]) {
      updates[`tenants_public/${tid}`] = null;
    }
  }

  // 2. Remove chaves órfãs que não correspondem a nenhum slug atual
  for (const key of Object.keys(publico)) {
    if (!slugsAtuais.has(key)) {
      updates[`tenants_public/${key}`] = null;
    }
  }

  const total = Object.keys(updates).length;
  if (total === 0) return console.log('✅ Nada para migrar.');

  await db.ref().update(updates);
  console.log(`✅ ${Object.keys(tenants).length} tenants processados (${total} alterações).`);
}

migrar().catch((err) => {
  console.error('❌ Falha na migração:', err);
  process.exitCode = 1;
});
