const admin = require('firebase-admin');
const axios = require('axios');
const fs = require('fs');

// Initialize Admin SDK
const serviceAccountPath = '/Users/tonycampelo/Documents/gestaodeobras/functions/serviceAccountKey.json';
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://controle-obras-c889d-default-rtdb.firebaseio.com'
});

const API_KEY = 'AIzaSyD9i1vMwmJwiUfwUKetxrzIO6Bm5K-5oro';

async function run() {
  try {
    // 1. Fetch live rules to verify no literal email
    const creds = new admin.credential.cert(serviceAccount);
    const dbToken = await creds.getAccessToken();
    const rulesUrl = `https://controle-obras-c889d-default-rtdb.firebaseio.com/.settings/rules.json?access_token=${dbToken.access_token}`;
    const rulesRes = await axios.get(rulesUrl);
    const rulesStr = JSON.stringify(rulesRes.data);
    
    console.log('--- VERIFICAÇÃO DE REGRAS NA NUVEM ---');
    if (rulesStr.includes('tonycampelo@gmail.com')) {
      console.log('❌ FALHA: O e-mail literal tonycampelo@gmail.com ainda foi encontrado nas regras publicadas!');
    } else {
      console.log('✅ SUCESSO: As regras no Firebase estão limpas. Nenhum e-mail literal encontrado.');
    }

    // 2. Test access as super_admin
    const db = admin.database();
    
    // Pega o UID do Tony (ou qualquer super_admin)
    const profilesSnap = await db.ref('profiles').orderByChild('role').equalTo('super_admin').limitToFirst(1).once('value');
    const profiles = profilesSnap.val();
    
    if (!profiles) {
      console.log('⚠️ Nenhum usuário com role="super_admin" encontrado para testar.');
      return;
    }
    
    const uid = Object.keys(profiles)[0];
    console.log(`\n--- TESTE DE ACESSO (SIMULAÇÃO CLIENTE) ---`);
    console.log(`👤 Gerando token de cliente real para o UID: ${uid} (role: super_admin)`);
    
    // Create Custom Token
    const customToken = await admin.auth().createCustomToken(uid);
    
    // Exchange for ID Token (this simulates a real user login token on the frontend)
    const exchangeUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`;
    const exchangeRes = await axios.post(exchangeUrl, {
      token: customToken,
      returnSecureToken: true
    });
    
    const idToken = exchangeRes.data.idToken;
    
    // Test access to /users.json which requires super_admin
    // using the REST API with the user ID Token, which evaluates the Security Rules!
    const testUrl = `https://controle-obras-c889d-default-rtdb.firebaseio.com/users.json?auth=${idToken}`;
    
    try {
      const testRes = await axios.get(testUrl);
      console.log('✅ SUCESSO: Leitura do nó /users permitida! As regras avaliaram o papel de "super_admin" corretamente sem precisar do e-mail.');
      console.log(`📄 Retornou ${Object.keys(testRes.data || {}).length} registros de usuários.`);
    } catch (e) {
      console.log(`❌ FALHA no acesso: O Firebase bloqueou a leitura. Status: ${e.response ? e.response.status : e.message}`);
      if (e.response && e.response.data) console.log(e.response.data);
    }
    
  } catch (err) {
    console.error('Erro na execução:', err.message);
    if (err.response && err.response.data) console.error(err.response.data);
  } finally {
    process.exit(0);
  }
}

run();
