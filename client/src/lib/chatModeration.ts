const EMAIL_PATTERN =
  /[a-zA-Z0-9._%+-]+\s*(?:@|\(arroba\)|\[at\]|\barroba\b)\s*[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i;
const EMAIL_PROVIDER_PATTERN =
  /\b(?:gmail|hotmail|outlook|yahoo|icloud|protonmail|live\.com)\b/i;
const SOCIAL_HANDLE_PATTERN = /(?:^|\s)@[a-zA-Z0-9._]{3,}/;
const SOCIAL_PLATFORM_OR_URL_PATTERN =
  /(?:https?:\/\/\S+)|(?:t\.me|wa\.me|ig\.me|fb\.me|instagram\.com|facebook\.com|tiktok\.com|discord\.gg)\S*|\b(?:instagram|insta|facebook|tiktok|telegram|whatsapp|wasap|snapchat|discord)\b/i;
const PHONE_PATTERN =
  /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2,4}\d{2,4}|\b\d{9,12}\b/;

/**
 * Impide enviar correos electrónicos, usuarios de redes sociales o teléfonos en el chat.
 */
export function detectExternalContactReason(text: string): string | null {
  const clean = text.trim();
  if (!clean) return null;

  if (EMAIL_PATTERN.test(clean) || EMAIL_PROVIDER_PATTERN.test(clean)) {
    return 'No puedes enviar correos electrónicos en el chat.';
  }
  if (
    SOCIAL_HANDLE_PATTERN.test(clean) ||
    SOCIAL_PLATFORM_OR_URL_PATTERN.test(clean)
  ) {
    return 'No puedes compartir redes sociales ni enlaces externos en el chat.';
  }
  if (PHONE_PATTERN.test(clean)) {
    return 'No puedes compartir números de teléfono en el chat.';
  }
  return null;
}
