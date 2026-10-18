/** Chuẩn hóa SĐT Việt Nam về dạng 0xxxxxxxxx (10 số). Trả về null nếu không hợp lệ. */
export function normalizeVnPhone(input: string): string | null {
  const digits = input.replace(/[\s.\-()]/g, '');
  let local: string;
  if (/^\+84\d{9}$/.test(digits)) local = '0' + digits.slice(3);
  else if (/^84\d{9}$/.test(digits)) local = '0' + digits.slice(2);
  else if (/^0\d{9}$/.test(digits)) local = digits;
  else return null;
  return /^0[35789]\d{8}$/.test(local) ? local : null;
}
