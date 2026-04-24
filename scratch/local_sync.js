const fs = require('fs');
const path = require('path');

const workersPath = path.join(__dirname, 'workers.json');
const presencePath = path.join(__dirname, 'presence.json');
const outputPath = path.join(__dirname, 'presence_fixed.json');

function norm(str) {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function sync() {
  const trabalhadores = JSON.parse(fs.readFileSync(workersPath, 'utf8')) || [];
  const presenca = JSON.parse(fs.readFileSync(presencePath, 'utf8')) || [];
  
  const trabMap = {};
  const listaTrab = Array.isArray(trabalhadores) ? trabalhadores : Object.values(trabalhadores);
  listaTrab.forEach(t => {
    if (t) {
      if (t.cod) trabMap[String(t.cod)] = t;
      trabMap[norm(t.nome)] = t;
    }
  });

  console.log(`📊 Processando ${presenca.length} registros...`);
  
  let fixes = 0;
  const newData = presenca.map(p => {
    if (!p) return p;
    
    // Busca o trabalhador por cod ou nome
    const trab = trabMap[String(p.trab)] || trabMap[norm(p.nome)];
    if (!trab) return p;

    let changed = false;
    const diariaAtual = parseFloat(trab.diaria) || 0;

    // 1. Sincroniza Diária
    if (parseFloat(p.diaria) !== diariaAtual) {
      p.diaria = diariaAtual;
      changed = true;
    }

    // 2. Sincroniza Total baseado no status de presença
    let totalCorreto = 0;
    if (p.presenca === 'Presente') {
      totalCorreto = diariaAtual;
    } else if (p.presenca === 'Meio período') {
      totalCorreto = diariaAtual / 2;
    } else if (p.presenca === 'Falta') {
      totalCorreto = 0;
    }

    if (parseFloat(p.total) !== totalCorreto) {
      p.total = totalCorreto;
      changed = true;
    }

    // 3. Garante campos obrigatórios para o financeiro do Dashboard
    if (!p.pgtoStatus) {
      p.pgtoStatus = 'Pendente';
      changed = true;
    }
    if (p.valpago === undefined) {
      p.valpago = 0;
      changed = true;
    }

    if (changed) fixes++;
    return p;
  });

  fs.writeFileSync(outputPath, JSON.stringify(newData, null, 2));
  console.log(`✅ Sucesso! Gerado presence_fixed.json com ${fixes} correções.`);
}

sync();
