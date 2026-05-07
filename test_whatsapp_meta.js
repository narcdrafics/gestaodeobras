const crypto = require('crypto');

// =========================================================
// CONFIGURAÇÃO DO TESTE
// =========================================================
const APP_SECRET = 'e40c100c17b25bd5d44996da6c6e71da'; // <--- COLOQUE SEU APP SECRET AQUI
const WEBHOOK_URL = 'https://obrareal.com/api/whatsapp';
const TELEFONE_TESTE = '559885262006'; // <--- COLOQUE SEU TELEFONE (CADASTRADO NO SISTEMA)
const MENSAGEM = 'Criar tarefa: Revisar reboco da fachada na Obra Timbumba';
// =========================================================

const payload = JSON.stringify({
  object: 'whatsapp_business_account',
  entry: [{
    changes: [{
      value: {
        messaging_product: 'whatsapp',
        metadata: { display_phone_number: '123456789', phone_number_id: '1037175229489650' },
        contacts: [{ profile: { name: 'Usuario Teste' }, wa_id: TELEFONE_TESTE }],
        messages: [{
          from: TELEFONE_TESTE,
          id: 'wamid.HBgLNTU5ODk4NTI2MjAwNhUCABEYEkI3RjREOUYyQzY4MUE1OTVEOAA=',
          timestamp: Math.floor(Date.now() / 1000),
          text: { body: MENSAGEM },
          type: 'text'
        }]
      },
      field: 'messages'
    }]
  }]
});

const signature = 'sha256=' + crypto
  .createHmac('sha256', APP_SECRET)
  .update(payload)
  .digest('hex');

console.log('🚀 Enviando payload para:', WEBHOOK_URL);
console.log('📝 Mensagem:', MENSAGEM);

fetch(WEBHOOK_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Hub-Signature-256': signature
  },
  body: payload
})
  .then(async (res) => {
    const text = await res.text();
    console.log('-------------------------------------------');
    console.log('📡 Status:', res.status);
    console.log('📥 Resposta:', text);
    if (res.status === 200) {
      console.log('✅ Sucesso! Verifique os logs no console do Firebase para ver o processamento da IA.');
    } else {
      console.log('❌ Erro. Verifique se o APP_SECRET está correto e se o telefone está autorizado.');
    }
  })
  .catch(err => {
    console.error('❌ Erro na conexão:', err.message);
  });
