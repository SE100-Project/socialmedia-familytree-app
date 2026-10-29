import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './auth.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { generateTotpCode } from '../common/totp';

describe('AuthService Integration Test', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwt: JwtService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({ JWT_ACCESS_SECRET: 'test-jwt-secret-very-secure-12345678' })],
        }),
        JwtModule.register({
          secret: 'test-jwt-secret-very-secure-12345678',
          signOptions: { expiresIn: '15m' },
        }),
        PrismaModule,
      ],
      providers: [AuthService],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwt = module.get<JwtService>(JwtService);
  });

  const lockedPhone = '0966554433';

  const testPhone = '0988776655';
  const testEmail = 'authtest@giapha.vn';
  const testPass = 'Password123@';
  const newPass = 'NewPassword456@';

  const googlePhone = '0977665544';
  const googleSub = 'google-sub-unique-id-99999';
  const googleEmail = 'googleuser999@gmail.com';
  const mockGoogleToken = `mock_google_id_token_${googleSub}_${googleEmail}`;

  afterAll(async () => {
    // Cleanup test data
    const phones = [testPhone, googlePhone, lockedPhone];
    for (const p of phones) {
      const acc = await prisma.account.findUnique({ where: { phone: p } });
      if (acc) {
        await prisma.passwordResetRequest.deleteMany({ where: { accountId: acc.id } });
        await prisma.totpCredential.deleteMany({ where: { accountId: acc.id } });
        await prisma.account.delete({ where: { id: acc.id } });
      }
    }
    await prisma.$disconnect();
  });

  it('UC-01: Đăng ký tài khoản mới thành công', async () => {
    const res = await service.register({
      phone: testPhone,
      email: testEmail,
      password: testPass,
    });

    expect(res).toBeDefined();
    expect(res.phone).toBe(testPhone);
    expect(res.accountCode).toHaveLength(8);
  });

  it('UC-02: Đăng nhập thành công bằng Số điện thoại', async () => {
    const res = await service.login({
      identifier: testPhone,
      password: testPass,
    });

    expect(res.accessToken).toBeDefined();
    expect(res.user.phone).toBe(testPhone);
  });

  it('UC-02: Đăng nhập thành công bằng Email', async () => {
    const res = await service.login({
      identifier: testEmail,
      password: testPass,
    });

    expect(res.accessToken).toBeDefined();
    expect(res.user.email).toBe(testEmail);
  });

  it('UC-03: Đổi mật khẩu chủ động thành công', async () => {
    const acc = await prisma.account.findUniqueOrThrow({ where: { phone: testPhone } });
    const res = await service.changePassword(acc.id, {
      oldPassword: testPass,
      newPassword: newPass,
    });

    expect(res.success).toBe(true);

    // Thử đăng nhập lại bằng mật khẩu mới
    const loginRes = await service.login({
      identifier: testPhone,
      password: newPass,
    });
    expect(loginRes.accessToken).toBeDefined();
  });

  it('CSDL v1.2 §6.2: Thiết lập và Kích hoạt Google Authenticator (TOTP)', async () => {
    const acc = await prisma.account.findUniqueOrThrow({ where: { phone: testPhone } });

    // Bước 1: Setup
    const setup = await service.setupTotp(acc.id);
    expect(setup.secret).toBeDefined();
    expect(setup.uri).toContain('otpauth://totp/GiaPhaSo:');

    // Bước 2: Sinh mã OTP và kích hoạt (ở step hiện tại)
    const timeStep = Math.floor(Date.now() / 1000 / 30);
    const code = generateTotpCode(setup.secret, timeStep);

    const verifyRes = await service.verifyTotpSetup(acc.id, { code });
    expect(verifyRes.success).toBe(true);
  });

  it('UC-03: Quên mật khẩu qua TOTP và đặt lại mật khẩu thành công', async () => {
    const acc = await prisma.account.findUniqueOrThrow({ where: { phone: testPhone } });

    // Thiết lập TOTP mới
    const setup = await service.setupTotp(acc.id);
    const currentStep = Math.floor(Date.now() / 1000 / 30);

    // Kích hoạt với lastTimeStep là 1 bước trước đó để step hiện tại chưa bị tính là replay
    await service.verifyTotpSetup(acc.id, {
      code: generateTotpCode(setup.secret, currentStep - 1),
    });

    // Sinh mã hợp lệ tại currentStep
    const validCode = generateTotpCode(setup.secret, currentStep);

    // Bước 1: Gửi SĐT + mã TOTP để lấy resetToken
    const forgotRes = await service.forgotPasswordVerifyTotp({
      identifier: testPhone,
      code: validCode,
    });
    expect(forgotRes.resetToken).toBeDefined();
    expect(forgotRes.expiresInMinutes).toBe(15);

    // Bước 2: Đặt lại mật khẩu mới bằng resetToken
    const brandNewPass = 'BrandNewPass789@';
    const resetRes = await service.resetPassword({
      resetToken: forgotRes.resetToken,
      newPassword: brandNewPass,
    });
    expect(resetRes.success).toBe(true);

    // Bước 3: Đăng nhập thành công với mật khẩu mới vừa đổi
    const loginBrandNew = await service.login({
      identifier: testPhone,
      password: brandNewPass,
    });
    expect(loginBrandNew.accessToken).toBeDefined();
  });

  it('CSDL v1.2 §6.2: Xác thực tài khoản qua Google Sign-In', async () => {
    // 1. Đăng nhập lần đầu khi chưa có số điện thoại -> Yêu cầu nhập SĐT
    const firstLogin = await service.googleLogin({
      idToken: mockGoogleToken,
    });
    expect('needPhone' in firstLogin && firstLogin.needPhone).toBe(true);

    // 2. Cung cấp số điện thoại để hoàn tất đăng ký tài khoản Google
    const registerGoogle = await service.googleLogin({
      idToken: mockGoogleToken,
      phone: googlePhone,
    });
    expect('accessToken' in registerGoogle).toBe(true);
    if ('user' in registerGoogle && registerGoogle.user) {
      expect(registerGoogle.user.phone).toBe(googlePhone);
      expect(registerGoogle.user.email).toBe(googleEmail);
    }

    // Kiểm tra trong DB: passwordHash phải là NULL và authType là GOOGLE
    const googleAcc = await prisma.account.findUniqueOrThrow({ where: { googleSub } });
    expect(googleAcc.passwordHash).toBeNull();
    expect(googleAcc.authType).toBe('GOOGLE');

    // 3. Đăng nhập lần tiếp theo với cùng Google Token -> Đăng nhập thành công ngay lập tức
    const reLogin = await service.googleLogin({
      idToken: mockGoogleToken,
    });
    expect('accessToken' in reLogin).toBe(true);
  });

  it('B1-05: Chặn đăng nhập khi tài khoản bị khóa (status = LOCKED)', async () => {
    // Đăng ký tài khoản thử nghiệm
    await service.register({
      phone: lockedPhone,
      password: testPass,
    });
    await prisma.account.update({
      where: { phone: lockedPhone },
      data: { status: 'LOCKED' },
    });

    await expect(
      service.login({
        identifier: lockedPhone,
        password: testPass,
      }),
    ).rejects.toThrow(new UnauthorizedException('Tài khoản đã bị khóa'));
  });

  it('NFR-02 / B1-05: Giới hạn tần suất đăng nhập (HTTP 429 sau 5 lần nhập sai)', async () => {
    const brutePhone = '0911223344';
    service.resetLoginRateLimit(brutePhone);

    // Thử sai 5 lần
    for (let i = 0; i < 5; i++) {
      await expect(
        service.login({
          identifier: brutePhone,
          password: 'WrongPassword123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    }

    // Lần thứ 6 bị chặn với mã HTTP 429 TOO_MANY_REQUESTS
    try {
      await service.login({
        identifier: brutePhone,
        password: 'WrongPassword123',
      });
      throw new Error('Mong đợi ngoại lệ HTTP 429 nhưng hàm không ném lỗi');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }

    service.resetLoginRateLimit(brutePhone);
  });

  it('B1-05 / NFR-02: JwtAuthGuard từ chối truy cập ngay lập tức nếu tài khoản bị khóa', async () => {
    const guard = new JwtAuthGuard(jwt, prisma);

    const acc = await prisma.account.findUniqueOrThrow({ where: { phone: testPhone } });
    const token = await jwt.signAsync({ sub: acc.id });

    const mockCtx = (authToken: string) =>
      ({
        switchToHttp: () => ({
          getRequest: () => ({
            headers: { authorization: `Bearer ${authToken}` },
          }),
        }),
      }) as any;

    // Khi tài khoản ACTIVE -> Guard cho phép
    await expect(guard.canActivate(mockCtx(token))).resolves.toBe(true);

    // Khóa tài khoản
    await prisma.account.update({
      where: { id: acc.id },
      data: { status: 'LOCKED' },
    });

    // Guard từ chối ngay lập tức
    await expect(guard.canActivate(mockCtx(token))).rejects.toThrow(
      new UnauthorizedException('Tài khoản đã bị khóa hoặc không tồn tại'),
    );

    // Phục hồi tài khoản ACTIVE cho các luồng khác
    await prisma.account.update({
      where: { id: acc.id },
      data: { status: 'ACTIVE' },
    });
  });
});
