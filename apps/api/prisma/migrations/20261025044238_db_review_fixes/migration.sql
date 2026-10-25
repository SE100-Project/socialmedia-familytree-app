-- Migration: db_review_fixes
-- Áp dụng các sửa đổi từ báo cáo rà soát docs/db-review.md
-- Tất cả thay đổi có thể chạy lại an toàn (IF NOT EXISTS / OR REPLACE / IF EXISTS).
--
-- Thay đổi theo thứ tự:
--   1. [B1]  Trigger chuyển trạng thái ContributionRequest
--   2. [B4]  Bỏ extension citext và pgcrypto (không dùng)
--   3. [B6]  Thay FOR UPDATE → pg_advisory_xact_lock trong Relationship trigger
--   4. [B13] Trigger chống tự duyệt cho ApprovalDecision (BR-12)
--   5. [B12] Đổi ON DELETE SET NULL → RESTRICT trên MemberProfile.branchId
--   6. [B21] Thêm CHECK constraint "exactly one parent" trên Attachment
--   7. [B7]  Thêm index FK còn thiếu
--   8. [B8]  Tối ưu index hàng đợi thông báo
--   9. [B9]  Thêm index sự kiện bổ sung
--  10. [B10] Tối ưu partial index bài viết đã xuất bản

-- ============================================================
-- [B1] Trigger chuyển trạng thái ContributionRequest (schema public)
-- Tương ứng yeu_cau_dong_gop trong schema gia_pha.
-- Enum RequestStatus dùng PENDING / APPROVED / REJECTED.
-- PENDING → APPROVED | REJECTED: hợp lệ.
-- APPROVED và REJECTED là trạng thái kết thúc, không đổi lại được.
-- KHÔNG dùng chung hàm với JoinRequest / ProfileUpdateRequest vì
-- những bảng kia có thêm trạng thái CANCELLED không có ở đây.
-- ============================================================
CREATE OR REPLACE FUNCTION fn_check_contribution_status_transition()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Không thay đổi trạng thái → bỏ qua
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;

  -- PENDING → APPROVED hoặc REJECTED: hợp lệ
  IF OLD.status = 'PENDING' AND NEW.status IN ('APPROVED', 'REJECTED') THEN
    RETURN NEW;
  END IF;

  -- Mọi chuyển đổi khác bị từ chối (bao gồm đổi ngược từ trạng thái kết thúc)
  RAISE EXCEPTION
    'Chuyen trang thai dong gop khong hop le: % -> % (id=%)',
    OLD.status, NEW.status, NEW.id;
END $$;

DROP TRIGGER IF EXISTS trg_contribution_status_transition ON "ContributionRequest";
CREATE TRIGGER trg_contribution_status_transition
  BEFORE UPDATE OF status ON "ContributionRequest"
  FOR EACH ROW
  EXECUTE FUNCTION fn_check_contribution_status_transition();

-- ============================================================
-- [B4] Bỏ extension không dùng
-- citext:    không có cột CITEXT nào; email dùng lower() partial index
-- pgcrypto:  hash mật khẩu thực hiện ở tầng ứng dụng (argon2)
-- ============================================================
DROP EXTENSION IF EXISTS citext;
DROP EXTENSION IF EXISTS pgcrypto;

-- ============================================================
-- [B6] Trigger chống vòng tổ tiên trên Relationship (BR-?)
-- Thay FOR UPDATE trên bảng Clan (lock toàn hàng → bottleneck đồng thời)
-- bằng pg_advisory_xact_lock(hashtext(clanId)) — advisory lock nhẹ hơn,
-- chỉ block cùng clanId, không block read, không block dòng họ khác.
-- ============================================================
CREATE OR REPLACE FUNCTION fn_check_ancestor_cycle()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  clan_a TEXT;
  clan_b TEXT;
  has_cycle BOOLEAN;
