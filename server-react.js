import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3000;

// Serve arquivos estáticos da raiz
app.use(express.static(__dirname, {
  index: ['index.html', 'index.html']
}));

// Para qualquer rota, retorna index.html (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Obra Real React: http://localhost:${PORT}`);
});