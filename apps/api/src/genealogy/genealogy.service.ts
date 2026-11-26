import { Injectable } from '@nestjs/common';
import { Clan, Relationship } from '@prisma/client';
import { AuthUser } from '../auth/auth.guard';
import { CursorPaginationDto, PaginatedResult } from '../common/pagination.dto';
import { BranchService, BranchView } from './branch.service';
import { ClanService, InitClanResult } from './clan.service';
import {
  CreateBranchDto,
  CreateClanDto,
  CreateRelationshipDto,
  ListRelationshipsQueryDto,
  UpdateBranchDto,
} from './dto';
import { RelationshipService } from './relationship.service';

export type { BranchHeadSummary, BranchView } from './branch.service';
export type { InitClanResult } from './clan.service';

/**
 * Facade điều phối nhóm nghiệp vụ phả hệ (GRASP Facade / Indirection).
 * Nhận trực tiếp các NestJS singleton `ClanService`, `BranchService`, `RelationshipService` qua DI.
 */
@Injectable()
export class GenealogyService {
  constructor(
    private readonly clanService: ClanService,
    private readonly branchService: BranchService,
    private readonly relationshipService: RelationshipService,
  ) {}

  createClan(user: AuthUser, dto: CreateClanDto): Promise<InitClanResult> {
    return this.clanService.createClan(user, dto);
  }

  getCurrentClan(user: AuthUser): Promise<Clan> {
    return this.clanService.getCurrentClan(user);
  }

  listBranches(user: AuthUser, query: CursorPaginationDto): Promise<PaginatedResult<BranchView>> {
    return this.branchService.listBranches(user, query);
  }

  createBranch(user: AuthUser, dto: CreateBranchDto): Promise<BranchView> {
    return this.branchService.createBranch(user, dto);
  }

  updateBranch(user: AuthUser, branchId: string, dto: UpdateBranchDto): Promise<BranchView> {
    return this.branchService.updateBranch(user, branchId, dto);
  }

  createRelationship(user: AuthUser, dto: CreateRelationshipDto): Promise<Relationship> {
    return this.relationshipService.createRelationship(user, dto);
  }

  listRelationships(user: AuthUser, query: ListRelationshipsQueryDto): Promise<Relationship[]> {
    return this.relationshipService.listRelationships(user, query);
  }
}
