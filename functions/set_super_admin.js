// Bootstrap ONE-TIME de Super Admin (execução local com service account).
// É a única forma de criar a primeira conta master: o navegador não pode mais
// gravar users/<email> nem profiles/<uid> com role super_admin.
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://controle-obras-c889d-default-rtdb.firebaseio.com'
});

async function run() {
  try {
    const email = 'tonycampelo@gmail.com';
    const emailKey = email.replace(/\./g, ',');
    
    // Get user UID from auth
    const userRecord = await admin.auth().getUserByEmail(email);
    const uid = userRecord.uid;
    console.log(`Found UID for ${email}: ${uid}`);
    
    // Set in profiles
    await admin.database().ref(`profiles/${uid}`).update({
      role: 'super_admin',
      tenantId: 'MASTER_SYSTEM'
    });
    console.log(`Updated profiles/${uid} to role: super_admin`);
    
    // Set in users
    await admin.database().ref(`users/${emailKey}`).update({
      role: 'super_admin',
      tenantId: 'MASTER_SYSTEM',
      nome: 'Tony Campelo (Master)',
      origem: 'bootstrap_manual'
    });
    console.log(`Updated users/${emailKey} to role: super_admin`);

    // Fonte canônica usada por syncCustomClaims e pela API do painel.
    await admin.database().ref(`super_admins/${uid}`).set({
      uid,
      email,
      role: 'super_admin',
      origem: 'bootstrap_manual'
    });
    console.log(`Updated super_admins/${uid}`);

    console.log('Done!');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}
run();
