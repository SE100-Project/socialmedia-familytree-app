import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthUser, JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CursorPaginationDto } from '../common/pagination.dto';
import { BranchService } from './branch.service';
import { ClanService } from './clan.service';
import {
  CreateBranchDto,
  CreateClanDto,
  CreateProfileDto,
  CreateRelationshipDto,
  ListProfilesQueryDto,
  ListRelationshipsQueryDto,
  SoftDeleteProfileQueryDto,
  UpdateBranchDto,
  UpdateProfileDto,
} from './dto';
import { ProfileService } from './profile.service';
import { RelationshipService } from './relationship.service';

@ApiTags('Clans (UC-07)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('clans')
export class ClansController {
  constructor(private readonly clanService: ClanService) {}

  @Post()
  @ApiOperation({ summary: 'Khởi tạo dòng họ đầu tiên (chỉ khi hệ thống còn trống)' })
  @ApiResponse({
    status: 201,
    description: 'Khởi tạo dòng họ thành công, người tạo thành CLAN_HEAD',
  })
  @ApiResponse({ status: 409, description: 'Hệ thống đã có dòng họ hoặc tài khoản đã liên kết' })
  createClan(@CurrentUser() user: AuthUser, @Body() dto: CreateClanDto) {
    return this.clanService.createClan(user, dto);
  }

  @Get('current')
  @ApiOperation({ summary: 'Lấy thông tin dòng họ của thành viên hiện tại' })
  getCurrentClan(@CurrentUser() user: AuthUser) {
    return this.clanService.getCurrentClan(user);
  }
}

@ApiTags('Branches (UC-08)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('branches')
export class BranchesController {
  constructor(private readonly branchService: BranchService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách chi trong dòng họ (có phân trang con trỏ)' })
  listBranches(@CurrentUser() user: AuthUser, @Query() query: CursorPaginationDto) {
    return this.branchService.listBranches(user, query);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo chi mới (chỉ Trưởng họ)' })
  @ApiResponse({ status: 403, description: 'Không phải Trưởng họ' })
  @ApiResponse({ status: 409, description: 'Tên chi đã tồn tại trong dòng họ' })
  createBranch(@CurrentUser() user: AuthUser, @Body() dto: CreateBranchDto) {
    return this.branchService.createBranch(user, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Đổi tên chi hoặc chỉ định/bỏ trống Trưởng chi (chỉ Trưởng họ, BR-04)' })
  @ApiResponse({ status: 403, description: 'Không phải Trưởng họ' })
  updateBranch(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBranchDto,
  ) {
    return this.branchService.updateBranch(user, id, dto);
  }
}

@ApiTags('Profiles (UC-10)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách hồ sơ thành viên trong dòng họ' })
  listProfiles(@CurrentUser() user: AuthUser, @Query() query: ListProfilesQueryDto) {
    return this.profileService.listProfiles(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết hồ sơ thành viên (bao gồm updatedAt để khóa lạc quan)' })
  getProfile(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.profileService.getProfileById(user, id);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo hồ sơ thành viên trực tiếp (theo phạm vi chi)' })
  createProfile(@CurrentUser() user: AuthUser, @Body() dto: CreateProfileDto) {
    return this.profileService.createProfile(user, dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Cập nhật hồ sơ thành viên (khóa lạc quan expectedUpdatedAt, kiểm phạm vi chi)',
  })
  @ApiResponse({ status: 409, description: 'Xung đột phiên bản do thao tác cập nhật đồng thời' })
  updateProfile(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profileService.updateProfile(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Xóa mềm hồ sơ thành viên (status = REMOVED, giữ nút và quan hệ trên cây)',
  })
  softDeleteProfile(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: SoftDeleteProfileQueryDto,
  ) {
    return this.profileService.softDeleteProfile(user, id, query.expectedUpdatedAt);
  }
}

@ApiTags('Relationships (UC-10)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('relationships')
export class RelationshipsController {
  constructor(private readonly relationshipService: RelationshipService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách quan hệ phả hệ trong dòng họ' })
  listRelationships(@CurrentUser() user: AuthUser, @Query() query: ListRelationshipsQueryDto) {
    return this.relationshipService.listRelationships(user, query);
  }

  @Post()
  @ApiOperation({ summary: 'Thêm quan hệ cha/mẹ - con hoặc vợ/chồng (chặn trùng và vòng tổ tiên)' })
  @ApiResponse({ status: 400, description: 'Tự tham chiếu, khác dòng họ hoặc tạo vòng tổ tiên' })
  @ApiResponse({ status: 409, description: 'Quan hệ đã tồn tại' })
  createRelationship(@CurrentUser() user: AuthUser, @Body() dto: CreateRelationshipDto) {
    return this.relationshipService.createRelationship(user, dto);
  }
}
