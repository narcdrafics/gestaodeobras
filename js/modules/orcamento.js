// ==================== ORÇAMENTO & AUDITORIA MODULE ====================

function renderOrcamento() {
  const budgetResults = window.calcBudgetProgress(DB.orcamento, DB.financeiro, DB.compras);

  safeSetInner('orc-tbody', budgetResults.length
    ? budgetResults.map((o, i) => {
      const diff = o.diferenca;
      return `<tr>
          <td>${obName(o.obra)}</td>
          <td>${sanitizeHTML(o.etapa)}</td>
          <td>${sanitizeHTML(o.tipo)}</td>
          <td>${sanitizeHTML(o.desc)}</td>
          <td>${sanitizeHTML(o.unid || '—')}</td>
          <td>${o.qtd}</td>
          <td>${fmt(o.vunit)}</td>
          <td>${fmt(o.vtotal)}</td>
          <td>${fmt(o.realizado)}</td>
          <td style="color:${diff < 0 ? 'var(--red)' : diff > 0 ? 'var(--green)' : 'var(--text)'}">${fmt(diff)}</td>
          <td>${o.perc}%</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="editOrcamento(${i})" style="margin-right:8px">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="deleteItem('orcamento',${i})">Excluir</button>
          </td>
        </tr>`;
    }).join('')
    : uiEmptyState('Sem Orçamento', 'Crie as linhas de custo planejado para comparar com o real na tela do Painel.', '📐', 'Criar Linha Orçamentária', 'openModal(\'modal-orcamento\')'));
}

window.renderOrcamento = renderOrcamento;

async function renderRelatorios() {
  const sel = document.getElementById('rel-obra');
  if (sel && DB.obras.length > 0) {
    safeSetInner(sel, '<option value="">-- Escolha uma Obra --</option>' +
      DB.obras.map(o => `<option value="${sanitizeHTML(o.cod)}">${sanitizeHTML(o.nome)}</option>`).join(''));
  }
}

window.renderRelatorios = renderRelatorios;

