import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // standard GCM nonce size

/**
 * Envelope encryption for IntegrationConnection.encryptedCredentials (security-restoledger.md
 * §5: "encryption at rest ... application-level envelope encryption, key in secret manager").
 * Output layout: [12-byte IV][16-byte auth tag][ciphertext] — self-contained, no separate
 * column needed for IV/tag.
 */
@Injectable()
export class CredentialsCipher {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const hex = config.getOrThrow<string>('INTEGRATION_ENCRYPTION_KEY');
    this.key = Buffer.from(hex, 'hex');
    if (this.key.length !== 32) {
      throw new Error(
        'INTEGRATION_ENCRYPTION_KEY must be a 32-byte (64 hex char) key',
      );
    }
  }

  encrypt(plaintext: Record<string, string>): Buffer {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(plaintext), 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, ciphertext]);
  }

  decrypt(encrypted: Buffer): Record<string, string> {
    const iv = encrypted.subarray(0, IV_LENGTH);
    const authTag = encrypted.subarray(IV_LENGTH, IV_LENGTH + 16);
    const ciphertext = encrypted.subarray(IV_LENGTH + 16);
    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return JSON.parse(plaintext.toString('utf8')) as Record<string, string>;
  }
}
