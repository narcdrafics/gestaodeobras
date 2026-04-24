const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    databaseURL: "https://controle-obras-c889d-default-rtdb.firebaseio.com"
  });
}

const db = admin.database();
const tenantId = '-OnrJnPKtJUHiiCblToQ';

async function powerSync() {
  console.log('🚀 Iniciando Power Sync...');
  
  // 1. Carregar Trabalhadores
  const trabSnap = await db.ref(`tenants/${tenantId}/trabalhadores`).once('value');
  const trabalhadores = trabSnap.val() || [];
  const trabMap = {};
  
  // Mapeia por cod e por nome (para garantir)
  const listaTrab = Array.isArray(trabalhadores) ? trabalhadores : Object.values(trabalhadores);
  listaTrab.forEach(t => {
    if (t) {
      if (t.cod) trabMap[t.cod] = t;
      trabMap[t.nome.toLowerCase().trim()] = t;
    }
  });

  // 2. Carregar Presença
  const presRef = db.ref(`tenants/${tenantId}/presenca`);
  const presSnap = await presRef.once('value');
  const presenca = presSnap.val() || [];
  
  if (!Array.isArray(presenca)) {
    console.log('⚠️ A tabela de presença não é um array. Abortando para segurança.');
    process.exit(1);
  }

  console.log(`📊 Processando ${presenca.length} registros de presença...`);
  
  let fixes = 0;
  const newData = presenca.map((p, idx) => {
    if (!p) return p;
    
    // Busca o trabalhador
    const trab = trabMap[p.trab] || trabMap[p.nome?.toLowerCase().trim()];
    if (!trab) return p;

    let changed = false;
    const diariaAtual = parseFloat(trab.diaria) || 0;

    // Sincroniza Diária
    if (parseFloat(p.diaria) !== diariaAtual) {
      p.diaria = diariaAtual;
      changed = true;
    }

    // Sincroniza Total baseado na Presença
    let totalCorreto = 0;
    if (p.presenca === 'Presente') {
      totalCorreto = diariaAtual;
    } else if (p.presenca === 'Meio período') {
      totalCorreto = diariaAtual / 2;
    } else if (p.presenca === 'Falta') {
      totalCorreto = 0;
    }

    if (parseFloat(p.total) !== totalCorreto) {
      p.total = totalCorreto;
      changed = true;
    }

    // Garante campos de pagamento
    if (!p.pgtoStatus) {
      p.pgtoStatus = 'Pendente';
      changed = true;
    }
    if (p.valpago === undefined) {
      p.valpago = 0;
      changed = true;
    }

    if (changed) fixes++;
    return p;
  });

  if (fixes > 0) {
    await presRef.set(newData);
    console.log(`✅ Sucesso! Dashboard de Presença sincronizado.`);
    console.log(`🔧 Alterações realizadas em ${fixes} campos de registros.`);
  } else {
    console.log('✨ Tudo limpo! O Dashboard já estava em sincronia com o banco de dados.');
  }
  
  process.exit(0);
}

powerSync().catch(err => {
  console.error('❌ Erro no Sync:', err);
  process.exit(1);
});
