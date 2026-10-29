import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Account, AuthType, Prisma } from '@prisma/client';
import { hash, verify } from '@node-rs/argon2';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeVnPhone } from '../common/phone';
import { generateAccountCode } from '../common/account-code';
import {
  decryptTotpSecret,
  encryptTotpSecret,
  generateTotpSecret,
  getTotpUri,
  verifyTotp,
} from '../common/totp';
import {
  ChangePasswordDto,
  ForgotPasswordVerifyTotpDto,
  GoogleLoginDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  VerifyTotpSetupDto,
} from './dto';

@Injectable()
export class AuthService {
  private readonly totpEncryptionKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    this.totpEncryptionKey =
      this.config.get<string>('TOTP_ENCRYPTION_KEY') ??
      this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
  }

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

  private readonly loginAttempts = new Map<string, { attempts: number; blockedUntil?: number }>();

  checkLoginRateLimit(identifierKey: string) {
    const record = this.loginAttempts.get(identifierKey);
    if (!record) return;

    const now = Date.now();
    if (record.blockedUntil && record.blockedUntil > now) {
      const remainingMinutes = Math.ceil((record.blockedUntil - now) / 60000);
      throw new HttpException(
        `Bạn đã nhập sai mật khẩu quá 5 lần. Vui lòng thử lại sau ${remainingMinutes} phút.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (record.blockedUntil && record.blockedUntil <= now) {
      this.loginAttempts.delete(identifierKey);
    }
  }

  recordLoginFailure(identifierKey: string) {
    const now = Date.now();
    const record = this.loginAttempts.get(identifierKey) ?? { attempts: 0 };
    record.attempts += 1;
    if (record.attempts >= 5) {
      record.blockedUntil = now + 15 * 60 * 1000;
    }
    this.loginAttempts.set(identifierKey, record);
  }

  resetLoginRateLimit(identifierKey: string) {
    this.loginAttempts.delete(identifierKey);
  }

  /** UC-02. Đăng nhập bằng Số điện thoại hoặc Email (CSDL v1.2 §6.2) */
  async login(dto: LoginDto) {
    const rawIdentifier = (dto.identifier ?? dto.phone ?? '').trim();
    if (!rawIdentifier) {
      throw new BadRequestException('Vui lòng nhập số điện thoại hoặc email');
    }

    let normalizedKey = rawIdentifier.toLowerCase();
    let acc: Account | null = null;
    if (rawIdentifier.includes('@')) {
      acc = await this.prisma.account.findUnique({
        where: { email: rawIdentifier.toLowerCase() },
      });
    } else {
      const phone = normalizeVnPhone(rawIdentifier);
      if (phone) {
        normalizedKey = phone;
        acc = await this.prisma.account.findUnique({ where: { phone } });
      }
    }

    // NFR-02 / B1-05: Giới hạn tần suất đăng nhập (Rate Limiting / Brute-force protection)
    this.checkLoginRateLimit(normalizedKey);

    const isPasswordValid =
      acc &&
      acc.authType === 'LOCAL' &&
      !!acc.passwordHash &&
      (await verify(acc.passwordHash, dto.password));

    if (!acc || !isPasswordValid) {
      this.recordLoginFailure(normalizedKey);
      throw new UnauthorizedException('Sai số điện thoại/email hoặc mật khẩu');
    }

    if (acc.status === 'LOCKED') {
      throw new UnauthorizedException('Tài khoản đã bị khóa');
    }
    if (acc.status !== 'ACTIVE') {
      throw new UnauthorizedException('Tài khoản không ở trạng thái hoạt động');
    }

    // Đăng nhập thành công -> xóa bỏ đếm lỗi
    this.resetLoginRateLimit(normalizedKey);

    return {
      accessToken: await this.jwt.signAsync({ sub: acc.id }),
      user: {
        id: acc.id,
        accountCode: acc.accountCode,
        phone: acc.phone,
        email: acc.email,
      },
    };
  }

  /**
   * CSDL v1.2 §6.2: Xác thực qua Google Sign-In (OpenID Connect với claim google_sub).
   */
  async googleLogin(dto: GoogleLoginDto) {
    let payload: { sub: string; email?: string } | null = null;

    // Hỗ trợ mock token cho môi trường test/dev local
    if (dto.idToken.startsWith('mock_google_id_token_')) {
      const parts = dto.idToken.split('_');
      payload = {
        sub: parts[4] || 'mock-google-sub-12345',
        email: parts[5] || 'googleuser@gmail.com',
      };
    } else {
      try {
        const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${dto.idToken}`);
        if (!res.ok) {
          throw new UnauthorizedException('Google ID Token không hợp lệ hoặc đã hết hạn');
        }
        const data = (await res.json()) as { sub: string; email?: string; aud?: string };
        const configuredClientId = this.config.get<string>('GOOGLE_CLIENT_ID');
        if (configuredClientId && data.aud && data.aud !== configuredClientId) {
          throw new UnauthorizedException('Token không thuộc về ứng dụng này (Client ID không khớp)');
        }
        payload = {
          sub: data.sub,
          email: data.email,
        };
      } catch (err) {
        if (err instanceof UnauthorizedException) throw err;
        throw new UnauthorizedException('Không thể kết nối xác thực với Google OAuth');
      }
    }

    if (!payload || !payload.sub) {
      throw new UnauthorizedException('Không tìm thấy định danh sub trong token Google');
    }

    const googleSub = payload.sub;
    const googleEmail = payload.email?.toLowerCase();

    // 1. Kiểm tra tài khoản đã liên kết googleSub này chưa
    let acc = await this.prisma.account.findUnique({
      where: { googleSub },
    });

    if (acc) {
      if (acc.status !== 'ACTIVE') {
        throw new UnauthorizedException('Tài khoản đã bị khóa');
      }
      return {
        accessToken: await this.jwt.signAsync({ sub: acc.id }),
        user: {
          id: acc.id,
          accountCode: acc.accountCode,
          phone: acc.phone,
          email: acc.email,
        },
      };
    }

    // 2. Kiểm tra nếu email đã đăng ký tài khoản nội bộ trước đó
    if (googleEmail) {
      const existingEmailAcc = await this.prisma.account.findUnique({
        where: { email: googleEmail },
      });
      if (existingEmailAcc) {
        throw new ConflictException(
          'Email này đã được sử dụng bởi tài khoản nội bộ khác. Vui lòng đăng nhập bằng mật khẩu.',
        );
      }
    }

    // 3. Nếu là tài khoản Google mới hoàn toàn: kiểm tra số điện thoại (bắt buộc theo FR-01)
    if (!dto.phone) {
      return {
        needPhone: true,
        email: googleEmail,
        googleSub,
        message: 'Tài khoản Google mới cần cung cấp số điện thoại để hoàn tất đăng ký.',
      };
    }

    const phone = normalizeVnPhone(dto.phone);
    if (!phone) {
      throw new BadRequestException('Số điện thoại không hợp lệ');
    }

    const existingPhone = await this.prisma.account.findUnique({
      where: { phone },
    });
    if (existingPhone) {
      throw new ConflictException('Số điện thoại này đã được đăng ký cho một tài khoản khác');
    }

    // 4. Tạo tài khoản Google mới
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        acc = await this.prisma.account.create({
          data: {
            phone,
            email: googleEmail ?? null,
            passwordHash: null, // Tài khoản Google không có mật khẩu nội bộ
            authType: AuthType.GOOGLE,
            googleSub,
            accountCode: generateAccountCode(),
          },
        });
        break;
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          const target = String(e.meta?.target ?? '');
          if (target.includes('accountCode')) continue;
          throw new ConflictException('Số điện thoại hoặc thông tin Google đã tồn tại');
        }
        throw e;
      }
    }

    if (!acc) {
      throw new ConflictException('Không thể khởi tạo tài khoản, vui lòng thử lại');
    }

    return {
      accessToken: await this.jwt.signAsync({ sub: acc.id }),
      user: {
        id: acc.id,
        accountCode: acc.accountCode,
        phone: acc.phone,
        email: acc.email,
      },
    };
  }

  /** UC-03. Đổi mật khẩu chủ động khi đang đăng nhập (FR-51) */
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const acc = await this.prisma.account.findUnique({
      where: { id: userId },
    });

    if (!acc || acc.status !== 'ACTIVE') {
      throw new UnauthorizedException('Tài khoản không hợp lệ hoặc đã bị khóa');
    }

    if (acc.authType !== 'LOCAL' || !acc.passwordHash) {
      throw new BadRequestException('Tài khoản đăng nhập qua bên thứ ba không hỗ trợ đổi mật khẩu nội bộ');
    }

    const isOldValid = await verify(acc.passwordHash, dto.oldPassword);
    if (!isOldValid) {
      throw new BadRequestException('Mật khẩu hiện tại không chính xác');
    }

    const newPasswordHash = await hash(dto.newPassword);
    await this.prisma.account.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    return { success: true, message: 'Đổi mật khẩu thành công' };
  }

  /**
   * UC-03 / CSDL v1.2 §6.2: Khởi tạo thiết lập Google Authenticator (TOTP).
   */
  async setupTotp(userId: string) {
    const acc = await this.prisma.account.findUnique({
      where: { id: userId },
    });

    if (!acc || acc.status !== 'ACTIVE') {
      throw new UnauthorizedException('Tài khoản không hợp lệ');
    }

    if (acc.authType !== 'LOCAL') {
      throw new BadRequestException('Chức năng chỉ dành cho tài khoản đăng ký nội bộ');
    }

    const secret = generateTotpSecret();
    const secretEncrypted = encryptTotpSecret(secret, this.totpEncryptionKey);

    await this.prisma.totpCredential.upsert({
      where: { accountId: userId },
      update: {
        secretEncrypted,
        verified: false,
        lastTimeStep: null,
      },
      create: {
        accountId: userId,
        secretEncrypted,
        verified: false,
      },
    });

    const accountName = acc.phone || acc.email || acc.accountCode;
    const uri = getTotpUri(accountName, 'GiaPhaSo', secret);

    return {
      secret,
      uri,
      message: 'Vui lòng quét mã QR vào ứng dụng Google Authenticator và xác nhận mã 6 số để kích hoạt.',
    };
  }

  /**
   * UC-03 / CSDL v1.2 §6.2: Xác thực mã 6 số lần đầu để kích hoạt Google Authenticator.
   */
  async verifyTotpSetup(userId: string, dto: VerifyTotpSetupDto) {
    const totp = await this.prisma.totpCredential.findUnique({
      where: { accountId: userId },
    });

    if (!totp) {
      throw new BadRequestException('Chưa tạo yêu cầu thiết lập Google Authenticator');
    }

    const rawSecret = decryptTotpSecret(totp.secretEncrypted, this.totpEncryptionKey);
    const { valid, timeStep } = verifyTotp(rawSecret, dto.code, totp.lastTimeStep);

    if (!valid) {
      throw new BadRequestException('Mã xác thực không chính xác hoặc đã hết hạn');
    }

    await this.prisma.totpCredential.update({
      where: { accountId: userId },
      data: {
        verified: true,
        lastTimeStep: timeStep,
      },
    });

    return {
      success: true,
      message: 'Kích hoạt Google Authenticator thành công. Bạn có thể sử dụng ứng dụng để khôi phục mật khẩu khi cần.',
    };
  }

  /**
   * UC-03 / CSDL v1.2 §6.2: Quên mật khẩu - Xác thực mã Google Authenticator (TOTP).
   */
  async forgotPasswordVerifyTotp(dto: ForgotPasswordVerifyTotpDto) {
    const rawIdentifier = dto.identifier.trim();
    let acc: Account | null = null;

    if (rawIdentifier.includes('@')) {
      acc = await this.prisma.account.findUnique({
        where: { email: rawIdentifier.toLowerCase() },
      });
    } else {
      const phone = normalizeVnPhone(rawIdentifier);
      if (phone) {
        acc = await this.prisma.account.findUnique({ where: { phone } });
      }
    }

    if (!acc || acc.status !== 'ACTIVE' || acc.authType !== 'LOCAL') {
      throw new BadRequestException('Thông tin tài khoản hoặc mã xác thực không chính xác');
    }

    const totp = await this.prisma.totpCredential.findUnique({
      where: { accountId: acc.id },
    });

    if (!totp || !totp.verified) {
      throw new BadRequestException(
        'Tài khoản này chưa kích hoạt Google Authenticator. Vui lòng liên hệ Trưởng họ hoặc Kỹ thuật viên để được hỗ trợ.',
      );
    }

    const rawSecret = decryptTotpSecret(totp.secretEncrypted, this.totpEncryptionKey);
    const { valid, timeStep } = verifyTotp(rawSecret, dto.code, totp.lastTimeStep);

    if (!valid) {
      throw new BadRequestException('Thông tin tài khoản hoặc mã xác thực không chính xác');
    }

    // Cập nhật bước thời gian để chống replay attack
    await this.prisma.totpCredential.update({
      where: { id: totp.id },
      data: { lastTimeStep: timeStep },
    });

    // Sinh token khôi phục ngẫu nhiên (32 bytes hex)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Vô hiệu hóa các yêu cầu reset cũ chưa dùng của tài khoản này
    await this.prisma.passwordResetRequest.updateMany({
      where: { accountId: acc.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    // Tạo phiên đặt lại mật khẩu mới, hạn 15 phút
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await this.prisma.passwordResetRequest.create({
      data: {
        accountId: acc.id,
        tokenHash,
        expiresAt,
        usedAt: null,
      },
    });

    return {
      resetToken,
      expiresInMinutes: 15,
      message: 'Xác thực Google Authenticator thành công. Vui lòng đặt mật khẩu mới với token này trong vòng 15 phút.',
    };
  }

  /**
   * UC-03 / CSDL v1.2 §6.2: Đặt lại mật khẩu mới bằng resetToken hợp lệ.
   */
  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = crypto.createHash('sha256').update(dto.resetToken.trim()).digest('hex');

    const resetReq = await this.prisma.passwordResetRequest.findUnique({
      where: { tokenHash },
      include: { account: true },
    });

    if (!resetReq || resetReq.usedAt || resetReq.expiresAt < new Date()) {
      throw new BadRequestException('Mã khôi phục không hợp lệ hoặc đã hết hạn. Vui lòng thực hiện lại.');
    }

    if (resetReq.account.status !== 'ACTIVE') {
      throw new BadRequestException('Tài khoản đã bị khóa');
    }

    const newPasswordHash = await hash(dto.newPassword);

    await this.prisma.$transaction([
      this.prisma.account.update({
        where: { id: resetReq.accountId },
        data: { passwordHash: newPasswordHash },
      }),
      this.prisma.passwordResetRequest.update({
        where: { id: resetReq.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return {
      success: true,
      message: 'Đặt lại mật khẩu mới thành công! Bạn có thể dùng mật khẩu mới để đăng nhập.',
    };
  }
}
