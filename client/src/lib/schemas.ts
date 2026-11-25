import { z } from 'zod';
import {
  isValidSpanishPostalCode,
  validatePhoneNumber,
  validateSpanishNifCifNie,
} from './validation';

/** Convierte un ZodError en un mapa campo -> primer mensaje de error (mostrando TODOS los campos con fallo a la vez). */
export function zodErrorsToMap<T extends string = string>(
  error: z.ZodError,
): Partial<Record<T, string>> {
  const map: Partial<Record<T, string>> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !map[key as T]) {
      map[key as T] = issue.message;
    }
  }
  return map;
}

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Introduce tu correo electrónico.')
    .email('Introduce un correo electrónico válido.'),
  password: z
    .string()
    .min(1, 'Introduce tu contraseña.')
    .min(4, 'La contraseña es demasiado corta.'),
});

export const otpSchema = z.object({
  otpCode: z
    .string()
    .trim()
    .min(4, 'Introduce el código de verificación.'),
});

export const registerNameSchema = z.object({
  firstName: z.string().trim().min(1, 'Introduce tu nombre.'),
  lastName: z.string().trim().min(1, 'Introduce tus apellidos.'),
});

export const registerCredentialsSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1, 'Introduce tu correo electrónico.')
      .email('Introduce un correo electrónico válido.'),
    password: z
      .string()
      .min(1, 'Introduce una contraseña.')
      .min(8, 'La contraseña debe tener al menos 8 caracteres.'),
    confirmPassword: z.string().min(1, 'Confirma tu contraseña.'),
  })
  .superRefine((data, ctx) => {
    if (
      data.password.length > 0 &&
      data.confirmPassword.length > 0 &&
      data.password !== data.confirmPassword
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmPassword'],
        message: 'Las contraseñas no coinciden.',
      });
    }
  });

export function buildRegisterLocationSchema(
  countryCode: string,
  countryPrefix: string,
) {
  return z
    .object({
      phone: z.string().trim(),
      city: z.string().trim().min(1, 'Indica tu ciudad o municipio.'),
      postalCode: z.string().trim(),
    })
    .superRefine((data, ctx) => {
      const phoneCheck = validatePhoneNumber(
        countryCode,
        countryPrefix,
        data.phone,
      );
      if (!phoneCheck.isValid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['phone'],
          message:
            phoneCheck.message || 'Introduce un número de teléfono válido.',
        });
      }
      if (!data.postalCode) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['postalCode'],
          message: 'Indica tu código postal.',
        });
      } else if (!isValidSpanishPostalCode(data.postalCode)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['postalCode'],
          message: 'Introduce un código postal español válido de 5 dígitos.',
        });
      }
    });
}

export const registerBusinessSchema = z
  .object({
    businessName: z
      .string()
      .trim()
      .min(1, 'Indica tu nombre comercial o empresa.'),
    taxId: z.string().trim(),
  })
  .superRefine((data, ctx) => {
    if (!data.taxId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['taxId'],
        message: 'Indica tu NIF, NIE o CIF.',
      });
      return;
    }
    const check = validateSpanishNifCifNie(data.taxId);
    if (!check.isValid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['taxId'],
        message: check.message || 'NIF/NIE/CIF no válido.',
      });
    }
  });
