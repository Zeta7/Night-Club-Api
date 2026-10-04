/// <reference types="jest" />
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { StartPreLaunchRegistrationDto } from '../../../src/modules/prelaunch/presentation/dto/prelaunch.dto';

const validRegistration = {
  name: 'Ana Torres',
  phone: '987654321',
  departmentId: 15,
  provinceId: 1501,
  districtId: 150101,
  ubigeoCode: '150101',
  isAdultDeclared: true,
  privacyAccepted: true,
  privacyPolicyVersion: '2026-10-04',
  marketingConsent: false,
};

describe('StartPreLaunchRegistrationDto', () => {
  it('permite registrarse sin correo', async () => {
    const dto = plainToInstance(StartPreLaunchRegistrationDto, validRegistration);

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('valida el formato cuando se proporciona un correo', async () => {
    const dto = plainToInstance(StartPreLaunchRegistrationDto, {
      ...validRegistration,
      email: 'correo-invalido',
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'email')).toBe(true);
  });
});
