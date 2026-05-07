const crypto = require('crypto');
const axios = require('axios');

// CONFIGURAÇÃO
const APP_SECRET = 'e40c100c17b25bd5d44996da6c6e71da';
const WEBHOOK_URL = 'https://obrareal.com/api/whatsapp';
const TELEFONE_TESTE = '559885262006';
const PHONE_NUMBER_ID = '1037175229489650';

async function simularMensagem(texto) {
    const payload = JSON.stringify({
        object: 'whatsapp_business_account',
        entry: [{
            changes: [{
                value: {
                    messaging_product: 'whatsapp',
                    metadata: { display_phone_number: '123456789', phone_number_id: PHONE_NUMBER_ID },
                    contacts: [{ profile: { name: 'Tony Dev' }, wa_id: TELEFONE_TESTE }],
                    messages: [{
                        from: TELEFONE_TESTE,
                        id: 'wamid.' + Math.random().toString(36).substring(7),
                        timestamp: Math.floor(Date.now() / 1000),
                        text: { body: texto },
                        type: 'text'
                    }]
                },
                field: 'messages'
            }]
        }]
    });

    const signature = 'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(payload).digest('hex');

    try {
        const res = await axios.post(WEBHOOK_URL, payload, {
            headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': signature }
        });
        console.log(`\n💬 Teste: "${texto}"`);
        console.log(`📡 Status: ${res.status} | 📥 Resposta: ${res.data}`);
    } catch (err) {
        console.error(`❌ Erro no teste "${texto}":`, err.response?.data || err.message);
    }
}

async function runTests() {
    console.log('🚀 Iniciando Teste de Funcionalidades (Modo Inteligente)');
    
    // 1. Saudação
    await simularMensagem('Bom dia!');
    
    // 2. Lançamento de Ponto
    await simularMensagem('Lançar ponto para João e Maria na obra timbumba hoje');
    
    // 3. Criação de Tarefa
    await simularMensagem('Criar tarefa: Comprar 50 sacos de cimento na obra timbumba amanhã');
    
    // 4. Teste de Obra inexistente
    await simularMensagem('Lançar ponto na obra Xyz Inexistente');

    console.log('\n✅ Todos os testes enviados! Agora acompanhe os logs no Firebase.');
}

runTests();
