const path = require('path');
const admin = require('firebase-admin');
const axios = require('axios');

const serviceAccount = require(path.join(__dirname, 'serviceAccountKey.json'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://controle-obras-c889d-default-rtdb.firebaseio.com'
  });
}

const API_KEY = 'AIzaSyD9i1vMwmJwiUfwUKetxrzIO6Bm5K-5oro';
const DB_URL = 'https://controle-obras-c889d-default-rtdb.firebaseio.com';

function statusOf(error) {
  return error.response ? error.response.status : error.message;
}

async function runTests() {
  console.log('--- TESTES DE ACESSO AO NÓ /tenants_public ---');

  // Teste 1: listagem do nó pai SEM token deve ser negada
  console.log('\n[TESTE 1] GET /tenants_public SEM token (deve ser negado)');
  try {
    await axios.get(`${DB_URL}/tenants_public.json`);
    console.log('❌ FALHA: o nó pai foi listado sem autenticação.');
  } catch (error) {
    const status = statusOf(error);
    if (status === 401 || status === 403) {
      console.log(`✅ SUCESSO: listagem bloqueada (status ${status}).`);
    } else {
      console.log(`⚠️ ERRO INESPERADO: status ${status}`);
    }
  }

  // Teste 2: listagem do nó pai COM token também deve ser negada
  console.log('\n[TESTE 2] GET /tenants_public COM token (deve ser negado)');
  const db = admin.database();
  const profilesSnap = await db.ref('profiles').limitToFirst(1).once('value');
  const profiles = profilesSnap.val();
  if (!profiles) {
    console.log('⚠️ Nenhum perfil encontrado para gerar token.');
    return;
  }

  const uid = Object.keys(profiles)[0];
  const customToken = await admin.auth().createCustomToken(uid);
  const exchangeUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`;
  const exchangeRes = await axios.post(exchangeUrl, { token: customToken, returnSecureToken: true });
  const idToken = exchangeRes.data.idToken;

  try {
    await axios.get(`${DB_URL}/tenants_public.json?auth=${idToken}`);
    console.log('❌ FALHA: o nó pai foi listado com token.');
  } catch (error) {
    const status = statusOf(error);
    if (status === 401 || status === 403) {
      console.log(`✅ SUCESSO: listagem bloqueada mesmo autenticado (status ${status}).`);
    } else {
      console.log(`⚠️ ERRO INESPERADO: status ${status}`);
    }
  }

  // Teste 3: leitura direta de um slug SEM token deve funcionar
  console.log('\n[TESTE 3] GET /tenants_public/{slug} SEM token (deve funcionar)');
  const tenantsSnap = await db.ref('tenants').limitToFirst(1).once('value');
  const tenants = tenantsSnap.val();
  if (!tenants) {
    console.log('⚠️ Nenhum tenant encontrado.');
    return;
  }

  const [tid, tenant] = Object.entries(tenants)[0];
  const slug = tenant?.config?.slug || tenant?.subdominioSlug || tid;

  try {
    const res = await axios.get(`${DB_URL}/tenants_public/${encodeURIComponent(slug)}.json`);
    if (res.data && res.data.slug === slug) {
      console.log(`✅ SUCESSO: leitura direta do slug "${slug}" liberada.`);
    } else {
      console.log('⚠️ Resposta inesperada:', res.data);
    }
  } catch (error) {
    console.log(`❌ FALHA: leitura direta negada (status ${statusOf(error)}).`);
  }
}

runTests()
  .catch((error) => console.error('❌ Erro nos testes:', error))
  .finally(() => process.exit(0));
