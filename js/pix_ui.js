/**
 * Obra Real - UI Logic for PIX Payments
 */

let activePixTransaction = null;

async function initiatePixPayment(source, idx) {
    let amount = 0;
    let receiver = '';
    let pixKey = '';
    let description = '';

    if (source === 'pre') {
        const p = DB.presenca[idx];
        const t = DB.trabalhadores.find(x => x.cod === p.trab);
        amount = p.total;
        receiver = t ? t.nome : p.nome;
        pixKey = t ? t.pixkey : '';
        description = `DIARIA ${p.data} ${p.nome}`;
    } else if (source === 'med') {
        const m = DB.medicao[idx];
        amount = m.vtotal;
        receiver = m.equipe || 'EQUIPE';
        pixKey = ''; // Medição geralmente precisa de cadastro prévio ou manual
        description = `MEDICAO ${m.servico}`;
    } else if (source === 'fin') {
        const f = DB.financeiro[idx];
        amount = f.real || f.prev;
        receiver = f.forn || 'FORNECEDOR';
        pixKey = f.pixkey || '';
        description = f.desc;
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
    
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=10&data=${encodeURIComponent(payload)}`;
    document.getElementById('pix-qr-container').innerHTML = `<img src="${qrUrl}" alt="QR Code PIX" style="width:200px; height:200px;">`;
}

async function confirmPixPaid() {
    if (!activePixTransaction) return;
    
    const { source, idx } = activePixTransaction;
    
    if (source === 'pre') {
        DB.presenca[idx].pgtoStatus = 'Pago';
    } else if (source === 'med') {
        DB.medicao[idx].pgtoStatus = 'Pago';
    } else if (source === 'fin') {
        DB.financeiro[idx].status = 'Pago';
    }
    
    toast('Pagamento confirmado com sucesso!');
    closeModal('modal-pix-view');
    await persistDB();
    renderFinanceiro();
    
    activePixTransaction = null;
}
