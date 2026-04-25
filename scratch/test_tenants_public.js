const admin = require('firebase-admin');
const axios = require('axios');

// Initialize Admin SDK to get custom token capabilities
const serviceAccountPath = '/Users/tonycampelo/Documents/gestaodeobras/functions/serviceAccountKey.json';
const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://controle-obras-c889d-default-rtdb.firebaseio.com'
  });
}

const API_KEY = 'AIzaSyD9i1vMwmJwiUfwUKetxrzIO6Bm5K-5oro';

async function runTests() {
  console.log('--- INICIANDO TESTES DE ACESSO AO NÓ /tenants_public ---');

  // Teste 1: SEM TOKEN
  console.log('\n[TESTE 1] GET /tenants_public SEM token');
  try {
    await axios.get('https://controle-obras-c889d-default-rtdb.firebaseio.com/tenants_public.json');
    console.log('❌ FALHA NO TESTE: A requisição retornou 200 (Sucesso) quando deveria ser 401/403 (Negado).');
  } catch (error) {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      console.log(`✅ SUCESSO NO TESTE: Acesso bloqueado corretamente! Status recebido: ${error.response.status}`);
      console.log(`📄 Resposta: ${JSON.stringify(error.response.data)}`);
    } else {
      console.log(`⚠️ ERRO INESPERADO: Status ${error.response ? error.response.status : error.message}`);
    }
  }

  // Teste 2: COM TOKEN VÁLIDO
  console.log('\n[TESTE 2] GET /tenants_public COM token válido');
  try {
    // Pegar o primeiro usuário que encontrarmos para gerar um token válido (não precisa ser super_admin)
    const db = admin.database();
    const profilesSnap = await db.ref('profiles').limitToFirst(1).once('value');
    const profiles = profilesSnap.val();
    
    if (!profiles) {
      console.log('⚠️ Nenhum perfil de usuário encontrado para testar o token.');
      return;
    }
    
    const uid = Object.keys(profiles)[0];
    console.log(`Gerando token para o UID: ${uid}...`);
    
    // Gerar Custom Token e trocar por ID Token via REST
    const customToken = await admin.auth().createCustomToken(uid);
    const exchangeUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`;
    const exchangeRes = await axios.post(exchangeUrl, {
      token: customToken,
      returnSecureToken: true
    });
    const idToken = exchangeRes.data.idToken;

    // Fazer a chamada com o Token
    const res = await axios.get(`https://controle-obras-c889d-default-rtdb.firebaseio.com/tenants_public.json?auth=${idToken}`);
    console.log(`✅ SUCESSO NO TESTE: Acesso liberado! Status recebido: ${res.status}`);
    console.log(`📄 Dados recebidos (chaves): ${Object.keys(res.data || {}).join(', ') || 'Nenhum tenant cadastrado'}`);
    
  } catch (error) {
    console.log(`❌ FALHA NO TESTE: Acesso negado mesmo com token. Status: ${error.response ? error.response.status : error.message}`);
    if (error.response && error.response.data) console.log(error.response.data);
  } finally {
    process.exit(0);
  }
}

runTests();
