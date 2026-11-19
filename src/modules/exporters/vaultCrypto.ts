/**
 * AES-256-GCM encrypted JSON backup vault using Web Crypto API (PBKDF2 SHA-256 + random salt & IV).
 * Compatible with both Chromium/Electron renderers and Node 20+ WebCrypto during tests.
 */

export const ENCRYPTED_VAULT_SCHEMA = 'money-manager-vault-encrypted-v1';

export interface EncryptedVaultEnvelope {
  schema: typeof ENCRYPTED_VAULT_SCHEMA;
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  cipher: 'AES-256-GCM';
  saltB64: string;
  ivB64: string;
  ciphertextB64: string;
  createdAt: string;
}

function getCrypto(): Crypto {
  const c = (globalThis as any)?.crypto;
  if (!c?.subtle) {
    throw new Error('Web Crypto API (crypto.subtle) is unavailable in this runtime.');
  }
  return c;
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const cryptoApi = getCrypto();
  const enc = new TextEncoder();
  const baseKey = await cryptoApi.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return cryptoApi.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export function isEncryptedVaultPayload(obj: unknown): obj is EncryptedVaultEnvelope {
  if (!obj || typeof obj !== 'object') return false;
  const rec = obj as Record<string, unknown>;
  return (
    rec.schema === ENCRYPTED_VAULT_SCHEMA &&
    typeof rec.saltB64 === 'string' &&
    typeof rec.ivB64 === 'string' &&
    typeof rec.ciphertextB64 === 'string'
  );
}

export async function encryptVaultJson(plainJson: string, passphrase: string): Promise<string> {
  if (!passphrase || passphrase.length < 4) {
    throw new Error('Passphrase must be at least 4 characters long.');
  }
  const cryptoApi = getCrypto();
  const iterations = 200000;
  const salt = cryptoApi.getRandomValues(new Uint8Array(16));
  const iv = cryptoApi.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, iterations);

  const plaintext = new TextEncoder().encode(plainJson);
  const cipherBuffer = await cryptoApi.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    plaintext
  );

  const envelope: EncryptedVaultEnvelope = {
    schema: ENCRYPTED_VAULT_SCHEMA,
    kdf: 'PBKDF2-SHA256',
    iterations,
    cipher: 'AES-256-GCM',
    saltB64: bytesToBase64(salt),
    ivB64: bytesToBase64(iv),
    ciphertextB64: bytesToBase64(new Uint8Array(cipherBuffer)),
    createdAt: new Date().toISOString(),
  };

  return JSON.stringify(envelope, null, 2);
}

export async function decryptVaultJson(encryptedInput: string | EncryptedVaultEnvelope, passphrase: string): Promise<string> {
  if (!passphrase) {
    throw new Error('Passphrase is required to decrypt this vault backup.');
  }
  const parsed = typeof encryptedInput === 'string' ? JSON.parse(encryptedInput) : encryptedInput;
  if (!isEncryptedVaultPayload(parsed)) {
    throw new Error('Invalid encrypted vault format.');
  }

  const cryptoApi = getCrypto();
  const salt = base64ToBytes(parsed.saltB64);
  const iv = base64ToBytes(parsed.ivB64);
  const ciphertext = base64ToBytes(parsed.ciphertextB64);
  const iterations = Number(parsed.iterations) || 200000;
  const key = await deriveKey(passphrase, salt, iterations);

  try {
    const plainBuf = await cryptoApi.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource },
      key,
      ciphertext as unknown as BufferSource
    );
    return new TextDecoder().decode(plainBuf);
  } catch {
    throw new Error('Incorrect passphrase or corrupted encrypted backup vault.');
  }
}
