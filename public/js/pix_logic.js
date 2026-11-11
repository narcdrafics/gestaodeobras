/**
 * Obra Real - PIX Logic Helper
 * Gera payloads de PIX Estático (BRCode) para pagamentos rápidos.
 */

window.cleanPixKey = function(key, type = null) {
    if (!key) return '';
    let k = key.trim();

    // Se o tipo não for especificado, tenta detectar automaticamente
    if (!type) {
        if (k.includes('@')) {
            type = 'email';
        } else if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(k) || k.replace(/[^a-fA-F0-9]/g, '').length === 32) {
            type = 'aleatoria';
        } else {
            let digits = k.replace(/\D/g, '');
            if (digits.length === 11) {
                if (k.startsWith('+') || k.includes('(') || k.includes(')')) {
                    type = 'telefone';
                } else {
                    type = 'cpf';
                }
            } else if (digits.length === 14) {
                type = 'cnpj';
            } else if (digits.length === 10 || digits.length === 12 || digits.length === 13) {
                type = 'telefone';
            } else {
                type = 'aleatoria';
            }
        }
    }

    const lowerType = type.toLowerCase();
    if (lowerType === 'cpf' || lowerType === 'cnpj') {
        return k.replace(/\D/g, '');
    } else if (lowerType === 'telefone') {
        let digits = k.replace(/\D/g, '');
        if (digits.length === 10 || digits.length === 11) {
            return '+55' + digits;
        } else if (digits.length === 12 || digits.length === 13) {
            if (digits.startsWith('55')) {
                return '+' + digits;
            }
        }
        return '+' + digits;
    } else if (lowerType === 'email') {
        return k.toLowerCase();
    } else if (lowerType === 'aleatoria' || lowerType === 'aleatória') {
        return k.replace(/[^\w-]/g, '');
    }

    return k.replace(/[^\w@.-]/g, '');
};

window.generatePixPayload = function(key, amount, receiver, city = 'SAO PAULO', description = 'OBRA REAL', keyType = null) {
    if (!key) return null;
    
    // Limpeza inteligente da chave usando o tipo especificado ou auto-detecção
    let cleanKey = window.cleanPixKey(key, keyType);
    if (!cleanKey) return null;
    
    // Formatação de valor (precisa de 2 casas decimais com ponto)
    const amountStr = Number(amount).toFixed(2);
    
    // Helper para formatar campos do BRCode (ID + Tamanho + Valor)
    const f = (id, val) => {
        const v = String(val);
        return id + String(v.length).padStart(2, '0') + v;
    };

    // Construção do Payload conforme padrão BC
    let payload = '';
    payload += f('00', '01'); // Payload Format Indicator
    
    // Merchant Account Information (ID 26)
    let gui = f('00', 'br.gov.bcb.pix');
    let keyField = f('01', cleanKey);
    let info = f('02', description.substring(0, 25)); // Descrição opcional
    payload += f('26', gui + keyField + info);

    payload += f('52', '0000'); // Merchant Category Code
    payload += f('53', '986');  // Transaction Currency (BRL)
    payload += f('54', amountStr); // Transaction Amount
    payload += f('58', 'BR');   // Country Code
    payload += f('59', receiver.normalize("NFD").replace(/[\u0300-\u036f]/g, "").substring(0, 25).toUpperCase()); // Merchant Name
    payload += f('60', city.normalize("NFD").replace(/[\u0300-\u036f]/g, "").substring(0, 15).toUpperCase()); // Merchant City
    
    // Additional Data Field Template (ID 62)
    let txid = f('05', '***'); // TXID não rastreável para PIX estático
    payload += f('62', txid);
    
    // CRC16 Calculation (Final bits)
    payload += '6304';
    payload += crc16(payload);
    
    return payload;
};

// CRC16 CCITT (Polynomial 0x1021)
function crc16(str) {
    let crc = 0xFFFF;
    const poly = 0x1021;
    for (let i = 0; i < str.length; i++) {
        crc ^= (str.charCodeAt(i) << 8);
        for (let j = 0; j < 8; j++) {
            if (crc & 0x8000) {
                crc = ((crc << 1) ^ poly) & 0xFFFF;
            } else {
                crc = (crc << 1) & 0xFFFF;
            }
        }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
}
