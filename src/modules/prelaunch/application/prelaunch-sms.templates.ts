/**
 * Plantillas exclusivas del prelanzamiento web de Beerry.
 *
 * Se usa texto GSM/ASCII de forma intencional: evita que las tildes o emojis
 * conviertan el contenido a Unicode y ayuda a mantenerlo en un solo SMS.
 * Las plantillas de la aplicacion principal viven en NotificationService.
 */
export const preLaunchWebOtpMessage = (code: string, expirationMinutes: number): string =>
  [
    'BEERRY WEB',
    `Tu codigo de acceso anticipado es ${code}.`,
    `Valido por ${expirationMinutes} min. No lo compartas.`,
    'Si no lo pediste, ignora este mensaje.',
  ].join('\n');
