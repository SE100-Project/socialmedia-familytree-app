import { IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  phone: string; // bắt buộc (FR-01); chuẩn hóa trong service

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @MinLength(8, { message: 'Mật khẩu phải từ 8 ký tự trở lên' })
  password: string;
}

export class LoginDto {
  @IsOptional()
  @IsString()
  identifier?: string; // SĐT hoặc Email (UC-02 / CSDL v1.2 §6.2)

  @IsOptional()
  @IsString()
  phone?: string; // Tương thích ngược

  @IsString()
  password: string;
}

export class ChangePasswordDto {
  @IsString()
  oldPassword: string;

  @IsString()
  @MinLength(8, { message: 'Mật khẩu phải từ 8 ký tự trở lên' })
  newPassword: string;
}

export class VerifyTotpSetupDto {
  @IsString()
  @Matches(/^[0-9]{6}$/, { message: 'Mã xác thực phải gồm đúng 6 chữ số' })
  code: string;
}

export class ForgotPasswordVerifyTotpDto {
  @IsString()
  identifier: string; // SĐT hoặc Email

  @IsString()
  @Matches(/^[0-9]{6}$/, { message: 'Mã xác thực phải gồm đúng 6 chữ số' })
  code: string;
}

export class ResetPasswordDto {
  @IsString()
  resetToken: string;

  @IsString()
  @MinLength(8, { message: 'Mật khẩu phải từ 8 ký tự trở lên' })
  newPassword: string;
}

export class GoogleLoginDto {
  @IsString()
  idToken: string; // Google ID Token (JWT)

  @IsOptional()
  @IsString()
  phone?: string; // Số điện thoại (bắt buộc khi tài khoản đăng nhập Google lần đầu)
}
