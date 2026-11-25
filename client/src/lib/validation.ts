const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const POSTAL_CODE_ES_REGEX = /^(0[1-9]|[1-4]\d|5[0-2])\d{3}$/;
const DNI_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE';

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test((email || '').trim());
}

export function isValidSpanishPostalCode(postalCode: string): boolean {
  return POSTAL_CODE_ES_REGEX.test((postalCode || '').trim());
}

export function validateSpanishNifCifNie(value: string): {
  isValid: boolean;
  type: 'NIF' | 'NIE' | 'CIF' | 'INVALID';
  message?: string;
} {
  if (!value || typeof value !== 'string') {
    return { isValid: false, type: 'INVALID', message: 'NIF/CIF es obligatorio' };
  }

  const str = value.trim().toUpperCase().replace(/[\s.-]/g, '');
  if (str.length !== 9) {
    return {
      isValid: false,
      type: 'INVALID',
      message: 'Debe contener exactamente 9 caracteres',
    };
  }

  if (/^[0-9]{8}[A-Z]$/.test(str)) {
    const num = parseInt(str.substring(0, 8), 10);
    const expected = DNI_LETTERS[num % 23];
    if (str[8] === expected) return { isValid: true, type: 'NIF' };
    return {
      isValid: false,
      type: 'INVALID',
      message: `Letra de control incorrecta (se esperaba '${expected}')`,
    };
  }

  if (/^[XYZ][0-9]{7}[A-Z]$/.test(str)) {
    let prefixNum = '0';
    if (str[0] === 'Y') prefixNum = '1';
    if (str[0] === 'Z') prefixNum = '2';
    const num = parseInt(prefixNum + str.substring(1, 8), 10);
    const expected = DNI_LETTERS[num % 23];
    if (str[8] === expected) return { isValid: true, type: 'NIE' };
    return {
      isValid: false,
      type: 'INVALID',
      message: `Letra de NIE incorrecta (se esperaba '${expected}')`,
    };
  }

  if (/^[ABCDEFGHJNPQRSUVW][0-9]{7}[0-9A-J]$/.test(str)) {
    const digits = str.substring(1, 8);
    let evenSum = 0;
    let oddSum = 0;
    for (let i = 0; i < digits.length; i++) {
      const d = parseInt(digits[i], 10);
      if (i % 2 === 0) {
        const doubled = d * 2;
        oddSum += doubled > 9 ? doubled - 9 : doubled;
      } else {
        evenSum += d;
      }
    }
    const lastDigit = (evenSum + oddSum) % 10;
    const controlNum = lastDigit === 0 ? 0 : 10 - lastDigit;
    const controlLetter = 'JABCDEFGHI'[controlNum];
    if (str[8] === String(controlNum) || str[8] === controlLetter) {
      return { isValid: true, type: 'CIF' };
    }
    return {
      isValid: false,
      type: 'INVALID',
      message: 'Dígito/Letra de control de CIF inválido',
    };
  }

  return {
    isValid: false,
    type: 'INVALID',
    message: 'Formato de NIF, NIE o CIF no reconocido',
  };
}

export interface SupportedCountry {
  code: 'ES' | 'FR' | 'GB';
  name: string;
  prefix: string;
  flag: string;
  digitsLength: number;
  placeholder: string;
  regex: RegExp;
}

export const SUPPORTED_COUNTRIES: SupportedCountry[] = [
  {
    code: 'ES',
    name: 'España',
    prefix: '+34',
    flag: '🇪🇸',
    digitsLength: 9,
    placeholder: '612 345 678',
    regex: /^[6789]\d{8}$/,
  },
  {
    code: 'FR',
    name: 'Francia',
    prefix: '+33',
    flag: '🇫🇷',
    digitsLength: 9,
    placeholder: '6 12 34 56 78',
    regex: /^[1-9]\d{8}$/,
  },
  {
    code: 'GB',
    name: 'Reino Unido',
    prefix: '+44',
    flag: '🇬🇧',
    digitsLength: 10,
    placeholder: '7123 456789',
    regex: /^[1-9]\d{9}$/,
  },
];

export const DEFAULT_COUNTRY = SUPPORTED_COUNTRIES[0];

export function getCountryByCodeOrPrefix(
  codeOrPrefix?: string,
): SupportedCountry {
  if (!codeOrPrefix) return DEFAULT_COUNTRY;
  const match = SUPPORTED_COUNTRIES.find(
    (c) =>
      c.code.toUpperCase() === codeOrPrefix.toUpperCase() ||
      c.prefix === codeOrPrefix ||
      c.name.toLowerCase() === codeOrPrefix.toLowerCase(),
  );
  return match || DEFAULT_COUNTRY;
}

export function validatePhoneNumber(
  countryCode: string,
  prefix: string,
  rawNationalNumber: string,
): {
  isValid: boolean;
  message?: string;
  e164?: string;
  cleanNationalDigits: string;
} {
  const country = getCountryByCodeOrPrefix(countryCode);
  if (country.prefix !== prefix) {
    return {
      isValid: false,
      message: `El prefijo ${prefix} no corresponde a ${country.name}. Debe ser ${country.prefix}.`,
      cleanNationalDigits: '',
    };
  }
  const cleanDigits = (rawNationalNumber || '').replace(/\D/g, '');
  if (!cleanDigits) {
    return {
      isValid: false,
      message: 'Por favor, ingresa el número de teléfono.',
      cleanNationalDigits: '',
    };
  }
  if (cleanDigits.length !== country.digitsLength || !country.regex.test(cleanDigits)) {
    return {
      isValid: false,
      message: `Teléfono inválido para ${country.name} (${country.digitsLength} dígitos).`,
      cleanNationalDigits: cleanDigits,
    };
  }
  return {
    isValid: true,
    e164: `${prefix}${cleanDigits}`,
    cleanNationalDigits: cleanDigits,
  };
}
