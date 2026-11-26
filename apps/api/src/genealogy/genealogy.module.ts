import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BranchService } from './branch.service';
import { ClanService } from './clan.service';
import {
  BranchesController,
  ClansController,
  ProfilesController,
  RelationshipsController,
} from './genealogy.controller';
import { GenealogyService } from './genealogy.service';
import { ProfileService } from './profile.service';
import { RelationshipService } from './relationship.service';
import { StubTreeAncestorChecker, TREE_ANCESTOR_CHECKER } from './tree-ancestor.port';

@Module({
  imports: [AuthModule],
  controllers: [ClansController, BranchesController, ProfilesController, RelationshipsController],
  providers: [
    ClanService,
    BranchService,
    ProfileService,
    RelationshipService,
    GenealogyService,
    {
      provide: TREE_ANCESTOR_CHECKER,
      useClass: StubTreeAncestorChecker,
    },
  ],
  exports: [
    ClanService,
    BranchService,
    ProfileService,
    RelationshipService,
    GenealogyService,
    TREE_ANCESTOR_CHECKER,
  ],
})
export class GenealogyModule {}
