/**
 * Sinh hash argon2id cho mật khẩu dev seed.
 * Chạy một lần để lấy hash, rồi dán vào db/seed_dev.sql.
 *
 * Cách dùng:
 *   node scripts/gen_seed_hashes.cjs
 *
 * Yêu cầu: argon2 package đã được cài (có trong devDependencies của apps/api).
 * Nếu chưa có: npm install -g argon2  hoặc  cd apps/api && pnpm add -D argon2
 */

'use strict';

const argon2 = require('argon2');

const PASSWORDS = [
  { label: 'TK-001 truongho@giapha.vn',  password: 'Dev@123456', salt: 'seedsalt000001' },
  { label: 'TK-002 truongchi@giapha.vn', password: 'Dev@123456', salt: 'seedsalt000002' },
  { label: 'TK-003 thanhvien@giapha.vn', password: 'Dev@123456', salt: 'seedsalt000003' },
];

const OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536,   // 64 MiB
  timeCost: 3,
  parallelism: 4,
};

async function main() {
  console.log('Sinh hash argon2id cho seed dev (mật khẩu: Dev@123456)\n');
  for (const { label, password, salt } of PASSWORDS) {
    const hash = await argon2.hash(password, {
      ...OPTIONS,
      salt: Buffer.from(salt.padEnd(16, '\0').slice(0, 16)),
    });
    console.log(`-- ${label}`);
    console.log(`'${hash}'`);
    console.log();
  }
}

main().catch(console.error);
