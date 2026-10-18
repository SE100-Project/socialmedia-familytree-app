import { randomInt } from 'node:crypto';

// Bỏ ký tự dễ nhầm (0/O, 1/I) vì mã này người dùng đọc/nhập tay khi xin gia nhập (FR-04).
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateAccountCode(length = 8): string {
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}
