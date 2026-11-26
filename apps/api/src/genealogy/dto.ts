import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CalendarType, Gender, MemberStatus, RelationType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { CursorPaginationDto } from '../common/pagination.dto';

const trimString = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export class AncestorProfileInputDto {
  @ApiProperty({ example: 'Nguyễn Văn Tổ', description: 'Họ tên cụ tổ (thế hệ 1)' })
  @trimString()
  @IsString()
  @IsNotEmpty({ message: 'Họ tên tổ tiên không được để trống' })
  @MaxLength(120)
  fullName: string;

  @ApiProperty({ enum: Gender, example: Gender.MALE })
  @IsEnum(Gender, { message: 'Giới tính không hợp lệ' })
  gender: Gender;

  @ApiPropertyOptional({ example: '1920-01-01', description: 'Ngày sinh (ISO 8601)' })
  @IsOptional()
  @IsISO8601({}, { message: 'Ngày sinh phải đúng định dạng ISO 8601' })
  birthDate?: string;

  @ApiPropertyOptional({ example: '1990-05-10', description: 'Ngày mất (ISO 8601)' })
  @IsOptional()
  @IsISO8601({}, { message: 'Ngày mất phải đúng định dạng ISO 8601' })
  deathDate?: string;

  @ApiPropertyOptional({ enum: CalendarType, example: CalendarType.LUNAR })
  @IsOptional()
  @IsEnum(CalendarType, { message: 'Loại lịch ngày mất phải là SOLAR hoặc LUNAR' })
  deathCalendar?: CalendarType;

  @ApiPropertyOptional({
    enum: [MemberStatus.ALIVE, MemberStatus.DECEASED],
    default: MemberStatus.DECEASED,
  })
  @IsOptional()
  @IsIn([MemberStatus.ALIVE, MemberStatus.DECEASED], {
    message: 'Trạng thái chỉ được là ALIVE hoặc DECEASED',
  })
  status?: MemberStatus;

  @ApiPropertyOptional({ example: 'Thủy tổ lập họ' })
  @IsOptional()
  @trimString()
  @IsString()
  @MaxLength(1000)
  bio?: string;
}

export class CreatorProfileInputDto {
  @ApiProperty({
    example: 'Nguyễn Văn An',
    description: 'Họ tên Trưởng họ đầu tiên (người khởi tạo)',
  })
  @trimString()
  @IsString()
  @IsNotEmpty({ message: 'Họ tên người khởi tạo không được để trống' })
  @MaxLength(120)
  fullName: string;

  @ApiProperty({ enum: Gender, example: Gender.MALE })
  @IsEnum(Gender, { message: 'Giới tính không hợp lệ' })
  gender: Gender;

  @ApiPropertyOptional({ example: 3, default: 2, description: 'Đời thứ (mặc định 2)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  generation?: number;

  @ApiPropertyOptional({ example: '1970-03-15', description: 'Ngày sinh (ISO 8601)' })
  @IsOptional()
  @IsISO8601({}, { message: 'Ngày sinh phải đúng định dạng ISO 8601' })
  birthDate?: string;

  @ApiPropertyOptional({ example: 'Trưởng họ đời thứ 3' })
  @IsOptional()
  @trimString()
  @IsString()
  @MaxLength(1000)
  bio?: string;
}

export class CreateClanDto {
  @ApiProperty({ example: 'Dòng họ Nguyễn Văn', description: 'Tên dòng họ' })
  @trimString()
  @IsString()
  @IsNotEmpty({ message: 'Tên dòng họ không được để trống' })
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({
    example: 'CLAN-NGUYEN-01',
    description: 'Mã dòng họ duy nhất (tự sinh nếu bỏ trống)',
  })
  @IsOptional()
  @trimString()
  @IsString()
  @IsNotEmpty({ message: 'Mã dòng họ không được chỉ chứa khoảng trắng' })
  @MaxLength(40)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'Mã dòng họ chỉ được gồm chữ cái, số, dấu gạch ngang hoặc gạch dưới',
  })
  clanCode?: string;

