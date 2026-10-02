/**
 * Plantillas SMS exclusivas de la aplicacion Beerry.
 *
 * El contenido se mantiene en GSM/ASCII para no convertir el mensaje a UCS-2
 * y conservar cada codigo dentro de un solo segmento SMS.
 */
export const appRegistrationOtpMessage = (code: string, expirationMinutes: number): string =>
  [
    'BEERRY APP',
    `Tu codigo para verificar tu cuenta es ${code}.`,
    `Valido por ${expirationMinutes} min. No lo compartas.`,
    'Si no creaste una cuenta, ignora este mensaje.',
  ].join('\n');

export const appPasswordRecoveryOtpMessage = (code: string, expirationMinutes: number): string =>
  [
    'BEERRY APP',
    `Tu codigo para recuperar tu contrasena es ${code}.`,
    `Valido por ${expirationMinutes} min. No lo compartas.`,
    'Si no lo pediste, ignora este mensaje.',
  ].join('\n');

export const appPasswordChangeOtpMessage = (code: string, expirationMinutes: number): string =>
  [
    'BEERRY APP',
    `Tu codigo para cambiar tu contrasena es ${code}.`,
    `Valido por ${expirationMinutes} min. No lo compartas.`,
    'Si no lo pediste, ignora este mensaje.',
  ].join('\n');
