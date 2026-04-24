const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // I'll assume it exists or use default credentials

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    databaseURL: "https://controle-obras-c889d-default-rtdb.firebaseio.com"
  });
}

const db = admin.database();
const tenantId = '-OnrJnPKtJUHiiCblToQ';

async function fixDates() {
  const ref = db.ref(`tenants/${tenantId}/presenca`);
  const snap = await ref.once('value');
  const data = snap.val();
  
  if (!data) {
    console.log('Nenhum dado encontrado.');
    process.exit(0);
  }
  
  let count = 0;
  const newData = data.map(p => {
    if (p && p.data === '2026-04-24') {
      p.data = '2026-04-23';
      count++;
    }
    return p;
  });
  
  if (count > 0) {
    await ref.set(newData);
    console.log(`✅ Sucesso! ${count} registros corrigidos de 24/04 para 23/04.`);
  } else {
    console.log('Nenhum registro precisava de correção.');
  }
  process.exit(0);
}

fixDates().catch(err => {
  console.error(err);
  process.exit(1);
});
