import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  ForgotPasswordVerifyTotpDto,
  GoogleLoginDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  VerifyTotpSetupDto,
} from './dto';
import { AuthUser, JwtAuthGuard } from './auth.guard';
import { CurrentUser } from './current-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'UC-01. Đăng ký tài khoản mới bằng số điện thoại' })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'UC-02. Đăng nhập bằng số điện thoại hoặc email' })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('google')
  @HttpCode(200)
  @ApiOperation({ summary: 'CSDL v1.2 §6.2: Đăng nhập / Đăng ký qua Google Sign-In' })
  googleLogin(@Body() dto: GoogleLoginDto) {
    return this.auth.googleLogin(dto);
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Lấy thông tin tài khoản và vai trò đang đăng nhập (hợp đồng FE-1)' })
  me(@CurrentUser() user: AuthUser) {
    return {
      id: user.id,
      accountCode: user.accountCode,
      phone: user.phone,
      email: user.email,
      status: user.status,
      profileId: user.profileId,
      clanId: user.clanId,
      profileLinks: user.profileLinks,
      roles: user.roles,
    };
  }

  @Post('change-password')
  @HttpCode(200)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'UC-03. Đổi mật khẩu chủ động khi đang đăng nhập' })
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user.id, dto);
  }

  @Post('totp/setup')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'CSDL v1.2 §6.2: Khởi tạo mã bí mật Google Authenticator' })
  setupTotp(@CurrentUser() user: AuthUser) {
    return this.auth.setupTotp(user.id);
  }

  @Post('totp/verify-setup')
  @HttpCode(200)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'CSDL v1.2 §6.2: Xác thực mã 6 số để kích hoạt Google Authenticator' })
  verifyTotpSetup(@CurrentUser() user: AuthUser, @Body() dto: VerifyTotpSetupDto) {
    return this.auth.verifyTotpSetup(user.id, dto);
  }

  @Post('forgot-password/verify-totp')
  @HttpCode(200)
  @ApiOperation({ summary: 'UC-03. Quên mật khẩu: Xác thực mã TOTP từ Google Authenticator để lấy resetToken' })
  forgotPasswordVerifyTotp(@Body() dto: ForgotPasswordVerifyTotpDto) {
    return this.auth.forgotPasswordVerifyTotp(dto);
  }

  @Post('reset-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'UC-03. Đặt lại mật khẩu mới bằng resetToken' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }
}
