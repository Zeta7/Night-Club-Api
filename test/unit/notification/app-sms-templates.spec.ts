/// <reference types="jest" />
import {
  appPasswordChangeOtpMessage,
  appPasswordRecoveryOtpMessage,
  appRegistrationOtpMessage,
} from '../../../src/modules/notification/application/app-sms.templates';

describe('plantillas SMS de Beerry App', () => {
  const templates = [
    {
      name: 'registro',
      message: appRegistrationOtpMessage('631487', 10),
      purpose: 'Tu codigo para verificar tu cuenta es 631487.',
    },
    {
      name: 'recuperacion de contrasena',
      message: appPasswordRecoveryOtpMessage('631487', 10),
      purpose: 'Tu codigo para recuperar tu contrasena es 631487.',
    },
    {
      name: 'cambio de contrasena',
      message: appPasswordChangeOtpMessage('631487', 10),
      purpose: 'Tu codigo para cambiar tu contrasena es 631487.',
    },
  ];

  it.each(templates)('identifica la app y explica el codigo de $name', ({ message, purpose }) => {
    expect(message).toContain('BEERRY APP');
    expect(message).toContain(purpose);
    expect(message).toContain('Valido por 10 min. No lo compartas.');
  });

  it.each(templates)('mantiene $name en ASCII y dentro de un segmento SMS', ({ message }) => {
    expect(message).toMatch(/^[\x00-\x7F]*$/);
    expect(message.length).toBeLessThanOrEqual(160);
  });

  it('usa mensajes distintos para cada accion', () => {
    expect(new Set(templates.map(({ message }) => message))).toHaveProperty('size', 3);
  });
});
