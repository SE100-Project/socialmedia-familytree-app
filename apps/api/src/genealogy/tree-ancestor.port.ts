import { Injectable } from '@nestjs/common';

export const TREE_ANCESTOR_CHECKER = Symbol('TREE_ANCESTOR_CHECKER');

/**
 * Giao diện kiểm tra quan hệ tổ tiên do BE-3 (`TreeRepository`, B3-01) cung cấp.
 * Tách qua token để `GenealogyModule` không bị chặn khi `TreeModule` chưa sẵn sàng.
 */
export interface TreeAncestorChecker {
  /**
   * Trả về `true` nếu `ancestorId` đã là tổ tiên (trực tiếp hoặc gián tiếp) của `descendantId`.
   */
  isAncestor(ancestorId: string, descendantId: string): Promise<boolean>;
}

/**
 * Stub tạm thời cho `B3-01` (`TreeRepository.isAncestor`) trả `false` theo chốt Sprint 0/1.
 * PostgreSQL vẫn còn trigger `trg_relationship_no_cycle` bảo vệ ở tầng CSDL.
 */
@Injectable()
export class StubTreeAncestorChecker implements TreeAncestorChecker {
  async isAncestor(_ancestorId: string, _descendantId: string): Promise<boolean> {
    return false;
  }
}
