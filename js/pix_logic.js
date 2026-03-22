/**
 * Obra Real - PIX Logic Helper
 * Gera payloads de PIX Estático (BRCode) para pagamentos rápidos.
 */

window.generatePixPayload = function(key, amount, receiver, city = 'SAO PAULO', description = 'OBRA REAL') {
    if (!key) return null;
    
    // Limpeza básica da chave se for CPF/CNPJ/Telefone
    let cleanKey = key.replace(/[^\w@.-]/g, '');
    
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
                crc = (crc << 1) ^ poly;
            } else {
                crc <<= 1;
            }
        }
    }
    return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}
