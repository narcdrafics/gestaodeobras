const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 8080;
const publicDir = path.join(__dirname, 'public');

// Servir somente a pasta public/ (nunca a raiz do projeto)
app.use(express.static(publicDir));

// Fallback para index.html (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(port, () => {
  console.log(`Servidor Obra Real rodando na porta ${port}`);
});