  @ApiProperty({ type: AncestorProfileInputDto })
  @ValidateNested()
  @Type(() => AncestorProfileInputDto)
  ancestor: AncestorProfileInputDto;

  @ApiProperty({ type: CreatorProfileInputDto })
  @ValidateNested()
  @Type(() => CreatorProfileInputDto)
  creator: CreatorProfileInputDto;
}

export class CreateBranchDto {
  @ApiProperty({ example: 'Chi Ba', description: 'Tên chi trong dòng họ' })
  @trimString()
  @IsString()
  @IsNotEmpty({ message: 'Tên chi không được để trống' })
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID hồ sơ Trưởng chi được chỉ định ngay (tùy chọn)',
  })
  @IsOptional()
  @IsUUID('all', { message: 'branchHeadProfileId phải là UUID hợp lệ' })
  branchHeadProfileId?: string;
}

export class UpdateBranchDto {
  @ApiPropertyOptional({ example: 'Chi Ba (Cành Đông)' })
  @IsOptional()
  @trimString()
  @IsString()
  @IsNotEmpty({ message: 'Tên chi không được để trống' })
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    nullable: true,
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID hồ sơ Trưởng chi mới; truyền null để bỏ trống Trưởng chi (BR-04)',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID('all', { message: 'branchHeadProfileId phải là UUID hợp lệ' })
  branchHeadProfileId?: string | null;
}

