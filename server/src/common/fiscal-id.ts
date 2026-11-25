const CONTROL_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE';
const ENTITY_CONTROL_LETTERS = 'JABCDEFGHI';

export function normalizeFiscalId(value: string): string {
  return value.toUpperCase().replace(/[\s.-]/g, '');
}

export function isValidSpanishFiscalId(value: string): boolean {
  const id = normalizeFiscalId(value);
  const personal = id.match(/^(\d{8}|[XYZ]\d{7})([A-Z])$/);
  if (personal) {
    const digits = personal[1].replace(/[XYZ]/, (letter) => String('XYZ'.indexOf(letter)));
    return CONTROL_LETTERS[Number(digits) % 23] === personal[2];
  }
  // K/L/M son NIF especiales de personas físicas: se comprueba su estructura.
  if (/^[KLM]\d{7}[A-Z]$/.test(id)) return true;
  const entity = id.match(/^([ABCDEFGHJNPQRSUVW])(\d{7})([0-9A-J])$/);
  if (!entity) return false;
  const [, prefix, body, check] = entity;
  let sum = 0;
  for (let index = 0; index < body.length; index += 1) {
    const digit = Number(body[index]);
    if (index % 2 === 0) {
      const doubled = digit * 2;
      sum += Math.floor(doubled / 10) + (doubled % 10);
    } else sum += digit;
  }
  const control = (10 - (sum % 10)) % 10;
  const numericControl = String(control);
  const letterControl = ENTITY_CONTROL_LETTERS[control];
  if ('ABEH'.includes(prefix)) return check === numericControl;
  if ('KPQS'.includes(prefix)) return check === letterControl;
  return check === numericControl || check === letterControl;
}

export function normalizeSpanishPhone(value: string): string | null {
  let compact = value.trim().replace(/[\s().-]/g, '');
  if (!compact) return null;
  if (compact.startsWith('00')) compact = `+${compact.slice(2)}`;
  if (/^\d{9}$/.test(compact)) compact = `+34${compact}`;
  else if (/^34\d{9}$/.test(compact)) compact = `+${compact}`;
  return /^\+[1-9]\d{7,14}$/.test(compact) ? compact : null;
}

export function normalizeBusinessName(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');
}
