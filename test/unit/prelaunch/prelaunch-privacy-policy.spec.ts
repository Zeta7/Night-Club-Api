/// <reference types="jest" />
import { PreLaunchService } from '../../../src/modules/prelaunch/application/prelaunch.service';

describe('PreLaunchService privacy policy', () => {
  const service = new PreLaunchService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  const assertPrivacyAcceptance = (accepted: boolean, version: string) =>
    (
      service as unknown as { assertPrivacyAcceptance(value: boolean, policyVersion: string): void }
    ).assertPrivacyAcceptance(accepted, version);

  it('acepta la versión de la política que la persona vio', () => {
    expect(() => assertPrivacyAcceptance(true, '2026-10-04')).not.toThrow();
    expect(() => assertPrivacyAcceptance(true, '2026-10-01')).not.toThrow();
  });

  it('rechaza el registro cuando no existe consentimiento', () => {
    expect(() => assertPrivacyAcceptance(false, '2026-10-04')).toThrow();
  });

  it('rechaza una versión vacía o no identificable', () => {
    expect(() => assertPrivacyAcceptance(true, '')).toThrow();
    expect(() => assertPrivacyAcceptance(true, 'actual')).toThrow();
  });
});
