/**
 * Utilidad de seguridad y anti-fraude para prevenir fuga de contactos fuera de la plataforma
 * antes de que el lead sea desbloqueado o el pedido sea creado.
 */
export class AntiFraudUtils {
  // Expresiones regulares para detectar correos, teléfonos y enlaces a mensajería externa
  private static readonly EMAIL_REGEX =
    /[a-zA-Z0-9._%+-]+\s*(?:@|\(arroba\)|\[at\]|\barroba\b)\s*[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;

  private static readonly EMAIL_PROVIDER_REGEX =
    /\b(?:gmail|hotmail|outlook|yahoo|icloud|protonmail|live\.com)\b/gi;

  private static readonly PHONE_REGEX =
    /(?:(?:\+?(\d{1,3}))?[-. (]*(\d{2,4})[-. )]*(\d{2,4})[-. ]*(\d{2,4})(?:[-. ]*(\d{2,4}))?)|(?:\b\d{9,12}\b)/g;

  private static readonly SOCIAL_HANDLE_REGEX =
    /(?:^|\s)@[a-zA-Z0-9._]{3,}/g;

  private static readonly MESSENGER_LINKS_REGEX =
    /(?:https?:\/\/\S+)|(?:t\.me|wa\.me|ig\.me|fb\.me|api\.whatsapp\.com|instagram\.com|discord\.gg|facebook\.com|tiktok\.com)\/\S+|\b(?:instagram|insta|facebook|tiktok|telegram|whatsapp|wasap|snapchat|discord)\b/gi;

  private static matches(regex: RegExp, text: string): boolean {
    regex.lastIndex = 0;
    return regex.test(text);
  }

  /**
   * Determina si el texto contiene información de contacto externa
   */
  static containsExternalContactInfo(text: string): boolean {
    if (!text) return false;

    return (
      this.matches(this.EMAIL_REGEX, text) ||
      this.matches(this.EMAIL_PROVIDER_REGEX, text) ||
      this.matches(this.PHONE_REGEX, text) ||
      this.matches(this.SOCIAL_HANDLE_REGEX, text) ||
      this.matches(this.MESSENGER_LINKS_REGEX, text)
    );
  }

  /**
   * Enmascara números de teléfono, emails y enlaces externos en mensajes
   */
  static sanitizeText(text: string): string {
    if (!text) return text;

    let sanitized = text.replace(
      this.EMAIL_REGEX,
      '[CORREO OCULTO - DESBLOQUEA EL CONTACTO O FORMALIZA EL PEDIDO]',
    );

    sanitized = sanitized.replace(
      this.MESSENGER_LINKS_REGEX,
      '[ENLACE EXTERNO BLOQUEADO]',
    );

    sanitized = sanitized.replace(
      this.PHONE_REGEX,
      '[TELÉFONO OCULTO - DESBLOQUEA EL CONTACTO O FORMALIZA EL PEDIDO]',
    );

    return sanitized;
  }
}
