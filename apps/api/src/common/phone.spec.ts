import { normalizeVnPhone } from './phone';

describe('normalizeVnPhone', () => {
  it('chấp nhận 0xxxxxxxxx, +84 và 84', () => {
    expect(normalizeVnPhone('0912 345 678')).toBe('0912345678');
    expect(normalizeVnPhone('+84912345678')).toBe('0912345678');
    expect(normalizeVnPhone('84912345678')).toBe('0912345678');
  });
  it('từ chối số sai định dạng', () => {
    expect(normalizeVnPhone('')).toBeNull();
    expect(normalizeVnPhone('123')).toBeNull();
    expect(normalizeVnPhone('0212345678')).toBeNull(); // đầu số không phải di động
  });
});