export class CreateProfileDto {
  @ApiPropertyOptional({
    nullable: true,
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID chi (null nếu thuộc gốc toàn họ)',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID('all', { message: 'branchId phải là UUID hợp lệ' })
  branchId?: string | null;

  @ApiProperty({ example: 'Nguyễn Minh Quân' })
  @trimString()
  @IsString()
  @IsNotEmpty({ message: 'Họ tên thành viên không được để trống' })
  @MaxLength(120)
  fullName: string;

  @ApiProperty({ enum: Gender, example: Gender.MALE })
  @IsEnum(Gender, { message: 'Giới tính không hợp lệ' })
  gender: Gender;

  @ApiPropertyOptional({ example: '1999-09-20' })
  @IsOptional()
  @IsISO8601({}, { message: 'Ngày sinh phải đúng định dạng ISO 8601' })
  birthDate?: string;

  @ApiPropertyOptional({ example: '2024-02-01' })
  @IsOptional()
  @IsISO8601({}, { message: 'Ngày mất phải đúng định dạng ISO 8601' })
  deathDate?: string;

  @ApiPropertyOptional({ enum: CalendarType })
  @IsOptional()
  @IsEnum(CalendarType, { message: 'Loại lịch ngày mất phải là SOLAR hoặc LUNAR' })
  deathCalendar?: CalendarType;

  @ApiPropertyOptional({
    enum: [MemberStatus.ALIVE, MemberStatus.DECEASED],
    default: MemberStatus.ALIVE,
  })
  @IsOptional()
  @IsIn([MemberStatus.ALIVE, MemberStatus.DECEASED], {
    message: 'Trạng thái tạo mới chỉ được là ALIVE hoặc DECEASED',
  })
  status?: MemberStatus;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  generation?: number;

  @ApiPropertyOptional({ example: 'Kỹ sư phần mềm' })
  @IsOptional()
  @trimString()
  @IsString()
  @MaxLength(1000)
  bio?: string;
}

export class UpdateProfileDto {
  @ApiProperty({
    example: '2026-10-25T08:00:00.000Z',
    description: 'Giá trị updatedAt hiện có của hồ sơ để khóa lạc quan (tránh ghi đè đồng thời)',
  })
  @IsISO8601({}, { message: 'expectedUpdatedAt phải đúng định dạng ISO 8601' })
  expectedUpdatedAt: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID('all', { message: 'branchId phải là UUID hợp lệ' })
  branchId?: string | null;

  @ApiPropertyOptional({ example: 'Nguyễn Minh Quân' })
  @IsOptional()
  @trimString()
  @IsString()
  @IsNotEmpty({ message: 'Họ tên thành viên không được để trống' })
  @MaxLength(120)
  fullName?: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender, { message: 'Giới tính không hợp lệ' })
  gender?: Gender;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsISO8601({}, { message: 'Ngày sinh phải đúng định dạng ISO 8601' })
  birthDate?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsISO8601({}, { message: 'Ngày mất phải đúng định dạng ISO 8601' })
  deathDate?: string | null;

  @ApiPropertyOptional({ enum: CalendarType, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsEnum(CalendarType, { message: 'Loại lịch ngày mất phải là SOLAR hoặc LUNAR' })
  deathCalendar?: CalendarType | null;

  @ApiPropertyOptional({ enum: [MemberStatus.ALIVE, MemberStatus.DECEASED] })
  @IsOptional()
  @IsIn([MemberStatus.ALIVE, MemberStatus.DECEASED], {
    message: 'Trạng thái cập nhật chỉ được là ALIVE hoặc DECEASED (muốn xóa hãy dùng DELETE)',
  })
  status?: MemberStatus;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  generation?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @trimString()
  @IsString()
  @MaxLength(1000)
  bio?: string | null;
}

export class SoftDeleteProfileQueryDto {
  @ApiPropertyOptional({
    example: '2026-10-25T08:00:00.000Z',
    description: 'Tùy chọn khóa lạc quan ISO 8601 khi xóa mềm',
  })
  @IsOptional()
  @IsISO8601({}, { message: 'expectedUpdatedAt phải đúng định dạng ISO 8601' })
  expectedUpdatedAt?: string;
}

export class ListProfilesQueryDto extends CursorPaginationDto {
  @ApiPropertyOptional({ description: 'Lọc theo chi' })
  @IsOptional()
  @IsUUID('all', { message: 'branchId phải là UUID hợp lệ' })
  branchId?: string;

  @ApiPropertyOptional({ description: 'Lọc theo đời/thế hệ' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  generation?: number;

  @ApiPropertyOptional({
    enum: MemberStatus,
    description: 'Lọc theo trạng thái (mặc định trả toàn bộ kể cả REMOVED trừ khi chỉ định)',
  })
  @IsOptional()
  @IsEnum(MemberStatus)
  status?: MemberStatus;

  @ApiPropertyOptional({ description: 'Tìm kiếm theo họ tên (không phân biệt hoa thường)' })
  @IsOptional()
  @trimString()
  @IsString()
  @MaxLength(120)
  search?: string;
}

export class CreateRelationshipDto {
  @ApiProperty({ enum: RelationType, example: RelationType.PARENT_CHILD })
  @IsEnum(RelationType, { message: 'Loại quan hệ phải là PARENT_CHILD hoặc SPOUSE' })
  type: RelationType;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440001',
    description: 'Hồ sơ nguồn (với PARENT_CHILD là ID cha/mẹ)',
  })
  @IsUUID('all', { message: 'fromId phải là UUID hợp lệ' })
  fromId: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440002',
    description: 'Hồ sơ đích (với PARENT_CHILD là ID con)',
  })
  @IsUUID('all', { message: 'toId phải là UUID hợp lệ' })
  toId: string;

  @ApiPropertyOptional({
    example: '2000-06-18',
    description: 'Ngày bắt đầu quan hệ (VD ngày cưới)',
  })
  @IsOptional()
  @IsISO8601({}, { message: 'startDate phải đúng định dạng ISO 8601' })
  startDate?: string;
}

export class ListRelationshipsQueryDto {
  @ApiPropertyOptional({ description: 'Lọc các quan hệ liên quan đến một hồ sơ cụ thể' })
  @IsOptional()
  @IsUUID('all', { message: 'profileId phải là UUID hợp lệ' })
  profileId?: string;
}
