// PIN 관련 유틸

export const PIN_KEY = 'mybob_security_pin';
export const PIN_SALT_KEY = 'mybob_security_pin_salt';
export const BODY_ENC_KEY = 'mybob_body_enc';
export const BODY_SALT_KEY = 'mybob_body_salt';
export const BODY_ATTEMPT_KEY = 'mybob_body_pin_attempts';
export const BODY_WARN_AT = 5;
export const BODY_MAX_ATTEMPTS = 10;

async function pbkdf2Hash(pin: string, salt: Uint8Array): Promise<string> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(pin).buffer as ArrayBuffer, 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations: 100000, hash: 'SHA-256' },
    baseKey,
    256,
  );
  return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function getPinHash(): string | null {
  return localStorage.getItem(PIN_KEY);
}

export function getPinSalt(): Uint8Array | null {
  const raw = localStorage.getItem(PIN_SALT_KEY);
  if (!raw) return null;
  try { return new Uint8Array(JSON.parse(raw)); } catch { return null; }
}

export async function savePin(pin: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2Hash(pin, salt);
  localStorage.setItem(PIN_SALT_KEY, JSON.stringify(Array.from(salt)));
  localStorage.setItem(PIN_KEY, hash);
}

export async function verifyPin(pin: string): Promise<boolean> {
  const stored = getPinHash();
  if (!stored) return false;
  const salt = getPinSalt();
  if (!salt) return false;
  const hash = await pbkdf2Hash(pin, salt);
  return hash === stored;
}

export function getBodyAttempts(): number {
  return parseInt(localStorage.getItem(BODY_ATTEMPT_KEY) || '0', 10);
}

export function incrementBodyAttempts(): number {
  const next = getBodyAttempts() + 1;
  localStorage.setItem(BODY_ATTEMPT_KEY, String(next));
  return next;
}

export function resetBodyAttempts() {
  localStorage.removeItem(BODY_ATTEMPT_KEY);
}

export async function deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(pin).buffer as ArrayBuffer, 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations: 10000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptBody(data: object, pin: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pin, salt);
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  const blob = {
    salt: Array.from(salt),
    iv: Array.from(iv),
    ct: Array.from(new Uint8Array(ciphertext)),
  };
  localStorage.setItem(BODY_ENC_KEY, JSON.stringify(blob));
  localStorage.setItem(BODY_SALT_KEY, JSON.stringify(Array.from(salt)));
  localStorage.removeItem('mybob_goal');
}

export async function decryptBody<T = object>(pin: string): Promise<T | null> {
  const raw = localStorage.getItem(BODY_ENC_KEY);
  if (!raw) return null;
  try {
    const { salt, iv, ct } = JSON.parse(raw);
    const key = await deriveKey(pin, new Uint8Array(salt));
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) },
      key,
      new Uint8Array(ct),
    );
    return JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    return null;
  }
}
