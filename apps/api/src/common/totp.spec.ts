import {
  base32Decode,
  base32Encode,
  generateTotpCode,
  generateTotpSecret,
  verifyTotp,
  encryptTotpSecret,
  decryptTotpSecret,
  getTotpUri,
} from './totp';

describe('TOTP Utilities', () => {
  const secret = 'JBSWY3DPEHPK3PXP';
  const encryptionKey = 'test-secret-key-123';

  it('mã hóa và giải mã Base32 chính xác', () => {
    const raw = Buffer.from('Hello Gia Pha');
    const encoded = base32Encode(raw);
    const decoded = base32Decode(encoded);
    expect(decoded.toString('utf8')).toBe('Hello Gia Pha');
  });

  it('sinh mã bí mật TOTP đúng định dạng', () => {
    const sec = generateTotpSecret();
    expect(sec.length).toBe(32);
    expect(() => base32Decode(sec)).not.toThrow();
  });

  it('xác thực mã TOTP hợp lệ và kiểm tra replay attack', () => {
    const step = Math.floor(Date.now() / 1000 / 30);
    const code = generateTotpCode(secret, step);

    // Xác thực lần 1: hợp lệ
    const res1 = verifyTotp(secret, code, null);
    expect(res1.valid).toBe(true);
    expect(res1.timeStep).toBe(step);

    // Xác thực lần 2 với cùng timeStep (hoặc timeStep nhỏ hơn): bị từ chối chống replay
    const res2 = verifyTotp(secret, code, step);
    expect(res2.valid).toBe(false);
  });

  it('mã hóa và giải mã AES-256-GCM thành công', () => {
    const originalSecret = generateTotpSecret();
    const encrypted = encryptTotpSecret(originalSecret, encryptionKey);
    expect(encrypted).not.toBe(originalSecret);
    expect(encrypted.split(':')).toHaveLength(3);

    const decrypted = decryptTotpSecret(encrypted, encryptionKey);
    expect(decrypted).toBe(originalSecret);
  });

  it('tạo URI otpauth đúng chuẩn Google Authenticator', () => {
    const uri = getTotpUri('0901000001', 'GiaPha', secret);
    expect(uri).toContain('otpauth://totp/GiaPha:0901000001');
    expect(uri).toContain(`secret=${secret}`);
  });
});

