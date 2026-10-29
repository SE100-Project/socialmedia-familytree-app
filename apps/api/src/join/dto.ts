import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Gender, JoinRequestKind, RequestStatus } from '@prisma/client';

export class CreateJoinRequestDto {
  @ApiProperty({
    enum: JoinRequestKind,
    description: 'Hình thức xin gia nhập: theo mã dòng họ (BY_CLAN_CODE) hoặc theo mã tài khoản người thân (BY_ACCOUNT_CODE)',
    example: JoinRequestKind.BY_CLAN_CODE,
  })
  @IsEnum(JoinRequestKind, {
    message: 'Hình thức xin gia nhập phải là BY_CLAN_CODE hoặc BY_ACCOUNT_CODE',
  })
  kind: JoinRequestKind;

  @ApiProperty({
    description: 'Mã dòng họ (nếu BY_CLAN_CODE) hoặc Mã tài khoản người thân (nếu BY_ACCOUNT_CODE)',
    example: 'CLAN-NGUYEN-DG',
  })
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng cung cấp mã tham chiếu (mã gia phả hoặc mã tài khoản)' })
  referenceCode: string;

  @ApiPropertyOptional({
    description: 'Quan hệ khai báo (ví dụ: Con, Cháu, Dâu, Rể, Em...)',
    example: 'Con',
  })
  @IsOptional()
  @IsString()
  declaredRelation?: string;

  @ApiPropertyOptional({
    description: 'Mã chi nhánh muốn xin gia nhập (tùy chọn khi dùng mã dòng họ)',
    example: 'uuid-branch-1',
  })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({
    description: 'ID hồ sơ thành viên định vị cụ thể (nếu có)',
    example: 'uuid-profile-1',
  })
  @IsOptional()
  @IsString()
  targetProfileId?: string;
}

export class CreateProfileDataDto {
  @ApiProperty({ example: 'Nguyễn Văn C' })
  @IsString()
  @IsNotEmpty({ message: 'Họ tên thành viên không được để trống' })
  fullName: string;

  @ApiProperty({ enum: Gender, example: Gender.MALE })
  @IsEnum(Gender, { message: 'Giới tính không hợp lệ (MALE, FEMALE, OTHER)' })
  gender: Gender;

  @ApiPropertyOptional({ example: '1995-08-20' })
  @IsOptional()
  @IsDateString({}, { message: 'Ngày sinh phải có định dạng YYYY-MM-DD' })
  birthDate?: string;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  generation?: number;

  @ApiPropertyOptional({ example: 'uuid-branch-1' })
  @IsOptional()
  @IsString()
  branchId?: string;
}

export class ApproveJoinRequestDto {
  @ApiPropertyOptional({
    description: 'ID hồ sơ có sẵn chưa có chủ để liên kết (nếu chọn hồ sơ sẵn có)',
    example: 'uuid-profile-1',
  })
  @IsOptional()
  @IsString()
  profileId?: string;

  @ApiPropertyOptional({
    description: 'Dữ liệu tạo hồ sơ mới nếu người xin gia nhập chưa có hồ sơ trên cây',
    type: CreateProfileDataDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateProfileDataDto)
  newProfileData?: CreateProfileDataDto;

  @ApiPropertyOptional({
    description: 'Lý do hoặc ghi chú phê duyệt',
    example: 'Đã xác minh đúng là con trưởng chi',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class RejectJoinRequestDto {
  @ApiProperty({
    description: 'Lý do từ chối (bắt buộc theo BR-12 / UC-05)',
    example: 'Thông tin nhân thân không chính xác',
  })
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập lý do từ chối' })
  reason: string;
}

export class ListJoinRequestsQueryDto {
  @ApiPropertyOptional({ enum: RequestStatus, description: 'Lọc theo trạng thái yêu cầu' })
  @IsOptional()
  @IsEnum(RequestStatus)
  status?: RequestStatus;

  @ApiPropertyOptional({ description: 'Lọc theo ID dòng họ' })
  @IsOptional()
  @IsString()
  clanId?: string;

  @ApiPropertyOptional({ description: 'Lọc theo ID chi nhánh' })
  @IsOptional()
  @IsString()
  branchId?: string;
}
