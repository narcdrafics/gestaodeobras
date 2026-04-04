/**
 * Obra Real - UI Logic for PIX Payments
 * v20260402001
 */

let activePixTransaction = null;

async function initiatePixPayment(source, idx) {
    let amount = 0;
    let receiver = '';
    let pixKey = '';
    let description = '';

    if (source === 'pre') {
        const p = DB.presenca[idx];
        if (!p) { toast('Registro não encontrado. Recarregue a página.', 'error'); return; }
        const t = DB.trabalhadores.find(x => x.cod === p.trab);
        amount = parseFloat(p.total) || 0;
        receiver = t ? t.nome : (p.nome || 'TRABALHADOR');
        pixKey = t ? (t.pixkey || '') : '';
        description = `DIARIA ${p.data} ${p.nome}`;

    } else if (source === 'lote') {
        const item = window.lotePendentes?.[idx];
        if (!item) { toast('Item de lote não encontrado.', 'error'); return; }
        const t = DB.trabalhadores.find(x => x.cod === item.chave);
        amount = parseFloat(item.valor) || 0;
        receiver = item.nome || 'TRABALHADOR';
        pixKey = t ? (t.pixkey || '') : '';
        description = `FOLHA ${item.diarias} DIARIAS - ${item.nome}`;

    } else if (source === 'med') {
        const m = DB.medicao[idx];
        if (!m) { toast('Medição não encontrada. Recarregue a página.', 'error'); return; }
        amount = parseFloat(m.vtotal) || 0;
        receiver = m.equipe || 'EQUIPE';
        pixKey = '';
        description = `MEDICAO ${m.servico}`;

    } else if (source === 'fin') {
        const f = DB.financeiro[idx];
        if (!f) { toast('Lançamento não encontrado. Recarregue a página.', 'error'); return; }
        // Usa o valor realizado se > 0; caso contrário usa o previsto
        amount = (parseFloat(f.real) > 0) ? parseFloat(f.real) : parseFloat(f.prev) || 0;
        receiver = f.forn || 'FORNECEDOR';
        pixKey = f.pixkey || '';
        description = f.desc || 'PAGAMENTO';
    }

    // Garante valor maior que zero antes de prosseguir
    if (!amount || amount <= 0) {
        toast('Informe o Valor Realizado antes de gerar o PIX.', 'error');
        return;
    }

    if (!pixKey) {
        pixKey = prompt(`Digite a Chave PIX para ${receiver}:`, "");
        if (!pixKey) return;
    }

    const payload = generatePixPayload(pixKey, amount, receiver, 'SAO PAULO', description);
    
    if (!payload) {
        toast('Erro ao gerar payload PIX. Verifique a chave.', 'error');
        return;
    }

    activePixTransaction = { source, idx, amount, receiver };

    await openModal('modal-pix-view');
    
    document.getElementById('pix-dest-name').textContent = receiver;
    document.getElementById('pix-dest-val').textContent = fmt(amount);
    document.getElementById('pix-string-display').textContent = payload;
    
    // QR Code com fallback para falhas de rede (especialmente no mobile)
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=10&data=${encodeURIComponent(payload)}`;
    document.getElementById('pix-qr-container').innerHTML = `
        <img src="${qrUrl}" alt="QR Code PIX" 
             style="width:200px; height:200px;"
             onerror="this.parentElement.innerHTML='<div style=\\'width:200px;height:200px;display:flex;flex-direction:column;align-items:center;justify-content:center;border:2px dashed #e2e8f0;color:#94a3b8;font-size:12px;text-align:center;padding:10px;\\'>⚠️ QR Code indisponível<br><small>Use a chave Copia e Cola abaixo</small></div>'">
    `;
}

async function confirmPixPaid() {
    if (!activePixTransaction) return;
    
    const { source, idx, amount } = activePixTransaction;
    
    if (source === 'pre') {
        const p = DB.presenca[idx];
        if (p) { p.pgtoStatus = 'Pago'; p.valpago = parseFloat(p.total) || amount; }
    } else if (source === 'lote') {
        const item = window.lotePendentes?.[idx];
        if (item) {
            item.indices.forEach(p => { p.pgtoStatus = 'Pago'; p.valpago = p.total; });
            window.lotePendentes.splice(idx, 1);
            renderLoteTbody && renderLoteTbody();
        }
    } else if (source === 'med') {
        const m = DB.medicao[idx];
        if (m) { m.pgtoStatus = 'Pago'; m.valpago = parseFloat(m.vtotal) || amount; }
    } else if (source === 'fin') {
        const f = DB.financeiro[idx];
        if (f) { f.status = 'Pago'; f.valpago = amount; }
    }
    
    toast('Pagamento confirmado com sucesso!');
    closeModal('modal-pix-view');
    await persistDB();
    renderFinanceiro && renderFinanceiro();
    renderDashboard && renderDashboard();
    
    activePixTransaction = null;
}
