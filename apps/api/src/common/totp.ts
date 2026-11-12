import * as crypto from 'crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Giải mã chuỗi Base32 chuẩn RFC 4648 (thường dùng trong Google Authenticator).
 */
export function base32Decode(str: string): Buffer {
  const clean = str.replace(/=+$/, '').toUpperCase();
  let bits = 0;
  let value = 0;
  let index = 0;
  const output = Buffer.alloc(Math.floor((clean.length * 5) / 8));

  for (let i = 0; i < clean.length; i++) {
    const val = BASE32_ALPHABET.indexOf(clean[i]);
    if (val === -1) {
      throw new Error(`Ký tự Base32 không hợp lệ: ${clean[i]}`);
    }
    value = (value << 5) | val;
    bits += 5;
    if (bits >= 8) {
      output[index++] = (value >>> (bits - 8)) & 255;
      bits -= 8;
    }
  }

  return output;
}

/**
 * Mã hóa Buffer thành chuỗi Base32.
 */
export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Sinh khóa bí mật ngẫu nhiên (20 bytes -> 32 ký tự Base32) cho TOTP.
 */
export function generateTotpSecret(): string {
  const randomBytes = crypto.randomBytes(20);
  return base32Encode(randomBytes);
}

/**
 * Sinh mã TOTP 6 số tại bước thời gian timeStep (chuẩn RFC 6238).
 */
export function generateTotpCode(secretBase32: string, timeStep: number): string {
  const key = base32Decode(secretBase32);
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(timeStep), 0);

  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const codeInt = ((hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000);
  return codeInt.toString().padStart(6, '0');
}

/**
 * Xác thực mã OTP 6 số với cửa sổ kiểm tra (window +/- 1 timestep) và chống Replay Attack.
 */
export function verifyTotp(
  secretBase32: string,
  code: string,
  lastTimeStep?: number | null,
): { valid: boolean; timeStep: number } {
  const currentStep = Math.floor(Date.now() / 1000 / 30);
  const normalizedCode = code.trim();

  // Kiểm tra cửa sổ [currentStep - 1, currentStep, currentStep + 1]
  for (const step of [currentStep, currentStep - 1, currentStep + 1]) {
    // Chống replay attack: bước thời gian đã dùng không được dùng lại
    if (lastTimeStep !== undefined && lastTimeStep !== null && step <= lastTimeStep) {
      continue;
    }

    try {
      const generated = generateTotpCode(secretBase32, step);
      if (crypto.timingSafeEqual(Buffer.from(generated), Buffer.from(normalizedCode))) {
        return { valid: true, timeStep: step };
      }
    } catch {
      // Bỏ qua lỗi định dạng mã
    }
  }

  return { valid: false, timeStep: currentStep };
}

/**
 * Tạo URI chuẩn otpauth để hiển thị QR Code cho Google Authenticator.
 */
export function getTotpUri(accountIdentifier: string, issuer: string, secretBase32: string): string {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedAccount = encodeURIComponent(accountIdentifier);
  return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secretBase32}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Mã hóa bí mật TOTP bằng AES-256-GCM.
 */
export function encryptTotpSecret(secret: string, encryptionSecret: string): string {
  const key = crypto.scryptSync(encryptionSecret, 'giapha-totp-salt-v1', 32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Giải mã bí mật TOTP bằng AES-256-GCM.
 */
export function decryptTotpSecret(encryptedData: string, encryptionSecret: string): string {
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Dữ liệu khóa TOTP mã hóa không đúng định dạng');
  }

  const [ivHex, tagHex, textHex] = parts;
  const key = crypto.scryptSync(encryptionSecret, 'giapha-totp-salt-v1', 32);
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const encrypted = Buffer.from(textHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8');
}

