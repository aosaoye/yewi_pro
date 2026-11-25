import { ValidateBy, type ValidationOptions } from 'class-validator';
import { isValidSpanishFiscalId } from '../fiscal-id';

export function IsSpanishFiscalId(options?: ValidationOptions): PropertyDecorator {
  return ValidateBy({
    name: 'isSpanishFiscalId',
    validator: {
      validate: (value: unknown) => typeof value === 'string' && isValidSpanishFiscalId(value),
      defaultMessage: () => 'La identificación fiscal española no tiene un formato o dígito de control válido.',
    },
  }, options);
}
