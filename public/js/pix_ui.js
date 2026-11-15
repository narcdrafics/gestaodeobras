/**
 * Obra Real - UI Logic for PIX Payments
 * v20260402001
 */

let activePixTransaction = null;

async function initiatePixPayment(source, idx, opts = {}) {
    let amount = 0;
    let receiver = '';
    let pixKey = '';
    let keyType = null;
    let description = '';
    const customAmount = Number(opts && opts.amount);
    const hasCustomAmount = Number.isFinite(customAmount) && customAmount > 0;

    if (source === 'pre') {
        const p = DB.presenca[idx];
        if (!p) { toast('Registro não encontrado. Recarregue a página.', 'error'); return; }
        const t = DB.trabalhadores.find(x => x.cod === p.trab);
        const total = window.getPresencaCusto ? window.getPresencaCusto(p) : (parseFloat(p.total) || 0);
        const pago = p.pgtoStatus === 'Parcial' ? (parseFloat(p.valpago) || 0) : 0;
        amount = hasCustomAmount ? customAmount : Math.max(0, total - pago);
        receiver = t ? t.nome : (p.nome || 'TRABALHADOR');
        pixKey = t ? (t.pixkey || '') : '';
        keyType = t ? (t.pixtipo || null) : null;
        description = `DIARIA ${p.data} ${p.nome}`;

    } else if (source === 'lote') {
        const item = window.lotePendentes?.[idx];
        if (!item) { toast('Item de lote não encontrado.', 'error'); return; }
        const t = DB.trabalhadores.find(x => x.cod === item.chave);
        amount = parseFloat(item.valor) || 0;
        receiver = item.nome || 'TRABALHADOR';
        pixKey = t ? (t.pixkey || '') : '';
        keyType = t ? (t.pixtipo || null) : null;
        description = `FOLHA ${item.diarias} DIARIAS - ${item.nome}`;

    } else if (source === 'med') {
        const m = DB.medicao[idx];
        if (!m) { toast('Medição não encontrada. Recarregue a página.', 'error'); return; }
        const total = parseFloat(m.vtotal) || 0;
        const pago = m.pgtoStatus === 'Parcial' ? (parseFloat(m.valpago) || 0) : 0;
        amount = hasCustomAmount ? customAmount : Math.max(0, total - pago);
        receiver = m.equipe || 'EQUIPE';
        pixKey = '';
        description = `MEDICAO ${m.servico}`;

    } else if (source === 'fin') {
        const f = DB.financeiro[idx];
        if (!f) { toast('Lançamento não encontrado. Recarregue a página.', 'error'); return; }
        // Usa o valor realizado se > 0; caso contrário usa o previsto
        const total = (parseFloat(f.real) > 0) ? parseFloat(f.real) : (parseFloat(f.prev) || 0);
        const pago = f.status === 'Parcial' ? (parseFloat(f.valpago) || 0) : 0;
        amount = hasCustomAmount ? customAmount : Math.max(0, total - pago);
        receiver = f.forn || 'FORNECEDOR';
        pixKey = f.pixkey || '';
        const t = f.trab ? DB.trabalhadores.find(x => x.cod === f.trab) : DB.trabalhadores.find(x => x.nome === f.forn);
        keyType = t ? (t.pixtipo || null) : null;
        if (!pixKey && t) {
            pixKey = t.pixkey || '';
        }
        description = f.desc || 'PAGAMENTO';

    } else if (source === 'alm') {
        const a = DB.almocos[idx];
        if (!a) { toast('Almoço não encontrado. Recarregue a página.', 'error'); return; }
        const total = parseFloat(a.vtotal) || 0;
        const pago = a.pgtoStatus === 'Parcial' ? (parseFloat(a.valpago) || 0) : 0;
        amount = hasCustomAmount ? customAmount : Math.max(0, total - pago);
        receiver = a.empreiteiro || 'EQUIPE';
        pixKey = '';
        description = `ALMOCO ${a.data} ${a.empreiteiro}`;
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

    const payload = generatePixPayload(pixKey, amount, receiver, 'SAO PAULO', description, keyType);
    
    if (!payload) {
        toast('Erro ao gerar payload PIX. Verifique a chave.', 'error');
        return;
    }

    activePixTransaction = { source, idx, amount, receiver, bulk: !!(opts && opts.bulk) };

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
    
    const { source, idx, amount, bulk } = activePixTransaction;
    
    if (source === 'pre') {
        const p = DB.presenca[idx];
        if (p) {
            const pago = p.pgtoStatus === 'Parcial' ? (parseFloat(p.valpago) || 0) : 0;
            p.pgtoStatus = 'Pago';
            p.valpago = pago + amount;
        }
    } else if (source === 'lote') {
        const item = window.lotePendentes?.[idx];
        if (item) {
            item.indices.forEach(p => { p.pgtoStatus = 'Pago'; p.valpago = p.total; });
            window.lotePendentes.splice(idx, 1);
            renderLoteTbody && renderLoteTbody();
        }
    } else if (source === 'med') {
        const m = DB.medicao[idx];
        if (m) {
            const pago = m.pgtoStatus === 'Parcial' ? (parseFloat(m.valpago) || 0) : 0;
            m.pgtoStatus = 'Pago';
            m.valpago = pago + amount;
        }
    } else if (source === 'fin') {
        const f = DB.financeiro[idx];
        if (f) {
            const pago = f.status === 'Parcial' ? (parseFloat(f.valpago) || 0) : 0;
            f.status = 'Pago';
            f.valpago = pago + amount;
        }
    } else if (source === 'alm') {
        const a = DB.almocos[idx];
        if (a) {
            const pago = a.pgtoStatus === 'Parcial' ? (parseFloat(a.valpago) || 0) : 0;
            a.pgtoStatus = 'Pago';
            a.valpago = pago + amount;
        }
    }
    
    toast('Pagamento confirmado com sucesso!');
    activePixTransaction = null;
    closeModal('modal-pix-view');
    await persistDB();
    renderFinanceiro && renderFinanceiro();
    renderDashboard && renderDashboard();
    renderAlmocos && renderAlmocos();
    renderPresenca && renderPresenca();

    if (bulk && window._finPixQueue) {
        setTimeout(() => {
            if (typeof openNextFinPix === 'function') openNextFinPix();
        }, 250);
    }
}

function cancelPixPayment() {
    if (typeof cancelFinPixQueue === 'function') cancelFinPixQueue();
    activePixTransaction = null;
    closeModal('modal-pix-view');
}

window.initiatePixPayment = initiatePixPayment;
window.confirmPixPaid = confirmPixPaid;
window.cancelPixPayment = cancelPixPayment;
