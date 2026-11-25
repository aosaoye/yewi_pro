import { createCipheriv, createHmac, randomInt, timingSafeEqual } from 'node:crypto';

/**
 * Codifica en Base64 los parámetros JSON requeridos por Redsys TPV Virtual.
 */
export function encodeMerchantParameters(params: Record<string, string>): string {
  return Buffer.from(JSON.stringify(params), 'utf8').toString('base64');
}

/**
 * Decodifica Ds_MerchantParameters (Base64 o Base64URL) a objeto JSON.
 */
export function decodeMerchantParameters(
  merchantParamsB64: string,
): Record<string, string> {
  const normalized = merchantParamsB64.replace(/-/g, '+').replace(/_/g, '/');
  const json = Buffer.from(normalized, 'base64').toString('utf8');
  return JSON.parse(json) as Record<string, string>;
}

/**
 * Deriva la clave 3DES-CBC de Redsys cifrando el número de pedido (zero-padded a 8 bytes)
 * y firma Ds_MerchantParameters con HMAC-SHA256.
 */
export function createRedsysSignature(
  merchantParamsB64: string,
  orderRef: string,
  secretKeyB64: string,
): string {
  const keyBytes = Buffer.from(secretKeyB64.trim(), 'base64');
  const key3Des =
    keyBytes.length === 24
      ? keyBytes
      : Buffer.concat([keyBytes, keyBytes.subarray(0, 8)]).subarray(0, 24);

  const orderBuf = Buffer.from(orderRef, 'utf8');
  const paddedLen = Math.ceil(Math.max(orderBuf.length, 1) / 8) * 8;
  const paddedOrder = Buffer.alloc(paddedLen, 0);
  orderBuf.copy(paddedOrder);

  const cipher = createCipheriv('des-ede3-cbc', key3Des, Buffer.alloc(8, 0));
  cipher.setAutoPadding(false);
  const derivedKey = Buffer.concat([
    cipher.update(paddedOrder),
    cipher.final(),
  ]);

  return createHmac('sha256', derivedKey)
    .update(merchantParamsB64)
    .digest('base64');
}

/**
 * Verifica la firma HMAC_SHA256_V1 enviada por Redsys en las notificaciones.
 */
export function verifyRedsysSignature(
  merchantParamsB64: string,
  receivedSignature: string,
  secretKeyB64: string,
): boolean {
  if (!merchantParamsB64 || !receivedSignature || !secretKeyB64) {
    return false;
  }
  const decoded = decodeMerchantParameters(merchantParamsB64);
  const orderRef = decoded.Ds_Order || decoded.DS_ORDER || '';
  if (!orderRef) {
    return false;
  }

  const expectedB64 = createRedsysSignature(
    merchantParamsB64,
    orderRef,
    secretKeyB64,
  );
  const normalize = (val: string) =>
    val.trim().replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const expectedNorm = Buffer.from(normalize(expectedB64), 'utf8');
  const receivedNorm = Buffer.from(normalize(receivedSignature), 'utf8');
  if (expectedNorm.length !== receivedNorm.length) {
    return false;
  }
  return timingSafeEqual(expectedNorm, receivedNorm);
}

/**
 * Genera una referencia de pedido válida para Redsys (12 dígitos/alfanuméricos,
 * comenzando por 4+ dígitos numéricos).
 */
export function generateRedsysOrderRef(): string {
  const timePart = String(Date.now()).slice(-8);
  const randPart = String(randomInt(1000, 9999));
  return `${timePart}${randPart}`;
}

export function getRedsysEndpoint(env?: string): string {
  return env?.toLowerCase() === 'production'
    ? 'https://sis.redsys.es/sis/realizarPago'
    : 'https://sis-t.redsys.es:25443/sis/realizarPago';
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
