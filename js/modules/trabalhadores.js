// ==================== TRABALHADORES MODULE ====================

function renderTrabalhadores() {
  const currentMonth = new Date().toISOString().substring(0, 7);

  safeSetInner('trab-tbody', DB.trabalhadores.length
    ? DB.trabalhadores.map((t, i) => {
        const pres = (DB.presenca || []).filter(p => (p.trab === t.cod || p.nome === t.nome));
        const totalAtend = pres.filter(p => (p.presenca==='Presente'||p.presenca==='Falta')).length;
        const presentCnt = pres.filter(p => p.presenca === 'Presente').length;
        const assid = totalAtend > 0 ? ((presentCnt / totalAtend) * 100).toFixed(0) : 0;
        const faltasMes = pres.filter(p => p.presenca === 'Falta' && (p.data||'').startsWith(currentMonth)).length;

        const earned = pres.reduce((acc, p) => acc + (Number(p.total) || 0), 0);
        const paid = (DB.financeiro || []).filter(f => f.source === 'pre' && f.forn === t.nome && f.status === 'Pago')
                      .reduce((acc, f) => acc + (Number(f.real) || 0), 0);
        const saldo = earned - paid;

        return `<tr>
          <td data-label="Cód."><span class="cod">${sanitizeHTML(t.cod)}</span></td>
          <td data-label="Nome / Função"><b>${sanitizeHTML(t.nome)}</b><br><small style="color:var(--text3)">${sanitizeHTML(t.funcao || '—')}</small></td>
          <td data-label="Assiduidade (%)">
            <div style="display:flex;align-items:center;gap:8px">
              <div class="progress-bar" style="width:50px;height:6px"><div class="progress-fill" style="width:${assid}%; background:${assid > 80 ? 'var(--green)' : assid > 50 ? 'var(--orange)' : 'var(--red)'}"></div></div>
              <span style="font-weight:600;font-size:12px">${assid}%</span>
            </div>
          </td>
          <td data-label="Faltas (Mês)" style="font-weight:600;color:${faltasMes > 0 ? 'var(--red)' : 'var(--text3)'}">${faltasMes}</td>
          <td data-label="Saldo Acum."><b style="color:${saldo > 0 ? 'var(--orange)' : 'var(--text3)'}">${fmt(saldo)}</b></td>
          <td data-label="Diária/Salário">${fmt(t.diaria)}</td>
          <td data-label="Status">${statusBadge(t.status)}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="editTrabalhador(${i})" style="margin-right:8px">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="deleteItem('trabalhadores',${i})">Excluir</button>
          </td>
        </tr>`;
      }).join('')
    : uiEmptyState('Sem Trabalhadores', 'Cadastre o primeiro pedreiro, mestre ou servente para começar.', '👷‍♂️', 'Adicionar Trabalhador', 'openModal(\'modal-trabalhador\')'));
}


window.renderTrabalhadores = renderTrabalhadores;