BEGIN
  SELECT "clanId" INTO clan_a FROM "MemberProfile" WHERE id = NEW."fromId";
  SELECT "clanId" INTO clan_b FROM "MemberProfile" WHERE id = NEW."toId";

  IF clan_a IS NULL OR clan_a <> clan_b THEN
    RAISE EXCEPTION 'Hai ho so phai thuoc cung dong ho (fromId=%, toId=%)',
      NEW."fromId", NEW."toId";
  END IF;

  -- Chỉ kiểm tra vòng cho quan hệ cha-con đang hoạt động
  IF NOT NEW.active OR NEW.type = 'SPOUSE' THEN RETURN NEW; END IF;

  -- Advisory lock theo hash của clanId để serialise việc kiểm tra vòng
  -- trong cùng một dòng họ. Các dòng họ khác không bị block.
  PERFORM pg_advisory_xact_lock(hashtext(clan_a)::BIGINT);

  WITH RECURSIVE descendants(id) AS (
    SELECT NEW."toId"
    UNION
    SELECT r."toId"
    FROM "Relationship" r
    JOIN descendants d ON r."fromId" = d.id
    WHERE r.active AND r.type = 'PARENT_CHILD'
  )
  SELECT EXISTS (SELECT 1 FROM descendants WHERE id = NEW."fromId")
  INTO has_cycle;

  IF has_cycle THEN
    RAISE EXCEPTION 'Quan he tao vong to tien (fromId=%, toId=%)',
      NEW."fromId", NEW."toId";
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_relationship_no_cycle ON "Relationship";
CREATE TRIGGER trg_relationship_no_cycle
  BEFORE INSERT OR UPDATE OF "fromId", "toId", type, active
  ON "Relationship"
  FOR EACH ROW
  EXECUTE FUNCTION fn_check_ancestor_cycle();

-- ============================================================
-- [B13] Trigger chống tự duyệt ApprovalDecision (BR-12)
-- Người tạo yêu cầu không được là người duyệt.
-- ============================================================
CREATE OR REPLACE FUNCTION fn_check_self_approval()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  requester_id TEXT;
BEGIN
  IF NEW."joinRequestId" IS NOT NULL THEN
    SELECT "requesterId" INTO requester_id
      FROM "JoinRequest" WHERE id = NEW."joinRequestId";
  ELSIF NEW."profileUpdateRequestId" IS NOT NULL THEN
    SELECT "requesterId" INTO requester_id
      FROM "ProfileUpdateRequest" WHERE id = NEW."profileUpdateRequestId";
  ELSIF NEW."contributionRequestId" IS NOT NULL THEN
    SELECT "requesterId" INTO requester_id
      FROM "ContributionRequest" WHERE id = NEW."contributionRequestId";
  END IF;

  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Khong tim thay yeu cau can duyet';
  END IF;

  IF requester_id = NEW."approverId" THEN
    RAISE EXCEPTION 'Nguoi tao yeu cau khong duoc tu duyet (BR-12): approverId=%',
      NEW."approverId";
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_approval_no_self ON "ApprovalDecision";
CREATE TRIGGER trg_approval_no_self
  BEFORE INSERT ON "ApprovalDecision"
  FOR EACH ROW
  EXECUTE FUNCTION fn_check_self_approval();

-- ============================================================
-- [B12] Đổi ON DELETE SET NULL → RESTRICT trên MemberProfile.branchId
-- SET NULL âm thầm tách hồ sơ khỏi chi khi chi bị xóa.
-- RESTRICT ép ứng dụng xử lý tường minh, tránh mất liên kết ngầm.
-- ============================================================
ALTER TABLE "MemberProfile"
  DROP CONSTRAINT IF EXISTS "MemberProfile_branchId_fkey";
ALTER TABLE "MemberProfile"
  ADD CONSTRAINT "MemberProfile_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- [B21] CHECK constraint "exactly one parent" trên Attachment
-- Một tệp phải thuộc đúng một trong: Post, ContributionRequest,
-- hoặc FundTransaction. Tránh tệp mồ côi hoặc gán nhầm nhiều nơi.
-- ============================================================
ALTER TABLE "Attachment"
  DROP CONSTRAINT IF EXISTS "chk_attachment_single_parent";
ALTER TABLE "Attachment"
  ADD CONSTRAINT "chk_attachment_single_parent"
  CHECK (
    num_nonnulls("postId", "contributionRequestId", "fundTransactionId") = 1
  );

