// scripts/migrar-itens-estoque.js
// Rodar: node scripts/migrar-itens-estoque.js
const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require('../functions/serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://controle-obras-c889d-default-rtdb.firebaseio.com'
  });
}

const db = admin.database();

function normalizarNome(nome) {
  return nome.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[-_\/\\]/g, ' ').replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ').trim();
}

async function migrar() {
  const snap = await db.ref('tenants').once('value');
  if (!snap.exists()) return console.log('Nenhum tenant encontrado.');

  const tenants = snap.val();
  const updates = {};

  for (const [tid, tenant] of Object.entries(tenants)) {
    const itens = tenant?.estoque?.itens;
    if (!itens) continue;
    for (const [iid, item] of Object.entries(itens)) {
      if (!item.nomeNorm) {
        updates[`tenants/${tid}/estoque/itens/${iid}/nomeNorm`] = normalizarNome(item.nome || '');
        updates[`tenants/${tid}/estoque/itens/${iid}/qtdNoCanteiro`] = item.qtdNoCanteiro || 0;
      }
    }
  }

  const count = Object.keys(updates).length / 2;
  if (count === 0) return console.log('✅ Todos os itens já estão migrados.');

  await db.ref().update(updates);
  console.log(`✅ ${count} itens migrados.`);
}

migrar().catch(console.error);
