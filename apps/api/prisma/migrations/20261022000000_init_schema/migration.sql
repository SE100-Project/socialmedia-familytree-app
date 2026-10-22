-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'LOCKED');

-- CreateEnum
CREATE TYPE "AuthType" AS ENUM ('LOCAL', 'GOOGLE');

-- CreateEnum
CREATE TYPE "ElectionStatus" AS ENUM ('OPEN', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VoteChoice" AS ENUM ('AGREE', 'DISAGREE', 'ABSTAIN');

-- CreateEnum
CREATE TYPE "RoleType" AS ENUM ('CLAN_HEAD', 'BRANCH_HEAD', 'TECH_SUPPORT');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('ALIVE', 'DECEASED', 'REMOVED');

-- CreateEnum
CREATE TYPE "CalendarType" AS ENUM ('SOLAR', 'LUNAR');

-- CreateEnum
CREATE TYPE "RelationType" AS ENUM ('PARENT_CHILD', 'SPOUSE');

-- CreateEnum
CREATE TYPE "VisibilityScope" AS ENUM ('PRIVATE', 'BRANCH', 'CLAN');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "JoinRequestKind" AS ENUM ('BY_ACCOUNT_CODE', 'BY_CLAN_CODE');

-- CreateEnum
CREATE TYPE "ProfileRequestType" AS ENUM ('ADD_CHILD', 'ADD_SPOUSE', 'MARK_DECEASED', 'EDIT_PROFILE', 'ADD_RELATIVE', 'REMOVE_PROFILE');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('PUBLISHED', 'HIDDEN', 'DELETED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL');

-- CreateEnum
CREATE TYPE "FundScope" AS ENUM ('CLAN', 'BRANCH');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateTable
CREATE TABLE "Clan" (
    "id" TEXT NOT NULL,
    "clanCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Clan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberProfile" (
    "id" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "branchId" TEXT,
    "accountId" TEXT,
    "fullName" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "bio" TEXT,
    "birthDate" DATE,
    "deathDate" DATE,
    "deathCalendar" "CalendarType",
    "status" "MemberStatus" NOT NULL DEFAULT 'ALIVE',
    "generation" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT,
    "authType" "AuthType" NOT NULL DEFAULT 'LOCAL',
    "googleSub" TEXT,
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TotpCredential" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "secretEncrypted" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "lastTimeStep" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TotpCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountProfileLink" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountProfileLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleAssignment" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" "RoleType" NOT NULL,
    "clanId" TEXT NOT NULL,
    "branchId" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),

    CONSTRAINT "RoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Relationship" (
    "id" TEXT NOT NULL,
    "type" "RelationType" NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "startDate" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Relationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivacySetting" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "phoneScope" "VisibilityScope" NOT NULL DEFAULT 'BRANCH',
    "addressScope" "VisibilityScope" NOT NULL DEFAULT 'BRANCH',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivacySetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JoinRequest" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "kind" "JoinRequestKind" NOT NULL,
    "referenceCode" TEXT NOT NULL,
    "declaredRelation" TEXT,
    "targetProfileId" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JoinRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "proposedRole" TEXT,
    "targetProfileId" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileUpdateRequest" (
    "id" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "branchId" TEXT,
    "requesterId" TEXT NOT NULL,
    "type" "ProfileRequestType" NOT NULL,
    "subjectId" TEXT,
    "before" JSONB,
    "proposed" JSONB NOT NULL,
    "reason" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileUpdateRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestMessage" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalDecision" (
    "id" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL,
    "reason" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joinRequestId" TEXT,
    "profileUpdateRequestId" TEXT,
    "contributionRequestId" TEXT,

    CONSTRAINT "ApprovalDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "actorId" TEXT,
    "reason" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "branchId" TEXT,
    "authorId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "official" BOOLEAN NOT NULL DEFAULT false,
    "status" "ContentStatus" NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postId" TEXT,
    "contributionRequestId" TEXT,
    "fundTransactionId" TEXT,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reaction" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'like',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "branchId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "calendar" "CalendarType" NOT NULL,
    "originalDate" TEXT NOT NULL,
    "solarDate" DATE,
    "recurringYearly" BOOLEAN NOT NULL DEFAULT false,
    "sourceProfileId" TEXT,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElectionSession" (
    "id" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "status" "ElectionStatus" NOT NULL DEFAULT 'OPEN',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "selectedCandidateId" TEXT,
    "confirmedById" TEXT,
    "resultNote" TEXT,

    CONSTRAINT "ElectionSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElectionVote" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "voterAccountId" TEXT NOT NULL,
    "candidateProfileId" TEXT,
    "choice" "VoteChoice" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ElectionVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetRequest" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fund" (
    "id" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "branchId" TEXT,
    "scope" "FundScope" NOT NULL,
    "name" TEXT NOT NULL,
    "openingBalance" DECIMAL(18,0) NOT NULL DEFAULT 0,

    CONSTRAINT "Fund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "fundId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "purpose" TEXT,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContributionRequest" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "amount" DECIMAL(18,0) NOT NULL,
    "transferredAt" TIMESTAMP(3) NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContributionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundTransaction" (
    "id" TEXT NOT NULL,
    "fundId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(18,0) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "contributionRequestId" TEXT,
    "reversesId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FundTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialVoucher" (
    "id" TEXT NOT NULL,
    "fundTransactionId" TEXT,
    "contributionRequestId" TEXT,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER,
    "storageUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialVoucher_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Clan_clanCode_key" ON "Clan"("clanCode");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_clanId_name_key" ON "Branch"("clanId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "MemberProfile_accountId_key" ON "MemberProfile"("accountId");

-- CreateIndex
CREATE INDEX "MemberProfile_clanId_fullName_idx" ON "MemberProfile"("clanId", "fullName");

-- CreateIndex
CREATE INDEX "MemberProfile_branchId_idx" ON "MemberProfile"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_accountCode_key" ON "Account"("accountCode");

-- CreateIndex
CREATE UNIQUE INDEX "Account_phone_key" ON "Account"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Account_email_key" ON "Account"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_googleSub_key" ON "Account"("googleSub");

-- CreateIndex
CREATE UNIQUE INDEX "TotpCredential_accountId_key" ON "TotpCredential"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountProfileLink_profileId_key" ON "AccountProfileLink"("profileId");

-- CreateIndex
CREATE INDEX "AccountProfileLink_clanId_idx" ON "AccountProfileLink"("clanId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountProfileLink_accountId_clanId_key" ON "AccountProfileLink"("accountId", "clanId");

-- CreateIndex
CREATE INDEX "RoleAssignment_accountId_validTo_idx" ON "RoleAssignment"("accountId", "validTo");

-- CreateIndex
CREATE INDEX "RoleAssignment_branchId_type_validTo_idx" ON "RoleAssignment"("branchId", "type", "validTo");

-- CreateIndex
CREATE INDEX "Relationship_fromId_idx" ON "Relationship"("fromId");

-- CreateIndex
CREATE INDEX "Relationship_toId_idx" ON "Relationship"("toId");

-- CreateIndex
CREATE UNIQUE INDEX "Relationship_type_fromId_toId_key" ON "Relationship"("type", "fromId", "toId");

-- CreateIndex
CREATE UNIQUE INDEX "PrivacySetting_profileId_key" ON "PrivacySetting"("profileId");

-- CreateIndex
CREATE INDEX "ProfileUpdateRequest_branchId_status_idx" ON "ProfileUpdateRequest"("branchId", "status");

-- CreateIndex
CREATE INDEX "RequestMessage_requestId_createdAt_idx" ON "RequestMessage"("requestId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalDecision_joinRequestId_key" ON "ApprovalDecision"("joinRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalDecision_profileUpdateRequestId_key" ON "ApprovalDecision"("profileUpdateRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalDecision_contributionRequestId_key" ON "ApprovalDecision"("contributionRequestId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_at_idx" ON "AuditLog"("at");

-- CreateIndex
CREATE INDEX "Post_clanId_branchId_createdAt_idx" ON "Post"("clanId", "branchId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Reaction_postId_accountId_key" ON "Reaction"("postId", "accountId");

-- CreateIndex
CREATE INDEX "Event_clanId_solarDate_idx" ON "Event"("clanId", "solarDate");

-- CreateIndex
CREATE INDEX "Notification_accountId_read_idx" ON "Notification"("accountId", "read");

-- CreateIndex
CREATE INDEX "Notification_channel_sentAt_idx" ON "Notification"("channel", "sentAt");

-- CreateIndex
CREATE INDEX "ElectionSession_clanId_status_idx" ON "ElectionSession"("clanId", "status");

-- CreateIndex
CREATE INDEX "ElectionVote_sessionId_idx" ON "ElectionVote"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "ElectionVote_sessionId_branchId_key" ON "ElectionVote"("sessionId", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetRequest_tokenHash_key" ON "PasswordResetRequest"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetRequest_accountId_expiresAt_idx" ON "PasswordResetRequest"("accountId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "FundTransaction_contributionRequestId_key" ON "FundTransaction"("contributionRequestId");

-- CreateIndex
CREATE INDEX "FundTransaction_fundId_occurredAt_idx" ON "FundTransaction"("fundId", "occurredAt");

-- CreateIndex
CREATE INDEX "FinancialVoucher_fundTransactionId_idx" ON "FinancialVoucher"("fundTransactionId");

-- CreateIndex
CREATE INDEX "FinancialVoucher_contributionRequestId_idx" ON "FinancialVoucher"("contributionRequestId");

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberProfile" ADD CONSTRAINT "MemberProfile_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberProfile" ADD CONSTRAINT "MemberProfile_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberProfile" ADD CONSTRAINT "MemberProfile_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TotpCredential" ADD CONSTRAINT "TotpCredential_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountProfileLink" ADD CONSTRAINT "AccountProfileLink_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountProfileLink" ADD CONSTRAINT "AccountProfileLink_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountProfileLink" ADD CONSTRAINT "AccountProfileLink_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "MemberProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Relationship" ADD CONSTRAINT "Relationship_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "MemberProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Relationship" ADD CONSTRAINT "Relationship_toId_fkey" FOREIGN KEY ("toId") REFERENCES "MemberProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivacySetting" ADD CONSTRAINT "PrivacySetting_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "MemberProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JoinRequest" ADD CONSTRAINT "JoinRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestMessage" ADD CONSTRAINT "RequestMessage_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ProfileUpdateRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestMessage" ADD CONSTRAINT "RequestMessage_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalDecision" ADD CONSTRAINT "ApprovalDecision_joinRequestId_fkey" FOREIGN KEY ("joinRequestId") REFERENCES "JoinRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalDecision" ADD CONSTRAINT "ApprovalDecision_profileUpdateRequestId_fkey" FOREIGN KEY ("profileUpdateRequestId") REFERENCES "ProfileUpdateRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalDecision" ADD CONSTRAINT "ApprovalDecision_contributionRequestId_fkey" FOREIGN KEY ("contributionRequestId") REFERENCES "ContributionRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_contributionRequestId_fkey" FOREIGN KEY ("contributionRequestId") REFERENCES "ContributionRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_fundTransactionId_fkey" FOREIGN KEY ("fundTransactionId") REFERENCES "FundTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionSession" ADD CONSTRAINT "ElectionSession_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionSession" ADD CONSTRAINT "ElectionSession_selectedCandidateId_fkey" FOREIGN KEY ("selectedCandidateId") REFERENCES "MemberProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionSession" ADD CONSTRAINT "ElectionSession_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionVote" ADD CONSTRAINT "ElectionVote_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ElectionSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionVote" ADD CONSTRAINT "ElectionVote_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionVote" ADD CONSTRAINT "ElectionVote_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionVote" ADD CONSTRAINT "ElectionVote_voterAccountId_fkey" FOREIGN KEY ("voterAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionVote" ADD CONSTRAINT "ElectionVote_candidateProfileId_fkey" FOREIGN KEY ("candidateProfileId") REFERENCES "MemberProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetRequest" ADD CONSTRAINT "PasswordResetRequest_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fund" ADD CONSTRAINT "Fund_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fund" ADD CONSTRAINT "Fund_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "Fund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContributionRequest" ADD CONSTRAINT "ContributionRequest_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundTransaction" ADD CONSTRAINT "FundTransaction_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "Fund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundTransaction" ADD CONSTRAINT "FundTransaction_contributionRequestId_fkey" FOREIGN KEY ("contributionRequestId") REFERENCES "ContributionRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialVoucher" ADD CONSTRAINT "FinancialVoucher_fundTransactionId_fkey" FOREIGN KEY ("fundTransactionId") REFERENCES "FundTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialVoucher" ADD CONSTRAINT "FinancialVoucher_contributionRequestId_fkey" FOREIGN KEY ("contributionRequestId") REFERENCES "ContributionRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



-- Custom Business & Security Constraints
CREATE UNIQUE INDEX IF NOT EXISTS "uq_account_email_ci" ON "Account" (lower(email)) WHERE email IS NOT NULL;

ALTER TABLE "Account" DROP CONSTRAINT IF EXISTS "chk_account_auth_credentials";
ALTER TABLE "Account" ADD CONSTRAINT "chk_account_auth_credentials" CHECK (
  ("authType" = 'LOCAL' AND "passwordHash" IS NOT NULL AND "googleSub" IS NULL) OR
  ("authType" = 'GOOGLE' AND "passwordHash" IS NULL AND "googleSub" IS NOT NULL)
);
