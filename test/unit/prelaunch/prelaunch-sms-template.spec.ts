/// <reference types="jest" />
import { preLaunchWebOtpMessage } from '../../../src/modules/prelaunch/application/prelaunch-sms.templates';

describe('preLaunchWebOtpMessage', () => {
  it('identifica la web y explica claramente el codigo de acceso', () => {
    expect(preLaunchWebOtpMessage('631487', 10)).toBe(
      [
        'BEERRY WEB',
        'Tu codigo de acceso anticipado es 631487.',
        'Valido por 10 min. No lo compartas.',
        'Si no lo pediste, ignora este mensaje.',
      ].join('\n'),
    );
  });

  it('se mantiene en ASCII y dentro de un solo segmento SMS', () => {
    const message = preLaunchWebOtpMessage('631487', 10);

    expect(message).toMatch(/^[\x00-\x7F]*$/);
    expect(message.length).toBeLessThanOrEqual(160);
  });
});