async function saveTrabalhador() {
  const hiddenIdxVal = document.getElementById('tr-idx') ? document.getElementById('tr-idx').value : '-1';
  const editIdx = parseInt(hiddenIdxVal);

  const cod = document.getElementById('tr-cod').value.trim();
  if (!cod) { toast('Informe o código', 'error'); return; }
  
  const duplicado = DB.trabalhadores.some((t, i) => t.cod === cod && i !== editIdx);
  if (duplicado) { toast(`Código "${cod}" já existe!`, 'error'); return; }

  const data = {
    cod, 
    nome: document.getElementById('tr-nome').value.trim(),
    cpf: document.getElementById('tr-cpf').value,
    funcao: document.getElementById('tr-funcao').value,
    vinculo: document.getElementById('tr-vinculo').value,
    equipe: document.getElementById('tr-equipe').value,
    obras: document.getElementById('tr-obras').value,
    diaria: parseFloat(document.getElementById('tr-diaria').value) || 0,
    pgto: document.getElementById('tr-pgto').value,
    pixtipo: document.getElementById('tr-pixtipo').value,
    pixkey: document.getElementById('tr-pixkey').value,
    contato: document.getElementById('tr-contato').value,
    status: document.getElementById('tr-status').value,
    admissao: document.getElementById('tr-admissao').value,
    endereco: document.getElementById('tr-endereco').value,
    cidade: document.getElementById('tr-cidade').value,
    foto: window._currentTrFoto || (editIdx >= 0 ? DB.trabalhadores[editIdx].foto : null)
  };

  if (editIdx >= 0 && DB.trabalhadores[editIdx]) {
    const oldWorker = { ...DB.trabalhadores[editIdx] };
    const oldName = (oldWorker.nome || '').trim();
    const oldCod = (oldWorker.cod || '').trim();
    const newName = (data.nome || '').trim();
    const newCod = (data.cod || '').trim();

    DB.trabalhadores[editIdx] = data;

    if ((oldName !== newName && newName) || (oldCod !== newCod && newCod)) {
      if (DB.presenca) {
        DB.presenca.forEach(p => {
          if (p.trab === oldCod || p.nome === oldName) {
            p.nome = newName;
            p.trab = newCod;
          }
        });
      }
      if (DB.tarefas) {
        DB.tarefas.forEach(t => { if (t.resp === oldName) t.resp = newName; });
      }
      if (DB.financeiro) {
        DB.financeiro.forEach(f => { if (f.forn === oldName) f.forn = newName; });
      }
      if (DB.medicao) {
        DB.medicao.forEach(m => { if (m.equipe === oldName) m.equipe = newName; });
      }
      if (DB.almocos) {
        DB.almocos.forEach(a => { if (a.empreiteiro === oldName) a.empreiteiro = newName; });
      }
      if (DB.obras) {
        DB.obras.forEach(o => { if (o.mestre === oldName) o.mestre = newName; });
      }
    }
    toast('Cadastro e históricos atualizados!');
  } else {
    DB.trabalhadores.push(data);
    toast('Novo trabalhador cadastrado!');
  }

  closeModal('modal-trabalhador');
  renderTrabalhadores();
  if (typeof renderDashboard === 'function') renderDashboard();
  if (typeof renderFinanceiro === 'function') renderFinanceiro();

  try { await persistDB(true); } catch (err) { toast('Erro na nuvem, salvo localmente.', 'error'); }
}

async function editTrabalhador(idx) {
  await openModal('modal-trabalhador');
  if (document.getElementById('tr-idx')) document.getElementById('tr-idx').value = idx;
  const t = DB.trabalhadores[idx];
  document.getElementById('tr-cod').value = t.cod;
  document.getElementById('tr-nome').value = t.nome;
  document.getElementById('tr-cpf').value = t.cpf;
  document.getElementById('tr-funcao').value = t.funcao;
  document.getElementById('tr-vinculo').value = t.vinculo;
  document.getElementById('tr-equipe').value = t.equipe;
  document.getElementById('tr-obras').value = t.obras;
  document.getElementById('tr-diaria').value = t.diaria;
  document.getElementById('tr-pgto').value = t.pgto || 'PIX';
  document.getElementById('tr-pixtipo').value = t.pixtipo || 'cpf';
  document.getElementById('tr-pixkey').value = t.pixkey || '';
  document.getElementById('tr-contato').value = t.contato || '';
  document.getElementById('tr-status').value = t.status;
  document.getElementById('tr-admissao').value = t.admissao;
  document.getElementById('tr-endereco').value = t.endereco || '';
  document.getElementById('tr-cidade').value = t.cidade || '';
  
  const fPreview = document.getElementById('tr-foto-preview');
  if (fPreview && t.foto) {
    fPreview.style.display = 'block';
    fPreview.querySelector('img').src = t.foto;
  }
}

window.saveTrabalhador = saveTrabalhador;
window.editTrabalhador = editTrabalhador;
