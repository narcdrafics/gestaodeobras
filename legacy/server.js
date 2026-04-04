const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 8080;

// Servir arquivos estáticos da raiz do projeto
app.use(express.static(path.join(__dirname, './')));

// Fallback para index.html (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Servidor Obra Real rodando na porta ${port}`);
});
