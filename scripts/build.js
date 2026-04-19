const fs = require('fs');
const path = require('path');
require('dotenv').config();

const jsDir = path.join(__dirname, '..', 'js');
const filesToProcess = ['data_core.js']; // Podemos adicionar mais se necessário

filesToProcess.forEach(file => {
  const filePath = path.join(jsDir, file);
  if (!fs.existsSync(filePath)) return;

  let content = fs.readFileSync(filePath, 'utf8');
  let hasChanges = false;

  // Lista de variáveis esperadas
  const envVars = [
    'FIREBASE_API_KEY',
    'FIREBASE_AUTH_DOMAIN',
    'FIREBASE_DATABASE_URL',
    'FIREBASE_PROJECT_ID',
    'FIREBASE_STORAGE_BUCKET',
    'FIREBASE_MESSAGING_SENDER_ID',
    'FIREBASE_APP_ID',
    'FIREBASE_MEASUREMENT_ID'
  ];

  envVars.forEach(v => {
    const placeholder = `[[${v}]]`;
    if (content.includes(placeholder)) {
      if (!process.env[v]) {
        console.warn(`Aviso: Variável ${v} não encontrada no .env`);
        return;
      }
      content = content.replace(placeholder, process.env[v]);
      hasChanges = true;
    }
  });

  if (hasChanges) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Sucesso: Variáveis injetadas em ${file}`);
  }
});
