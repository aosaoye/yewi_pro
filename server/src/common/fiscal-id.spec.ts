import {
  isValidSpanishFiscalId,
  normalizeBusinessName,
  normalizeFiscalId,
  normalizeSpanishPhone,
} from './fiscal-id';

describe('FiscalId & Spanish Phone Utilities', () => {
  it('validates real Spanish NIF, NIE, and CIF numbers', () => {
    expect(isValidSpanishFiscalId('12345678Z')).toBe(true);
    expect(isValidSpanishFiscalId('X1234567L')).toBe(true);
    expect(isValidSpanishFiscalId('B12345674')).toBe(true);
    expect(isValidSpanishFiscalId('12345678A')).toBe(false);
    expect(isValidSpanishFiscalId('invalid')).toBe(false);
  });

  it('normalizes fiscal IDs and business names cleanly', () => {
    expect(normalizeFiscalId(' 12.345.678-z ')).toBe('12345678Z');
    expect(normalizeBusinessName('  Fontanería Ángel  S.L. ')).toBe(
      'fontaneria angel s.l.',
    );
  });

  it('normalizes Spanish and international E.164 phone numbers', () => {
    expect(normalizeSpanishPhone('611 22 33 44')).toBe('+34611223344');
    expect(normalizeSpanishPhone('0034 611-22-33-44')).toBe('+34611223344');
    expect(normalizeSpanishPhone('+34600112233')).toBe('+34600112233');
    expect(normalizeSpanishPhone('1234')).toBeNull();
  });
});
