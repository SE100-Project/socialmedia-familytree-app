import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { hash, verify } from '@node-rs/argon2';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeVnPhone } from '../common/phone';
import { generateAccountCode } from '../common/account-code';
import { LoginDto, RegisterDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /** UC-01. Tạo tài khoản; chưa liên kết gia phả => trạng thái "Người đăng ký". */
  async register(dto: RegisterDto) {
    const phone = normalizeVnPhone(dto.phone);
    if (!phone) throw new BadRequestException('Số điện thoại không hợp lệ');
    const passwordHash = await hash(dto.password); // NFR-02: không lưu/log mật khẩu rõ

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const acc = await this.prisma.account.create({
          data: { phone, email: dto.email ?? null, passwordHash, accountCode: generateAccountCode() },
        });
        return { id: acc.id, accountCode: acc.accountCode, phone: acc.phone };
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          const target = String(e.meta?.target ?? '');
          if (target.includes('accountCode')) continue; // trùng mã ngẫu nhiên -> sinh lại
          throw new ConflictException('Số điện thoại hoặc email đã được đăng ký');
        }
        throw e;
      }
    }
    throw new ConflictException('Không tạo được mã tài khoản, thử lại');
  }

  /** UC-02. Sai thông tin hoặc tài khoản bị khóa đều trả cùng một lỗi. */
  async login(dto: LoginDto) {
    const phone = normalizeVnPhone(dto.phone);
    const acc = phone ? await this.prisma.account.findUnique({ where: { phone } }) : null;
    const ok = acc && acc.status === 'ACTIVE' && (await verify(acc.passwordHash, dto.password));
    if (!acc || !ok) throw new UnauthorizedException('Sai số điện thoại hoặc mật khẩu');
    return { accessToken: await this.jwt.signAsync({ sub: acc.id }) };
  }
}
