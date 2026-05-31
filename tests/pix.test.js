import { describe, it, expect } from 'vitest';

// Simulate globalThis.window if needed
if (typeof window === 'undefined') {
  globalThis.window = globalThis;
}

// Import pix_logic.js which will populate window.generatePixPayload and window.cleanPixKey
import '../js/pix_logic.js';

describe('Pix Key Cleaning & Format', () => {
  it('should clean and format CPF correctly', () => {
    expect(window.cleanPixKey('123.456.789-10', 'cpf')).toBe('12345678910');
    expect(window.cleanPixKey(' 12345678910 ', 'CPF')).toBe('12345678910');
  });

  it('should clean and format CNPJ correctly', () => {
    expect(window.cleanPixKey('12.345.678/0001-90', 'cnpj')).toBe('12345678000190');
  });

  it('should clean and format Telefone correctly', () => {
    // 11 digits phone -> should prepend +55
    expect(window.cleanPixKey('(11) 99999-9999', 'telefone')).toBe('+5511999999999');
    expect(window.cleanPixKey('11999999999', 'telefone')).toBe('+5511999999999');
    // Already has +55
    expect(window.cleanPixKey('+5511999999999', 'telefone')).toBe('+5511999999999');
    // Has 55 without +
    expect(window.cleanPixKey('5511999999999', 'telefone')).toBe('+5511999999999');
  });

  it('should clean and format E-mail correctly', () => {
    expect(window.cleanPixKey(' Test@Example.com ', 'email')).toBe('test@example.com');
  });

  it('should clean and format Chave Aleatória correctly', () => {
    expect(window.cleanPixKey(' 123e4567-e89b-12d3-a456-426614174000 ', 'aleatoria')).toBe('123e4567-e89b-12d3-a456-426614174000');
  });

  it('should auto-detect and clean CPF without explicit type', () => {
    expect(window.cleanPixKey('123.456.789-10')).toBe('12345678910');
  });

  it('should auto-detect and clean Telefone without explicit type', () => {
    expect(window.cleanPixKey('(11) 99999-9999')).toBe('+5511999999999');
    expect(window.cleanPixKey('+5511999999999')).toBe('+5511999999999');
  });

  it('should auto-detect and clean E-mail without explicit type', () => {
    expect(window.cleanPixKey('test@example.com')).toBe('test@example.com');
  });

  it('should auto-detect and clean Chave Aleatória without explicit type', () => {
    expect(window.cleanPixKey('123e4567-e89b-12d3-a456-426614174000')).toBe('123e4567-e89b-12d3-a456-426614174000');
  });
});

describe('Pix Payload Generation', () => {
  it('should generate a valid payload structure', () => {
    const payload = window.generatePixPayload('123.456.789-10', 150.00, 'João da Silva', 'SAO PAULO', 'PAGAMENTO TESTE', 'cpf');
    expect(payload).toBeDefined();
    expect(payload).toContain('000201'); // Payload Format Indicator
    expect(payload).toContain('26'); // Merchant Account Information ID
    expect(payload).toContain('br.gov.bcb.pix'); // GUI
    expect(payload).toContain('12345678910'); // Clean key should be inside
    expect(payload).toContain('52040000'); // Merchant Category Code
    expect(payload).toContain('5303986'); // Currency BRL
    expect(payload).toContain('5406150.00'); // Amount formatted
    expect(payload).toContain('5802BR'); // Country Code
    expect(payload).toContain('JOAO DA SILVA'); // Normalized name
    expect(payload).toContain('6304'); // CRC16 indicator
  });
});
