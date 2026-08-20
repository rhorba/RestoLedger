import { CredentialsCipher } from './credentials-cipher';

function configWith(key: string) {
  return { getOrThrow: () => key } as any;
}

const VALID_KEY =
  'c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1';

describe('CredentialsCipher', () => {
  it('round-trips a credentials object', () => {
    const cipher = new CredentialsCipher(configWith(VALID_KEY));
    // Deliberately not shaped like a real provider's key format (e.g. Stripe's sk_live_/
    // whsec_ prefixes) — a fixture that LOOKS like a real secret is exactly what a secrets
    // scanner is supposed to flag, fake or not (caught by CI's Gitleaks job — see corrections.md).
    const plaintext = { apiKey: 'test-fixture-key-value', webhookSecret: 'test-fixture-webhook-secret' };

    const encrypted = cipher.encrypt(plaintext);
    const decrypted = cipher.decrypt(encrypted);

    expect(decrypted).toEqual(plaintext);
  });

  it('produces ciphertext that does not contain the plaintext', () => {
    const cipher = new CredentialsCipher(configWith(VALID_KEY));
    const encrypted = cipher.encrypt({ apiKey: 'super-secret-value' });

    expect(encrypted.toString('utf8')).not.toContain('super-secret-value');
  });

  it('produces different ciphertext for the same input each time (random IV)', () => {
    const cipher = new CredentialsCipher(configWith(VALID_KEY));
    const a = cipher.encrypt({ apiKey: 'same' });
    const b = cipher.encrypt({ apiKey: 'same' });

    expect(a.equals(b)).toBe(false);
  });

  it('fails to decrypt with the wrong key (auth tag mismatch)', () => {
    const cipherA = new CredentialsCipher(configWith(VALID_KEY));
    const otherKey =
      'd2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2';
    const cipherB = new CredentialsCipher(configWith(otherKey));

    const encrypted = cipherA.encrypt({ apiKey: 'secret' });

    expect(() => cipherB.decrypt(encrypted)).toThrow();
  });

  it('rejects a key that is not 32 bytes', () => {
    expect(() => new CredentialsCipher(configWith('tooshort'))).toThrow(
      'INTEGRATION_ENCRYPTION_KEY must be a 32-byte (64 hex char) key',
    );
  });
});
