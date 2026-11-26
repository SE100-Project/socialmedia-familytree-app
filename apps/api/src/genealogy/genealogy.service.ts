import { Inject, Injectable } from '@nestjs/common';
import { Clan, Relationship } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/auth.guard';
import { PolicyService } from '../auth/policy.service';
import { CursorPaginationDto, PaginatedResult } from '../common/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { BranchService, BranchView } from './branch.service';
import { ClanService, InitClanResult } from './clan.service';
import {
  CreateBranchDto,
  CreateClanDto,
  CreateRelationshipDto,
  ListRelationshipsQueryDto,
  UpdateBranchDto,
} from './dto';
import { ProfileService } from './profile.service';
import { RelationshipService } from './relationship.service';
import { TREE_ANCESTOR_CHECKER, TreeAncestorChecker } from './tree-ancestor.port';

export type { BranchHeadSummary, BranchView } from './branch.service';
export type { InitClanResult } from './clan.service';

/**
 * Facade điều phối nhóm nghiệp vụ phả hệ (GRASP Facade / Indirection).
 * Ủy quyền hoàn toàn cho các service chuyên trách `ClanService`, `BranchService`, `RelationshipService` (SRP & High Cohesion).
 */
@Injectable()
export class GenealogyService {
  private readonly clanService: ClanService;
  private readonly branchService: BranchService;
  private readonly relationshipService: RelationshipService;

  constructor(
    prisma: PrismaService,
    policy: PolicyService,
    audit: AuditService,
    profileService: ProfileService,
    @Inject(TREE_ANCESTOR_CHECKER)
    treeAncestorChecker: TreeAncestorChecker,
  ) {
    this.clanService = new ClanService(prisma, policy, audit, profileService);
    this.branchService = new BranchService(prisma, policy, audit);
    this.relationshipService = new RelationshipService(prisma, policy, audit, treeAncestorChecker);
  }

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