-- ============================================================
-- [B7] Thêm index FK còn thiếu
-- Mỗi index có comment ghi truy vấn cụ thể nó phục vụ.
-- ============================================================

-- Danh sách yêu cầu cập nhật phả hệ chờ duyệt theo dòng họ
-- (truy vấn thường xuyên nhất của Trưởng họ)
CREATE INDEX IF NOT EXISTS "ProfileUpdateRequest_clanId_status_idx"
  ON "ProfileUpdateRequest"("clanId", "status");

-- Lịch sử yêu cầu do một tài khoản tạo (trang "yêu cầu của tôi")
CREATE INDEX IF NOT EXISTS "ProfileUpdateRequest_requesterId_idx"
  ON "ProfileUpdateRequest"("requesterId");

-- Lịch sử quyết định duyệt của một người duyệt
CREATE INDEX IF NOT EXISTS "ApprovalDecision_approverId_idx"
  ON "ApprovalDecision"("approverId");

-- Bài viết của một tài khoản (trang hồ sơ cá nhân)
CREATE INDEX IF NOT EXISTS "Post_authorId_idx"
  ON "Post"("authorId");

-- Bình luận của một tài khoản (kiểm duyệt nội dung)
CREATE INDEX IF NOT EXISTS "Comment_authorId_idx"
  ON "Comment"("authorId");

-- Yêu cầu đóng góp theo chiến dịch + trạng thái (danh sách chờ duyệt)
CREATE INDEX IF NOT EXISTS "ContributionRequest_campaignId_status_idx"
  ON "ContributionRequest"("campaignId", "status");

-- Yêu cầu đóng góp của một thành viên (lịch sử cá nhân)
CREATE INDEX IF NOT EXISTS "ContributionRequest_requesterId_idx"
  ON "ContributionRequest"("requesterId");

-- Phiếu bầu theo dòng họ (tổng hợp kết quả bầu)
CREATE INDEX IF NOT EXISTS "ElectionVote_clanId_idx"
  ON "ElectionVote"("clanId");

-- Vai trò hiện hành theo dòng họ (kiểm tra phân quyền)
CREATE INDEX IF NOT EXISTS "RoleAssignment_clanId_validTo_idx"
  ON "RoleAssignment"("clanId", "validTo");

-- ============================================================
-- [B8] Tối ưu index hàng đợi thông báo
-- Index cũ (channel, sentAt) ít chọn lọc vì scan toàn bộ kênh.
-- Partial index chỉ trên hàng chưa xử lý → nhỏ hơn, nhanh hơn.
-- ============================================================
DROP INDEX IF EXISTS "Notification_channel_sentAt_idx";

-- Thông báo chưa đọc của một tài khoản (trang thông báo)
CREATE INDEX IF NOT EXISTS "Notification_unread_idx"
  ON "Notification"("accountId", "createdAt" DESC)
  WHERE read = false;

-- Email outbox chưa gửi (scheduler chạy định kỳ)
CREATE INDEX IF NOT EXISTS "Notification_email_pending_idx"
  ON "Notification"("createdAt")
  WHERE channel = 'EMAIL' AND "sentAt" IS NULL;

-- ============================================================
-- [B9] Index sự kiện dòng họ theo ngày (bổ sung)
-- Index hiện tại (clanId, solarDate) đủ cho âm dương lịch dạng DATE.
-- Thêm partial index loại trừ sự kiện đã huỷ để bảng lịch nhanh hơn.
-- ============================================================
CREATE INDEX IF NOT EXISTS "Event_clanId_solarDate_active_idx"
  ON "Event"("clanId", "solarDate")
  WHERE cancelled = false;

-- ============================================================
-- [B10] Tối ưu partial index bài viết đã xuất bản
-- Bảng tin chỉ hiện bài PUBLISHED; bài ẩn/xóa không cần index này.
-- ============================================================
DROP INDEX IF EXISTS "Post_clanId_branchId_createdAt_idx";
CREATE INDEX IF NOT EXISTS "Post_feed_idx"
  ON "Post"("clanId", "branchId", "createdAt" DESC)
  WHERE status = 'PUBLISHED';
