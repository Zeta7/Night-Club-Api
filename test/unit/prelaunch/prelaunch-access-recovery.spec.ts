/// <reference types="jest" />
import { createHash } from 'node:crypto';
import { LaunchMarketStatus, PreLaunchLeadStatus } from '@prisma/client';
import { PreLaunchService } from '../../../src/modules/prelaunch/application/prelaunch.service';

describe('PreLaunchService access recovery', () => {
  const recoveryToken = 'temporary-recovery-token';
  const tokenHash = createHash('sha256').update(recoveryToken).digest('hex');
  const verifiedAt = new Date('2026-09-20T18:30:00.000Z');
  const createdAt = new Date('2026-09-20T18:00:00.000Z');
  const market = {
    id: 'market-lima',
    name: 'Lima',
    slug: 'lima',
    goal: 3000,
    isPublic: true,
    status: LaunchMarketStatus.COLLECTING_DEMAND,
    launchAt: null,
  };
  const lead = {
    id: 'lead-1',
    name: 'Persona registrada',
    status: PreLaunchLeadStatus.VERIFIED,
    phoneVerifiedAt: verifiedAt,
    createdAt,
    accessTokenHash: 'previous-access-token-hash',
    recoveryTokenHash: tokenHash,
    referralCode: 'BERRY123',
    referredById: null,
    departmentId: 15,
    provinceId: 1501,
    departmentName: 'Lima',
    provinceName: 'Lima',
    districtName: 'Miraflores',
    market,
  };

  function setup() {
    const prisma = {
      preLaunchLead: {
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(1),
      },
      preLaunchOtp: {
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      preLaunchLevel: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    const config = { get: jest.fn().mockReturnValue(undefined) };
    const verificationCodes = { compare: jest.fn().mockResolvedValue(true) };
    const service = new PreLaunchService(
      prisma as never,
      config as never,
      verificationCodes as never,
      {} as never,
      {} as never,
    );
    return { service, prisma, verificationCodes };
  }

  it('no expone los detalles mientras el OTP de recuperación no esté validado', async () => {
    const { service, prisma } = setup();
    prisma.preLaunchLead.findFirst.mockResolvedValue(lead);

    await expect(service.accessStatus(recoveryToken)).resolves.toEqual({
      verified: false,
      status: PreLaunchLeadStatus.VERIFIED,
      returningUser: true,
    });
    expect(prisma.preLaunchLead.count).not.toHaveBeenCalled();
  });

  it('promueve el token temporal solo después de un OTP válido y conserva el registro original', async () => {
    const { service, prisma, verificationCodes } = setup();
    prisma.preLaunchLead.findFirst
      .mockResolvedValueOnce(lead)
      .mockResolvedValueOnce({
        ...lead,
        accessTokenHash: tokenHash,
        recoveryTokenHash: null,
      });
    prisma.preLaunchOtp.findFirst.mockResolvedValue({
      id: 'otp-1',
      leadId: lead.id,
      codeHash: 'hashed-otp',
      attempts: 0,
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
    });

    const result = await service.verifyOtp(recoveryToken, '123456', { ip: '127.0.0.1' });

    expect(verificationCodes.compare).toHaveBeenCalledWith('123456', 'hashed-otp');
    expect(prisma.preLaunchLead.update).toHaveBeenCalledWith({
      where: { id: lead.id },
      data: { accessTokenHash: tokenHash, recoveryTokenHash: null },
    });
    expect(result).toMatchObject({
      verified: true,
      returningUser: true,
      registeredAt: verifiedAt.toISOString(),
      location: { department: 'Lima', province: 'Lima', district: 'Miraflores' },
      referralPath: '/unete/BERRY123',
    });
  });
});
