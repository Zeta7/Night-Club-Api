import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'node:crypto';

@Injectable()
export class VerificationCodeService {
  generateNumericCode(length = 6): string {
    const min = 10 ** (length - 1);
    const max = 10 ** length;

    return randomInt(min, max).toString();
  }

  hash(code: string): Promise<string> {
    return bcrypt.hash(code, 12);
  }

  compare(code: string, hash: string): Promise<boolean> {
    return bcrypt.compare(code, hash);
  }
}
