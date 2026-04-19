// ==================== RELATÓRIOS MODULE ====================

function renderWorkerPaymentReport() {
  const selMonth = document.getElementById('fin-month');
  const selYear = document.getElementById('fin-year');
  
  if (!selMonth || !selYear) return;
  
  const mm = selMonth.value;
  const yy = selYear.value;
  
  const report = window.generateWorkerPaymentReport(DB.presenca, DB.medicao, DB.trabalhadores, yy, mm);
  
  if (!report || (report.workers.length === 0 && report.contractors.length === 0)) {
    safeSetInner('worker-report-content', `
      <div style="padding:20px; text-align:center; color:var(--text3)">
        <div style="font-size:32px; margin-bottom:8px">📭</div>
        <div>Nenhum pagamento registrado neste mês</div>
      </div>
    `);
    return;
  }
  
  let html = `
    <div style="padding:12px; background:var(--bg2); border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
      <div>
        <span style="font-weight:600; color:var(--text2)">Total Geral:</span>
        <span style="font-size:18px; font-weight:800; color:var(--green); margin-left:8px">${fmt(report.grandTotal)}</span>
      </div>
      <div style="font-size:13px; color:var(--text3)">
        Período: ${sanitizeHTML(report.period)}
      </div>
    </div>
  `;
  
  if (report.workers.length > 0) {
    html += `
      <div style="padding:12px; background:var(--bg3); border-bottom:1px solid var(--border)">
        <div style="display:flex; justify-content:space-between; align-items:center">
          <h4 style="margin:0; color:var(--accent)">👷 Trabalhadores (Diárias)</h4>
          <span style="font-weight:700; color:var(--green)">${fmt(report.totalWorkers)}</span>
        </div>
      </div>
      <table style="width:100%; border-collapse:collapse; font-size:13px">
        <thead>
          <tr style="background:var(--bg2); text-align:left">
            <th style="padding:8px; border-bottom:1px solid var(--border)">Nome</th>
            <th style="padding:8px; border-bottom:1px solid var(--border)">Função</th>
            <th style="padding:8px; border-bottom:1px solid var(--border)">Equipe</th>
            <th style="padding:8px; border-bottom:1px solid var(--border); text-align:center">Dias</th>
            <th style="padding:8px; border-bottom:1px solid var(--border); text-align:right">Total Pago</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    report.workers.forEach(w => {
      html += `
        <tr style="border-bottom:1px solid var(--border)">
          <td style="padding:8px; font-weight:600">${sanitizeHTML(w.nome)}</td>
          <td style="padding:8px; color:var(--text2)">${sanitizeHTML(w.funcao || '—')}</td>
          <td style="padding:8px; color:var(--text2)">${sanitizeHTML(w.equipe || '—')}</td>
          <td style="padding:8px; text-align:center">${w.dias}</td>
          <td style="padding:8px; text-align:right; font-weight:700; color:var(--green)">${fmt(w.total)}</td>
        </tr>
      `;
    });
    
    html += `
        </tbody>
        <tfoot>
          <tr style="background:var(--bg2); font-weight:700">
            <td colspan="4" style="padding:8px; text-align:right">Subtotal Trabalhadores:</td>
            <td style="padding:8px; text-align:right; color:var(--green)">${fmt(report.totalWorkers)}</td>
          </tr>
        </tfoot>
      </table>
    `;
  }
  
  if (report.contractors.length > 0) {
    html += `
      <div style="padding:12px; background:var(--bg3); border-bottom:1px solid var(--border); margin-top:12px">
        <div style="display:flex; justify-content:space-between; align-items:center">
          <h4 style="margin:0; color:var(--accent)">🔨 Empreiteiros (Medições)</h4>
          <span style="font-weight:700; color:var(--green)">${fmt(report.totalContractors)}</span>
        </div>
      </div>
      <table style="width:100%; border-collapse:collapse; font-size:13px">
        <thead>
          <tr style="background:var(--bg2); text-align:left">
            <th style="padding:8px; border-bottom:1px solid var(--border)">Equipe/Empreiteiro</th>
            <th style="padding:8px; border-bottom:1px solid var(--border)">Serviço</th>
            <th style="padding:8px; border-bottom:1px solid var(--border); text-align:center">Medições</th>
            <th style="padding:8px; border-bottom:1px solid var(--border); text-align:right">Total Pago</th>
          </tr>
        </thead>
        <tbody>`;
    
    report.contractors.forEach(c => {
      html += `
        <tr style="border-bottom:1px solid var(--border)">
          <td style="padding:8px; font-weight:600">${sanitizeHTML(c.equipe)}</td>
          <td style="padding:8px; color:var(--text2)">${sanitizeHTML(c.servico || '—')}</td>
          <td style="padding:8px; text-align:center">${c.medicoes}</td>
          <td style="padding:8px; text-align:right; font-weight:700; color:var(--green)">${fmt(c.total)}</td>
        </tr>
      `;
    });
    
    html += `
        </tbody>
        <tfoot>
          <tr style="background:var(--bg2); font-weight:700">
            <td colspan="3" style="padding:8px; text-align:right">Subtotal Empreiteiros:</td>
            <td style="padding:8px; text-align:right; color:var(--green)">${fmt(report.totalContractors)}</td>
          </tr>
        </tfoot>
      </table>
    `;
  }
  
  html += `
    <div style="padding:12px; background:var(--accent); color:white; border-radius:0 0 8px 8px; display:flex; justify-content:space-between; align-items:center">
      <span style="font-weight:700">TOTAL GERAL</span>
      <span style="font-size:18px; font-weight:800">${fmt(report.grandTotal)}</span>
    </div>
  `;
  
  safeSetInner('worker-report-content', html);
  window._lastWorkerReport = report;
}

window.renderWorkerPaymentReport = renderWorkerPaymentReport;

function toggleWorkerReport() {
  const content = document.getElementById('worker-report-content');
  if (content) {
    content.style.display = content.style.display === 'none' ? 'block' : 'none';
  }
}

window.toggleWorkerReport = toggleWorkerReport;

function copyWorkerReport() {
  const report = window._lastWorkerReport;
  if (!report) {
    toast('Gere o relatório primeiro', 'error');
    return;
  }
  
  let text = `RELATÓRIO DE PAGAMENTOS - ${report.period}\n`;
  text += `${'='.repeat(50)}\n\n`;
  
  if (report.workers.length > 0) {
    text += `TRABALHADORES (DIÁRIAS)\n`;
    text += `${'-'.repeat(50)}\n`;
    report.workers.forEach(w => {
      text += `${w.nome} | ${w.funcao || '-'} | ${w.dias} dias | ${fmt(w.total)}\n`;
    });
    text += `\nSubtotal Trabalhadores: ${fmt(report.totalWorkers)}\n\n`;
  }
  
  if (report.contractors.length > 0) {
    text += `EMPREITEIROS (MEDIÇÕES)\n`;
    text += `${'-'.repeat(50)}\n`;
    report.contractors.forEach(c => {
      text += `${c.equipe} | ${c.servico || '-'} | ${c.medicoes} medições | ${fmt(c.total)}\n`;
    });
    text += `\nSubtotal Empreiteiros: ${fmt(report.totalContractors)}\n\n`;
  }
  
  text += `${'='.repeat(50)}\n`;
  text += `TOTAL GERAL: ${fmt(report.grandTotal)}\n`;
  
  navigator.clipboard.writeText(text).then(() => {
    toast('Relatório copiado!', 'success');
  }).catch(() => {
    toast('Erro ao copiar', 'error');
  });
}

window.copyWorkerReport = copyWorkerReport;

function renderDetailedWeeklyPaymentReport() {
  const selMonth = document.getElementById('fin-month');
  const selYear = document.getElementById('fin-year');
  
  if (!selMonth || !selYear) return;
  
  const mm = selMonth.value;
  const yy = selYear.value;
  
  const report = window.generateDetailedWeeklyPaymentReport(DB.presenca, DB.medicao, DB.trabalhadores, yy, mm);
  
  if (!report || (report.workers.length === 0 && report.contractors.length === 0)) {
    safeSetInner('detailed-weekly-report-content', `
      <div style="padding:20px; text-align:center; color:var(--text3)">
        <div style="font-size:32px; margin-bottom:8px">📭</div>
        <div>Nenhum pagamento registrado neste mês</div>
      </div>
    `);
    return;
  }
  
  let html = `
    <div style="padding:12px; background:var(--bg2); border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
      <div>
        <span style="font-weight:600; color:var(--text2)">Total Geral:</span>
        <span style="font-size:18px; font-weight:800; color:var(--green); margin-left:8px">${fmt(report.grandTotal)}</span>
      </div>
      <div style="font-size:13px; color:var(--text3)">
        Período: ${sanitizeHTML(report.period)} | ${report.weeks.length} semana(s)
      </div>
    </div>
  `;
  
  if (report.workers.length > 0) {
    html += `
      <div style="padding:12px; background:var(--bg3); border-bottom:1px solid var(--border)">
        <div style="display:flex; justify-content:space-between; align-items:center">
          <h4 style="margin:0; color:var(--accent)">👷 Trabalhadores (Diárias)</h4>
          <span style="font-weight:700; color:var(--green)">${fmt(report.totalWorkers)}</span>
        </div>
      </div>
      <div style="overflow-x: auto">
        <table style="width:100%; border-collapse:collapse; font-size:12px; min-width: 600px">
          <thead>
            <tr style="background:var(--bg2); text-align:left">
              <th style="padding:8px; border-bottom:1px solid var(--border); position:sticky; left:0; background:var(--bg2); z-index:1">Nome</th>
              <th style="padding:8px; border-bottom:1px solid var(--border)">Função</th>`;
    
    report.weeks.forEach(week => {
      html += `<th style="padding:8px; border-bottom:1px solid var(--border); text-align:center; min-width:100px">${sanitizeHTML(week)}</th>`;
    });
    
    html += `
              <th style="padding:8px; border-bottom:1px solid var(--border); text-align:right">Total</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    report.workers.forEach(w => {
      html += `
        <tr style="border-bottom:1px solid var(--border)">
          <td style="padding:8px; font-weight:600; position:sticky; left:0; background:var(--bg); z-index:1">${sanitizeHTML(w.nome)}</td>
          <td style="padding:8px; color:var(--text2)">${sanitizeHTML(w.funcao || '—')}</td>
      `;
      
      report.weeks.forEach(week => {
        const weekData = w.weekly[week];
        if (weekData && weekData.total > 0) {
          html += `<td style="padding:8px; text-align:center">
            <div style="font-weight:600">${fmt(weekData.total)}</div>
            <div style="font-size:10px; color:var(--text3)">${weekData.dias} dias</div>
          </td>`;
        } else {
          html += `<td style="padding:8px; text-align:center; color:var(--text3)">—</td>`;
        }
      });
      
      html += `
          <td style="padding:8px; text-align:right; font-weight:700; color:var(--green)">${fmt(w.total)}</td>
        </tr>
      `;
    });
    
    html += `
          <tr style="background:var(--bg2); font-weight:700">
            <td colspan="2" style="padding:8px; text-align:right">Subtotal:</td>
    `;
    
    report.weeks.forEach(week => {
      const weekTotal = report.weeklyTotals[week]?.workers || 0;
      html += `<td style="padding:8px; text-align:center; color:var(--accent)">${fmt(weekTotal)}</td>`;
    });
    
    html += `
            <td style="padding:8px; text-align:right; color:var(--green)">${fmt(report.totalWorkers)}</td>
          </tr>
        </tbody>
      </table>
      </div>
    `;
  }
  
  if (report.contractors.length > 0) {
    html += `
      <div style="padding:12px; background:var(--bg3); border-bottom:1px solid var(--border); margin-top:12px">
        <div style="display:flex; justify-content:space-between; align-items:center">
          <h4 style="margin:0; color:var(--accent)">🔨 Empreiteiros (Medições)</h4>
          <span style="font-weight:700; color:var(--green)">${fmt(report.totalContractors)}</span>
        </div>
      </div>
      <div style="overflow-x: auto">
        <table style="width:100%; border-collapse:collapse; font-size:12px; min-width: 600px">
          <thead>
            <tr style="background:var(--bg2); text-align:left">
              <th style="padding:8px; border-bottom:1px solid var(--border); position:sticky; left:0; background:var(--bg2); z-index:1">Equipe</th>
              <th style="padding:8px; border-bottom:1px solid var(--border)">Serviço</th>
    `;
    
    report.weeks.forEach(week => {
      html += `<th style="padding:8px; border-bottom:1px solid var(--border); text-align:center; min-width:100px">${sanitizeHTML(week)}</th>`;
    });
    
    html += `
              <th style="padding:8px; border-bottom:1px solid var(--border); text-align:right">Total</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    report.contractors.forEach(c => {
      html += `
        <tr style="border-bottom:1px solid var(--border)">
          <td style="padding:8px; font-weight:600; position:sticky; left:0; background:var(--bg); z-index:1">${sanitizeHTML(c.equipe)}</td>
          <td style="padding:8px; color:var(--text2)">${sanitizeHTML(c.servico || '—')}</td>
      `;
      
      report.weeks.forEach(week => {
        const weekData = c.weekly[week];
        if (weekData && weekData.total > 0) {
          html += `<td style="padding:8px; text-align:center">
            <div style="font-weight:600">${fmt(weekData.total)}</div>
            <div style="font-size:10px; color:var(--text3)">${weekData.medicoes} med.</div>
          </td>`;
        } else {
          html += `<td style="padding:8px; text-align:center; color:var(--text3)">—</td>`;
        }
      });
      
      html += `
          <td style="padding:8px; text-align:right; font-weight:700; color:var(--green)">${fmt(c.total)}</td>
        </tr>
      `;
    });
    
    html += `
          <tr style="background:var(--bg2); font-weight:700">
            <td colspan="2" style="padding:8px; text-align:right">Subtotal:</td>
    `;
    
    report.weeks.forEach(week => {
      const weekTotal = report.weeklyTotals[week]?.contractors || 0;
      html += `<td style="padding:8px; text-align:center; color:var(--accent)">${fmt(weekTotal)}</td>`;
    });
    
    html += `
            <td style="padding:8px; text-align:right; color:var(--green)">${fmt(report.totalContractors)}</td>
          </tr>
        </tbody>
      </table>
      </div>
    `;
  }
  
  html += `
    <div style="padding:12px; background:var(--bg3); border-radius:0 0 8px 8px; margin-top:12px">
      <div style="font-weight:700; margin-bottom:8px; color:var(--accent)">TOTAL POR SEMANA</div>
      <div style="display:flex; flex-wrap:wrap; gap:12px">`;
  
  report.weeks.forEach(week => {
    const weekTotal = report.weeklyTotals[week]?.total || 0;
    html += `
      <div style="background:var(--bg); padding:8px 12px; border-radius:6px; min-width:120px">
        <div style="font-size:11px; color:var(--text3)">${sanitizeHTML(week)}</div>
        <div style="font-weight:700; color:var(--green)">${fmt(weekTotal)}</div>
      </div>
    `;
  });
  
  html += `
      </div>
    </div>
    <div style="padding:12px; background:var(--accent); color:white; border-radius:0 0 8px 8px; margin-top:12px; display:flex; justify-content:space-between; align-items:center">
      <span style="font-weight:700">TOTAL GERAL</span>
      <span style="font-size:18px; font-weight:800">${fmt(report.grandTotal)}</span>
    </div>
  `;
  
  safeSetInner('detailed-weekly-report-content', html);
  window._lastDetailedReport = report;
}

window.renderDetailedWeeklyPaymentReport = renderDetailedWeeklyPaymentReport;

function toggleDetailedWeeklyReport() {
  const content = document.getElementById('detailed-weekly-report-content');
  if (content) {
    content.style.display = content.style.display === 'none' ? 'block' : 'none';
  }
}

window.toggleDetailedWeeklyReport = toggleDetailedWeeklyReport;

function copyDetailedWeeklyReport() {
  const report = window._lastDetailedReport;
  if (!report) {
    toast('Gere o relatório primeiro', 'error');
    return;
  }
  
  let text = `PAGAMENTOS SEMANAIS - ${report.period}\n`;
  text += `${'='.repeat(60)}\n\n`;
  
  if (report.workers.length > 0) {
    text += `TRABALHADORES (DIÁRIAS)\n`;
    text += `${'-'.repeat(60)}\n`;
    text += `Nome`.padEnd(25) + `Função`.padEnd(15);
    report.weeks.forEach(w => text += w.substring(0, 10).padEnd(12));
    text += `Total\n`;
    
    report.workers.forEach(w => {
      text += `${w.nome.substring(0, 24).padEnd(25)}${(w.funcao || '').substring(0, 14).padEnd(15)}`;
      report.weeks.forEach(week => {
        text += (fmt(w.weekly[week]?.total || 0)).padEnd(12);
      });
      text += `${fmt(w.total)}\n`;
    });
    text += `\n`;
  }
  
  text += `TOTAL GERAL: ${fmt(report.grandTotal)}\n`;
  
  navigator.clipboard.writeText(text).then(() => {
    toast('Relatório copiado!', 'success');
  }).catch(() => {
    toast('Erro ao copiar', 'error');
  });
}

window.copyDetailedWeeklyReport = copyDetailedWeeklyReport;

function printDetailedWeeklyReport() {
  const report = window._lastDetailedReport;
  if (!report) {
    toast('Gere o relatório primeiro', 'error');
    return;
  }
  window.print();
}

window.printDetailedWeeklyReport = printDetailedWeeklyReport;

const getRelObraName = (c) => { 
  const o = DB.obras.find(x => x.cod === c); 
  return o ? o.nome : c; 
};

function printEmployeePaymentReport() {
  const obraCod = document.getElementById('rel-obra').value;
  const month = document.getElementById('rel-month').value;
  const year = document.getElementById('rel-year').value;
  
  if (!window.generateWorkerPaymentReport) {
    toast('Erro: Função de cálculo não encontrada.', 'error');
    return;
  }

  const report = window.generateWorkerPaymentReport(DB.presenca, DB.medicao, DB.trabalhadores, year, month);
  
  let workers = report.workers;
  if (obraCod) {
    workers = workers.filter(w => {
      return DB.presenca.some(p => (p.trab === w.cod || p.nome === w.nome) && p.obra === obraCod && p.data.startsWith(`${year}-${month.padStart(2, '0')}`));
    });
  }

  const totalFiltered = workers.reduce((sum, w) => sum + w.total, 0);

  let html = `
    <div id="print-area" style="padding: 40px; background: white; color: #1e293b; font-family: 'IBM Plex Sans', sans-serif; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); border: 1px solid #e2e8f0;">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px;">
        <div style="flex:1">
          <h1 style="margin:0; font-size:22px; color:#0f172a; text-transform:uppercase; letter-spacing:-0.5px">Extrato de Pagamentos (Funcionários)</h1>
          <p style="margin:5px 0; color:#64748b; font-weight:500; font-size:14px">Período: ${month}/${year} ${obraCod ? `| Obra: ${getRelObraName(obraCod)}` : '| Consolidado Geral'}</p>
        </div>
        <div style="text-align:right">
          <p style="margin:0; font-size:14px; font-weight:700; color:var(--accent)">OBRA REAL — GESTÃO PRO</p>
          <p style="margin:0; font-size:12px; color:#94a3b8">${new Date().toLocaleDateString('pt-BR')}</p>
        </div>
      </div>

      <table style="width:100%; border-collapse: collapse; font-size:13px">
        <thead>
          <tr style="background:#f8fafc; text-align:left">
            <th style="padding:12px; border-bottom:2px solid #e2e8f0; color:#475569">Colaborador</th>
            <th style="padding:12px; border-bottom:2px solid #e2e8f0; color:#475569">Função/Equipe</th>
            <th style="padding:12px; border-bottom:2px solid #e2e8f0; text-align:center; color:#475569">Dias Trab.</th>
            <th style="padding:12px; border-bottom:2px solid #e2e8f0; text-align:right; color:#475569">Total Pago</th>
          </tr>
        </thead>
        <tbody>
          ${workers.sort((a,b) => b.total - a.total).map(w => `
            <tr>
              <td style="padding:12px; border-bottom:1px solid #f1f5f9"><b>${w.nome.toUpperCase()}</b></td>
              <td style="padding:12px; border-bottom:1px solid #f1f5f9; color:#64748b">${sanitizeHTML(w.funcao || '—')}</td>
              <td style="padding:12px; border-bottom:1px solid #f1f5f9; text-align:center"><b>${w.dias}</b></td>
              <td style="padding:12px; border-bottom:1px solid #f1f5f9; text-align:right; font-family:'IBM Plex Mono',monospace"><b>${fmt(w.total)}</b></td>
            </tr>
          `).join('')}
          ${workers.length === 0 ? '<tr><td colspan="4" style="padding:30px; text-align:center; color:#94a3b8"><i>Nenhum registro encontrado para os filtros selecionados.</i></td></tr>' : ''}
        </tbody>
        <tfoot>
          <tr style="background:#f8fafc; font-weight:700; font-size:16px">
            <td colspan="3" style="padding:18px; text-align:right; color:#1e293b">RESUMO TOTAL:</td>
            <td style="padding:18px; text-align:right; color:#10b981; font-family:'IBM Plex Mono',monospace">${fmt(totalFiltered)}</td>
          </tr>
        </tfoot>
      </table>

      <div style="margin-top:60px; display:flex; justify-content:space-around">
        <div style="text-align:center; width:200px; border-top:1px solid #94a3b8; padding-top:10px; font-size:11px; color:#64748b">Responsável Administrativo</div>
        <div style="text-align:center; width:200px; border-top:1px solid #94a3b8; padding-top:10px; font-size:11px; color:#64748b">Conferência de Campo</div>
      </div>
    </div>
    <div style="margin-top:30px; text-align:center" class="no-print">
      <button class="btn btn-primary" onclick="window.print()">🖨️ Imprimir / Gerar PDF</button>
      <button class="btn btn-secondary" onclick="renderRelatorios()" style="margin-left:10px">🔙 Voltar</button>
    </div>
  `;

  safeSetInner('rel-preview-area', html);
}

function printWeeklySummaryReport() {
  const obraCod = document.getElementById('rel-obra').value;
  const month = document.getElementById('rel-month').value;
  const year = document.getElementById('rel-year').value;
  
  if (!window.generateWeeklyPaymentReport) {
    toast('Erro: Função de cálculo semanal não encontrada.', 'error');
    return;
  }

  const report = window.generateWeeklyPaymentReport(DB.financeiro, DB.presenca, DB.medicao, DB.almocos, year, month);

  const filteredReport = report.map(w => {
    let items = w.items;
    if (obraCod) items = items.filter(i => i.obra === obraCod);
    const total = items.reduce((a, b) => a + (b.real || 0), 0);
    return { ...w, items, total, count: items.length };
  }).filter(w => w.count > 0);

  const totalGeral = filteredReport.reduce((a, b) => a + b.total, 0);

  let html = `
    <div id="print-area" style="padding: 40px; background: white; color: #1e293b; font-family: 'IBM Plex Sans', sans-serif; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); border: 1px solid #e2e8f0;">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px;">
        <div style="flex:1">
          <h1 style="margin:0; font-size:22px; color:#0f172a; text-transform:uppercase; letter-spacing:-0.5px">Fechamento Financeiro Semanal</h1>
          <p style="margin:5px 0; color:#64748b; font-weight:500; font-size:14px">Período: ${month}/${year} ${obraCod ? `| Obra: ${getRelObraName(obraCod)}` : '| Consolidado Geral'}</p>
        </div>
        <div style="text-align:right">
          <p style="margin:0; font-size:14px; font-weight:700; color:var(--accent2)">OBRA REAL — GESTÃO PRO</p>
          <p style="margin:0; font-size:12px; color:#94a3b8">${new Date().toLocaleDateString('pt-BR')}</p>
        </div>
      </div>

      <table style="width:100%; border-collapse: collapse; font-size:13px">
        <thead>
          <tr style="background:#f8fafc; text-align:left">
            <th style="padding:12px; border-bottom:2px solid #e2e8f0; color:#475569">Semana / Período</th>
            <th style="padding:12px; border-bottom:2px solid #e2e8f0; text-align:center; color:#475569">Lançamentos</th>
            <th style="padding:12px; border-bottom:2px solid #e2e8f0; text-align:right; color:#475569">Total da Semana</th>
          </tr>
        </thead>
        <tbody>
          ${filteredReport.map(w => `
            <tr>
              <td style="padding:15px; border-bottom:1px solid #f1f5f9">
                <b style="font-size:14px">${w.label.toUpperCase()}</b>
              </td>
              <td style="padding:15px; border-bottom:1px solid #f1f5f9; text-align:center">${w.count} registros</td>
              <td style="padding:15px; border-bottom:1px solid #f1f5f9; text-align:right; font-family:'IBM Plex Mono',monospace"><b>${fmt(w.total)}</b></td>
            </tr>
          `).join('')}
          ${filteredReport.length === 0 ? '<tr><td colspan="3" style="padding:30px; text-align:center; color:#94a3b8">Nenhum dado financeiro para o período.</td></tr>' : ''}
        </tbody>
        <tfoot>
          <tr style="background:#f8fafc; font-weight:700; font-size:16px">
            <td colspan="2" style="padding:20px; text-align:right; color:#1e293b">TOTAL CONSOLIDADO NO MÊS:</td>
            <td style="padding:20px; text-align:right; color:var(--accent2); font-family:'IBM Plex Mono',monospace">${fmt(totalGeral)}</td>
          </tr>
        </tfoot>
      </table>

      <div style="margin-top:60px; font-size:11px; color:#94a3b8; text-align:center; border-top: 1px dashed #cbd5e1; padding-top:20px">
        Relatório detalhado por semana (Diárias, Empreitadas e Gastos Fixos).
      </div>
    </div>
    <div style="margin-top:30px; text-align:center" class="no-print">
      <button class="btn btn-primary" onclick="window.print()">🖨️ Imprimir / Gerar PDF</button>
      <button class="btn btn-secondary" onclick="renderRelatorios()" style="margin-left:10px">🔙 Voltar</button>
    </div>
  `;

  safeSetInner('rel-preview-area', html);
}

function printPaidContractsReport() {
  const obraCod = document.getElementById('rel-obra').value;
  const month = document.getElementById('rel-month').value;
  const year = document.getElementById('rel-year').value;
  
  let paid = DB.medicao.filter(m => m.pgtoStatus === 'Pago' && (m.semana || m.data || '').startsWith(`${year}-${month.padStart(2, '0')}`));
  
  if (obraCod) {
    paid = paid.filter(m => m.obra === obraCod);
  }

  const total = paid.reduce((a, b) => a + (parseFloat(b.vtotal) || 0), 0);

  let html = `
    <div id="print-area" style="padding: 40px; background: white; color: #1e293b; font-family: 'IBM Plex Sans', sans-serif; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); border: 1px solid #e2e8f0;">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px;">
        <div style="flex:1">
          <h1 style="margin:0; font-size:22px; color:#0f172a; text-transform:uppercase; letter-spacing:-0.5px">Relatório de Empreitadas (Pagas)</h1>
          <p style="margin:5px 0; color:#64748b; font-weight:500; font-size:14px">Período: ${month}/${year} ${obraCod ? `| Obra: ${getRelObraName(obraCod)}` : '| Consolidado Geral'}</p>
        </div>
        <div style="text-align:right">
          <p style="margin:0; font-size:14px; font-weight:700; color:#f59e0b">OBRA REAL — GESTÃO PRO</p>
          <p style="margin:0; font-size:12px; color:#94a3b8">${new Date().toLocaleDateString('pt-BR')}</p>
        </div>
      </div>

      <table style="width:100%; border-collapse: collapse; font-size:13px">
        <thead>
          <tr style="background:#f8fafc; text-align:left">
            <th style="padding:12px; border-bottom:2px solid #e2e8f0; color:#475569">Serviço / Frente</th>
            <th style="padding:12px; border-bottom:2px solid #e2e8f0; color:#475569">Obra</th>
            <th style="padding:12px; border-bottom:2px solid #e2e8f0; color:#475569">Equipe / Responsável</th>
            <th style="padding:12px; border-bottom:2px solid #e2e8f0; text-align:right; color:#475569">Valor Pago</th>
          </tr>
        </thead>
        <tbody>
          ${paid.map(m => `
            <tr>
              <td style="padding:12px; border-bottom:1px solid #f1f5f9">
                <b style="color:#0f172a">${sanitizeHTML(m.servico.toUpperCase())}</b><br>
                <small style="color:#64748b">${sanitizeHTML(m.etapa || '')} ${m.frente ? `| ${sanitizeHTML(m.frente)}` : ''}</small>
              </td>
              <td style="padding:12px; border-bottom:1px solid #f1f5f9">${sanitizeHTML(getRelObraName(m.obra))}</td>
              <td style="padding:12px; border-bottom:1px solid #f1f5f9"><b>${sanitizeHTML(m.equipe || '—')}</b></td>
              <td style="padding:12px; border-bottom:1px solid #f1f5f9; text-align:right; font-family:'IBM Plex Mono',monospace"><b>${fmt(m.vtotal)}</b></td>
            </tr>
          `).join('')}
          ${paid.length === 0 ? '<tr><td colspan="4" style="padding:30px; text-align:center; color:#94a3b8">Nenhum contrato pago identificado no período.</td></tr>' : ''}
        </tbody>
        <tfoot>
          <tr style="background:#f8fafc; font-weight:700; font-size:16px">
            <td colspan="3" style="padding:20px; text-align:right; color:#1e293b">TOTAL PAGO EM EMPREITADAS:</td>
            <td style="padding:20px; text-align:right; color:#f59e0b; font-family:'IBM Plex Mono',monospace">${fmt(total)}</td>
          </tr>
        </tfoot>
      </table>

      <div style="margin-top:60px; font-size:11px; color:#94a3b8; text-align:center; border-top: 1px dashed #cbd5e1; padding-top:20px">
        Documento gerado a partir de medições com status de pagamento confirmado.
      </div>
    </div>
    <div style="margin-top:30px; text-align:center" class="no-print">
      <button class="btn btn-primary" onclick="window.print()">🖨️ Imprimir / Gerar PDF</button>
      <button class="btn btn-secondary" onclick="renderRelatorios()" style="margin-left:10px">🔙 Voltar</button>
    </div>
  `;

  safeSetInner('rel-preview-area', html);
}

window.getRelObraName = getRelObraName;
window.printEmployeePaymentReport = printEmployeePaymentReport;
window.printWeeklySummaryReport = printWeeklySummaryReport;
window.printPaidContractsReport = printPaidContractsReport;
