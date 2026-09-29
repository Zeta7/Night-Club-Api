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
    const parts = encrypted.split('.');
    const ciphertext = Buffer.from(parts[3]!, 'base64url');
    ciphertext.writeUInt8(ciphertext.readUInt8(0) ^ 1, 0);
    parts[3] = ciphertext.toString('base64url');
    expect(() => cipher.decrypt(parts.join('.'))).toThrow();
  });
});