function generateAuditReport() {
  const obraCod = document.getElementById('rel-obra').value;
  if (!obraCod) { toast('Selecione uma obra primeiro!', 'error'); return; }

  const obra = DB.obras.find(o => o.cod === obraCod);
  if (!obra) return;

  const orc = DB.orcamento.filter(o => o.obra === obraCod);
  const fin = DB.financeiro.filter(f => f.obra === obraCod);
  const med = DB.medicao.filter(m => m.obra === obraCod);
  const com = DB.compras.filter(c => c.obra === obraCod && (c.status === 'Entregue' || c.status === 'Pago'));

  const isMat = (t) => ['Material', 'Custo Direto (Material)', 'Insumos', 'Equipamento'].includes(t);
  const isMao = (t) => ['Mão de Obra', 'Mão de obra própria', 'Empreiteiro', 'Serviços', 'Adiantamento'].includes(t);

  let prevMat = orc.filter(o => isMat(o.tipo)).reduce((a, b) => a + (b.vtotal || 0), 0);
  let prevMao = orc.filter(o => isMao(o.tipo)).reduce((a, b) => a + (b.vtotal || 0), 0);
  let prevOut = orc.filter(o => !isMat(o.tipo) && !isMao(o.tipo)).reduce((a, b) => a + (b.vtotal || 0), 0);

  let realMat = fin.filter(f => isMat(f.tipo)).reduce((a, b) => a + (b.real || 0), 0);
  realMat += com.reduce((a, b) => a + (b.vtotal || 0), 0); 

  let realMao = fin.filter(f => isMao(f.tipo)).reduce((a, b) => a + (b.real || 0), 0);
  realMao += med.reduce((a, b) => a + (parseFloat(b.vtotal) || 0), 0); 

  let totalPrev = prevMat + prevMao + prevOut;
  let totalReal = realMat + realMao;

  let html = `
    <div id="print-area" style="padding: 40px; background: white; color: #1e293b; font-family: 'IBM Plex Sans', sans-serif; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); border: 1px solid #e2e8f0;">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px;">
        <div>
          <h1 style="margin:0; font-size:28px; color:var(--accent)">LAUDO DE VISTORIA E AUDITORIA</h1>
          <p style="margin:5px 0; color:#64748b; font-weight:500;">Obra: ${sanitizeHTML(obra.nome)} (${sanitizeHTML(obra.cod)})</p>
        </div>
        <div style="text-align:right">
          <p style="margin:0; font-size:14px; font-weight:600">Obra Real — Gestão Pro</p>
          <p style="margin:0; font-size:12px; color:#64748b">${new Date().toLocaleDateString('pt-BR')}</p>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px;">
        <div style="padding:15px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0">
          <label style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:700">Investimento Total</label>
          <div style="font-size:20px; font-weight:700; color:#0f172a">${fmt(totalReal)}</div>
          <small style="color:#64748b">de ${fmt(totalPrev)} planejado</small>
        </div>
        <div style="padding:15px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0">
          <label style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:700">Economia / Excesso</label>
          <div style="font-size:20px; font-weight:700; color:${totalReal > totalPrev ? '#ef4444' : '#10b981'}">${fmt(totalPrev - totalReal)}</div>
        </div>
        <div style="padding:15px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0">
          <label style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:700">Status Financeiro</label>
          <div style="font-size:20px; font-weight:700; color:#0f172a">${((totalReal / totalPrev) * 100).toFixed(1)}%</div>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; background: #fff; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <div>
          <h4 style="margin:0 0 15px 0; color:#475569; display:flex; align-items:center; gap:8px"><span style="font-size:20px">📦</span> MATERIAIS E INSUMOS</h4>
          <div style="display:flex; justify-content:space-between; margin-bottom:8px">
            <span style="font-size:13px; color:#64748b">Gasto Realizado</span>
            <span style="font-size:14px; font-weight:700">${fmt(realMat)}</span>
          </div>
          <div style="height:8px; background:#f1f5f9; border-radius:4px; overflow:hidden; margin-bottom:8px">
            <div style="width:${Math.min(100, (realMat / prevMat) * 100)}%; height:100%; background:#6366f1"></div>
          </div>
          <p style="margin:0; font-size:11px; color:#94a3b8">Previsto em orçamento: ${fmt(prevMat)}</p>
        </div>
        <div>
          <h4 style="margin:0 0 15px 0; color:#475569; display:flex; align-items:center; gap:8px"><span style="font-size:20px">👷</span> MÃO DE OBRA E SERVIÇOS</h4>
          <div style="display:flex; justify-content:space-between; margin-bottom:8px">
            <span style="font-size:13px; color:#64748b">Gasto Realizado</span>
            <span style="font-size:14px; font-weight:700">${fmt(realMao)}</span>
          </div>
          <div style="height:8px; background:#f1f5f9; border-radius:4px; overflow:hidden; margin-bottom:8px">
            <div style="width:${Math.min(100, (realMao / prevMao) * 100)}%; height:100%; background:#10b981"></div>
          </div>
          <p style="margin:0; font-size:11px; color:#94a3b8">Previsto em orçamento: ${fmt(prevMao)}</p>
        </div>
      </div>

      <h3 style="border-left: 4px solid var(--accent); padding-left: 10px; margin-bottom: 15px; font-size:18px">Evidências de Campo (Medições)</h3>
      <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 30px;">
        ${med.map(m => `
          <div style="border: 1px solid #e2e8f0; border-radius:8px; overflow:hidden">
            ${m.photoUrl ? `<img src="${sanitizeHTML(m.photoUrl)}" style="width:100%; height:150px; object-fit:cover; display:block">` : '<div style="height:150px; background:#f1f5f9; display:flex; align-items:center; justify-content:center; color:#94a3b8">Sem foto</div>'}
            <div style="padding:10px; font-size:12px">
              <b>${sanitizeHTML(m.servico)}</b><br>
              <span style="color:#64748b">Fase: ${sanitizeHTML(m.etapa)} | Data: ${fmtDate(m.semana)}</span>
            </div>
          </div>
        `).join('')}
      </div>

      <h3 style="border-left: 4px solid var(--accent); padding-left: 10px; margin-bottom: 15px; font-size:18px">Extrato de Pagamentos Auditos</h3>
      <table style="width:100%; border-collapse: collapse; font-size:12px">
        <thead>
          <tr style="background:#f1f5f9; text-align:left">
            <th style="padding:10px; border-bottom:2px solid #e2e8f0">Data</th>
            <th style="padding:10px; border-bottom:2px solid #e2e8f0">Descrição</th>
            <th style="padding:10px; border-bottom:2px solid #e2e8f0">Tipo</th>
            <th style="padding:10px; border-bottom:2px solid #e2e8f0; text-align:right">Valor</th>
          </tr>
        </thead>
        <tbody>
          ${fin.filter(f => f.status === 'Pago').map(f => `
            <tr>
              <td style="padding:8px; border-bottom:1px solid #f1f5f9">${fmtDate(f.data)}</td>
              <td style="padding:8px; border-bottom:1px solid #f1f5f9">${sanitizeHTML(f.desc)}</td>
              <td style="padding:8px; border-bottom:1px solid #f1f5f9"><span style="color:#64748b; font-size:10px; text-transform:uppercase">${sanitizeHTML(f.tipo)}</span></td>
              <td style="padding:8px; border-bottom:1px solid #f1f5f9; text-align:right"><b>${fmt(f.real)}</b></td>
            </tr>
          `).join('')}
          ${com.map(c => `
            <tr>
              <td style="padding:8px; border-bottom:1px solid #f1f5f9">${fmtDate(c.data)}</td>
              <td style="padding:8px; border-bottom:1px solid #f1f5f9">${sanitizeHTML(c.mat)} (Ref: ${sanitizeHTML(c.num)})</td>
              <td style="padding:8px; border-bottom:1px solid #f1f5f9"><span style="color:#64748b; font-size:10px; text-transform:uppercase">MATERIAL</span></td>
              <td style="padding:8px; border-bottom:1px solid #f1f5f9; text-align:right"><b>${fmt(c.vtotal)}</b></td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div style="margin-top:50px; text-align:center; border-top: 1px dashed #cbd5e1; padding-top: 30px; font-size:12px; color:#94a3b8">
        Documento gerado eletronicamente em conformidade com os registros de canteiro do Obra Real.<br>
        Relatório para fins de vistoria e acompanhamento técnico interno.
      </div>
    </div>
    <div style="margin-top:20px; text-align:center">
      <button class="btn btn-primary" onclick="window.print()">🖨️ Imprimir Laudo / Salvar PDF</button>
      <button class="btn btn-secondary" onclick="renderRelatorios()" style="margin-left:10px">🔙 Voltar</button>
    </div>
  `;

  safeSetInner('rel-preview-area', html);
}


window.generateAuditReport = generateAuditReport;

async function saveOrcamento() {
  const qtd = parseFloat(document.getElementById('oc-qtd').value) || 0;
  const vunit = parseFloat(document.getElementById('oc-vunit').value) || 0;
  const data = {
    obra: document.getElementById('oc-obra').value,
    etapa: document.getElementById('oc-etapa').value,
    tipo: document.getElementById('oc-tipo').value,
    desc: document.getElementById('oc-desc').value,
    qtd, unid: document.getElementById('oc-unid').value,
    vunit, vtotal: qtd * vunit, vreal: 0,
    obs: document.getElementById('oc-obs').value
  };
  const editIdx = parseInt(document.getElementById('oc-edit-idx').value) || -1;
  if (editIdx >= 0) {
    if (DB.orcamento[editIdx].vreal !== undefined) {
      data.vreal = DB.orcamento[editIdx].vreal;
    }
    DB.orcamento[editIdx] = data;
    toast('Item de orçamento atualizado!');
  } else {
    DB.orcamento.push(data);
    toast('Item de orçamento salvo!');
  }
  closeModal('modal-orcamento'); 
  await persistDB(); 
  renderOrcamento();
}

async function editOrcamento(idx) {
  await openModal('modal-orcamento');
  document.getElementById('oc-edit-idx').value = idx;
  const o = DB.orcamento[idx];
  document.getElementById('oc-obra').value = o.obra;
  document.getElementById('oc-etapa').value = o.etapa;
  document.getElementById('oc-tipo').value = o.tipo;
  document.getElementById('oc-desc').value = o.desc;
  document.getElementById('oc-qtd').value = o.qtd;
  document.getElementById('oc-unid').value = o.unid;
  document.getElementById('oc-vunit').value = o.vunit;
  document.getElementById('oc-vtotal').value = o.vtotal;
  document.getElementById('oc-obs').value = o.obs || '';
}

function calcOrcTotal() {
  const q = parseFloat(document.getElementById('oc-qtd').value) || 0;
  const u = parseFloat(document.getElementById('oc-vunit').value) || 0;
  const target = document.getElementById('oc-vtotal');
  if (target) target.value = (q * u).toFixed(2);
}

window.saveOrcamento = saveOrcamento;
window.editOrcamento = editOrcamento;
window.calcOrcTotal = calcOrcTotal;
