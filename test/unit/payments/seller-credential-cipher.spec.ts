/// <reference types="jest" />
import { ConfigService } from '@nestjs/config';
import { SellerCredentialCipher } from '../../../src/modules/payments/infrastructure/seller-credential-cipher';

describe('SellerCredentialCipher', () => {
  const config = {
    get: () => 'a-development-test-key-that-is-at-least-32-chars',
  } as unknown as ConfigService;
  it('encrypts authenticated seller tokens without retaining plaintext', () => {
    const cipher = new SellerCredentialCipher(config);
    const encrypted = cipher.encrypt('APP_USR-secret-token');
    expect(encrypted).not.toContain('APP_USR-secret-token');
    expect(cipher.decrypt(encrypted)).toBe('APP_USR-secret-token');
  });

  it('rejects tampered ciphertext', () => {
    const cipher = new SellerCredentialCipher(config);
    const encrypted = cipher.encrypt('secret');
    expect(() => cipher.decrypt(`${encrypted.slice(0, -1)}A`)).toThrow();
  });
});
