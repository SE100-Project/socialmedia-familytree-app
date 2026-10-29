import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, AuthUser } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JoinService } from './join.service';
import {
  ApproveJoinRequestDto,
  CreateJoinRequestDto,
  ListJoinRequestsQueryDto,
  RejectJoinRequestDto,
} from './dto';

@ApiTags('Join Requests (Gia nhập dòng họ - UC-04, UC-05)')
@Controller('join-requests')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class JoinController {
  constructor(private readonly joinService: JoinService) {}

  @Post()
  @ApiOperation({
    summary: 'UC-04 (B1-06): Gửi yêu cầu xin gia nhập gia phả (theo mã dòng họ hoặc mã người thân)',
  })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateJoinRequestDto) {
    return this.joinService.createJoinRequest(user, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'UC-05 (B1-07): Lấy danh sách hàng đợi yêu cầu gia nhập theo phạm vi quyền quản lý',
  })
  list(@CurrentUser() user: AuthUser, @Query() query: ListJoinRequestsQueryDto) {
    return this.joinService.listJoinRequests(user, query);
  }

  @Post(':id/approve')
  @HttpCode(200)
  @ApiOperation({
    summary: 'UC-05 (B1-07, B1-08): Phê duyệt yêu cầu gia nhập và liên kết hồ sơ phả hệ',
  })
  approve(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ApproveJoinRequestDto,
  ) {
    return this.joinService.approveJoinRequest(user, id, dto);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @ApiOperation({
    summary: 'UC-05 (B1-07): Từ chối yêu cầu gia nhập (bắt buộc nhập lý do)',
  })
  reject(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RejectJoinRequestDto,
  ) {
    return this.joinService.rejectJoinRequest(user, id, dto);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @ApiOperation({
    summary: 'FR-52 (B1-07): Người gửi tự hủy yêu cầu gia nhập khi còn đang Chờ duyệt (PENDING)',
  })
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.joinService.cancelJoinRequest(user, id);
  }
}
