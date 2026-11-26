import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import {
  BranchesController,
  ClansController,
  ProfilesController,
  RelationshipsController,
} from './genealogy.controller';
import { GenealogyService } from './genealogy.service';
import { ProfileService } from './profile.service';
import { StubTreeAncestorChecker, TREE_ANCESTOR_CHECKER } from './tree-ancestor.port';

@Module({
  imports: [AuthModule],
  controllers: [ClansController, BranchesController, ProfilesController, RelationshipsController],
  providers: [
    ProfileService,
    GenealogyService,
    {
      provide: TREE_ANCESTOR_CHECKER,
      useClass: StubTreeAncestorChecker,
    },
  ],
  exports: [ProfileService, GenealogyService, TREE_ANCESTOR_CHECKER],
})
export class GenealogyModule {}
