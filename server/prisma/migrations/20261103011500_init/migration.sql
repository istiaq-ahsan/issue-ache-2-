-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('AUTHORITY', 'STUDENT', 'TEACHER');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "DepartmentStatus" AS ENUM ('LOCKED', 'ACTIVE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESSFUL', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DepartmentChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DepartmentChangeType" AS ENUM ('STUDENT_CHANGE', 'TEACHER_ADD', 'TEACHER_REMOVE', 'TEACHER_PRIMARY_CHANGE');

-- CreateEnum
CREATE TYPE "IssueCategory" AS ENUM ('CLASSROOM_EQUIPMENT', 'WIFI_NETWORKING', 'ELECTRICAL', 'FURNITURE_INFRASTRUCTURE', 'CLEANING_SANITATION', 'LAB_EQUIPMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "IssuePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "IssueAudience" AS ENUM ('STUDENT', 'TEACHER');

-- CreateEnum
CREATE TYPE "NoteVisibility" AS ENUM ('INTERNAL', 'PUBLIC');

-- CreateTable
CREATE TABLE "Institution" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "institutionCode" TEXT NOT NULL,
    "contactPersonName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "campusType" TEXT NOT NULL,
    "campusSize" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "firebaseUid" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstitutionMembership" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'PENDING',
    "studentId" TEXT,
    "teacherId" TEXT,
    "reviewedById" TEXT,
    "reviewedByMembershipId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstitutionMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "DepartmentStatus" NOT NULL DEFAULT 'LOCKED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepartmentMembership" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepartmentMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepartmentChangeRequest" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "changeType" "DepartmentChangeType" NOT NULL,
    "currentDepartmentId" TEXT,
    "requestedDepartmentId" TEXT,
    "replacementDepartmentId" TEXT,
    "reason" TEXT NOT NULL,
    "status" "DepartmentChangeStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedByMembershipId" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "DepartmentChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL DEFAULT 'DEMO',
    "transactionReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Issue" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reporterMembershipId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "IssueCategory" NOT NULL,
    "priority" "IssuePriority" NOT NULL,
    "status" "IssueStatus" NOT NULL DEFAULT 'OPEN',
    "audience" "IssueAudience" NOT NULL,
    "location" TEXT NOT NULL,
    "resolutionSummary" TEXT,
    "archivedAt" TIMESTAMP(3),
    "archivedById" TEXT,
    "archivedByMembershipId" TEXT,
    "archiveReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssueHistory" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "oldStatus" "IssueStatus",
    "newStatus" "IssueStatus" NOT NULL,
    "changedById" TEXT NOT NULL,
    "changedByMembershipId" TEXT NOT NULL,
    "note" TEXT,
    "resolutionSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssueNote" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorMembershipId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "visibility" "NoteVisibility" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IssueNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT,
    "actorId" TEXT,
    "actorMembershipId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "recipientMembershipId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Institution_normalizedName_key" ON "Institution"("normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "Institution_institutionCode_key" ON "Institution"("institutionCode");

-- CreateIndex
CREATE UNIQUE INDEX "Institution_contactEmail_key" ON "Institution"("contactEmail");

-- CreateIndex
CREATE INDEX "Institution_adminUserId_idx" ON "Institution"("adminUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_firebaseUid_key" ON "User"("firebaseUid");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_name_idx" ON "User"("name");

-- CreateIndex
CREATE INDEX "InstitutionMembership_institutionId_role_status_idx" ON "InstitutionMembership"("institutionId", "role", "status");

-- CreateIndex
CREATE INDEX "InstitutionMembership_userId_status_idx" ON "InstitutionMembership"("userId", "status");

-- CreateIndex
CREATE INDEX "InstitutionMembership_reviewedById_reviewedAt_idx" ON "InstitutionMembership"("reviewedById", "reviewedAt");

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionMembership_institutionId_userId_key" ON "InstitutionMembership"("institutionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionMembership_institutionId_studentId_key" ON "InstitutionMembership"("institutionId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionMembership_institutionId_teacherId_key" ON "InstitutionMembership"("institutionId", "teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionMembership_id_institutionId_key" ON "InstitutionMembership"("id", "institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionMembership_id_institutionId_userId_key" ON "InstitutionMembership"("id", "institutionId", "userId");

-- CreateIndex
CREATE INDEX "Department_institutionId_status_idx" ON "Department"("institutionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Department_id_institutionId_key" ON "Department"("id", "institutionId");

-- CreateIndex
CREATE INDEX "DepartmentMembership_institutionId_departmentId_isActive_idx" ON "DepartmentMembership"("institutionId", "departmentId", "isActive");

-- CreateIndex
CREATE INDEX "DepartmentMembership_membershipId_isActive_isPrimary_idx" ON "DepartmentMembership"("membershipId", "isActive", "isPrimary");

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentMembership_membershipId_departmentId_key" ON "DepartmentMembership"("membershipId", "departmentId");

-- CreateIndex
CREATE INDEX "DepartmentChangeRequest_institutionId_status_requestedAt_idx" ON "DepartmentChangeRequest"("institutionId", "status", "requestedAt");

-- CreateIndex
CREATE INDEX "DepartmentChangeRequest_membershipId_status_idx" ON "DepartmentChangeRequest"("membershipId", "status");

-- CreateIndex
CREATE INDEX "DepartmentChangeRequest_requestedById_requestedAt_idx" ON "DepartmentChangeRequest"("requestedById", "requestedAt");

-- CreateIndex
CREATE INDEX "DepartmentChangeRequest_reviewedById_reviewedAt_idx" ON "DepartmentChangeRequest"("reviewedById", "reviewedAt");

-- CreateIndex
CREATE INDEX "Subscription_institutionId_status_endsAt_idx" ON "Subscription"("institutionId", "status", "endsAt");

-- CreateIndex
CREATE INDEX "Subscription_departmentId_status_endsAt_idx" ON "Subscription"("departmentId", "status", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_id_departmentId_institutionId_key" ON "Subscription"("id", "departmentId", "institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_transactionReference_key" ON "Payment"("transactionReference");

-- CreateIndex
CREATE INDEX "Payment_institutionId_status_createdAt_idx" ON "Payment"("institutionId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_departmentId_status_createdAt_idx" ON "Payment"("departmentId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_subscriptionId_idx" ON "Payment"("subscriptionId");

-- CreateIndex
CREATE INDEX "Issue_institutionId_audience_status_createdAt_idx" ON "Issue"("institutionId", "audience", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Issue_institutionId_departmentId_status_idx" ON "Issue"("institutionId", "departmentId", "status");

-- CreateIndex
CREATE INDEX "Issue_reporterId_createdAt_idx" ON "Issue"("reporterId", "createdAt");

-- CreateIndex
CREATE INDEX "Issue_reporterMembershipId_idx" ON "Issue"("reporterMembershipId");

-- CreateIndex
CREATE INDEX "Issue_archivedById_idx" ON "Issue"("archivedById");

-- CreateIndex
CREATE INDEX "Issue_archivedAt_idx" ON "Issue"("archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Issue_id_institutionId_key" ON "Issue"("id", "institutionId");

-- CreateIndex
CREATE INDEX "IssueHistory_institutionId_issueId_createdAt_idx" ON "IssueHistory"("institutionId", "issueId", "createdAt");

-- CreateIndex
CREATE INDEX "IssueHistory_changedById_createdAt_idx" ON "IssueHistory"("changedById", "createdAt");

-- CreateIndex
CREATE INDEX "IssueHistory_changedByMembershipId_createdAt_idx" ON "IssueHistory"("changedByMembershipId", "createdAt");

-- CreateIndex
CREATE INDEX "IssueNote_institutionId_issueId_visibility_createdAt_idx" ON "IssueNote"("institutionId", "issueId", "visibility", "createdAt");

-- CreateIndex
CREATE INDEX "IssueNote_authorId_createdAt_idx" ON "IssueNote"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "IssueNote_authorMembershipId_createdAt_idx" ON "IssueNote"("authorMembershipId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_institutionId_createdAt_idx" ON "AuditLog"("institutionId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_institutionId_entityType_entityId_idx" ON "AuditLog"("institutionId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorMembershipId_createdAt_idx" ON "AuditLog"("actorMembershipId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_institutionId_recipientId_readAt_createdAt_idx" ON "Notification"("institutionId", "recipientId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_relatedEntityType_relatedEntityId_idx" ON "Notification"("relatedEntityType", "relatedEntityId");

-- CreateIndex
CREATE INDEX "Notification_recipientMembershipId_idx" ON "Notification"("recipientMembershipId");

-- AddForeignKey
ALTER TABLE "Institution" ADD CONSTRAINT "Institution_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionMembership" ADD CONSTRAINT "InstitutionMembership_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionMembership" ADD CONSTRAINT "InstitutionMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionMembership" ADD CONSTRAINT "InstitutionMembership_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionMembership" ADD CONSTRAINT "InstitutionMembership_reviewedByMembershipId_institutionId_fkey" FOREIGN KEY ("reviewedByMembershipId", "institutionId", "reviewedById") REFERENCES "InstitutionMembership"("id", "institutionId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentMembership" ADD CONSTRAINT "DepartmentMembership_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentMembership" ADD CONSTRAINT "DepartmentMembership_membershipId_institutionId_fkey" FOREIGN KEY ("membershipId", "institutionId") REFERENCES "InstitutionMembership"("id", "institutionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentMembership" ADD CONSTRAINT "DepartmentMembership_departmentId_institutionId_fkey" FOREIGN KEY ("departmentId", "institutionId") REFERENCES "Department"("id", "institutionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentChangeRequest" ADD CONSTRAINT "DepartmentChangeRequest_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentChangeRequest" ADD CONSTRAINT "DepartmentChangeRequest_membershipId_institutionId_fkey" FOREIGN KEY ("membershipId", "institutionId") REFERENCES "InstitutionMembership"("id", "institutionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentChangeRequest" ADD CONSTRAINT "DepartmentChangeRequest_currentDepartmentId_institutionId_fkey" FOREIGN KEY ("currentDepartmentId", "institutionId") REFERENCES "Department"("id", "institutionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentChangeRequest" ADD CONSTRAINT "DepartmentChangeRequest_requestedDepartmentId_institutionI_fkey" FOREIGN KEY ("requestedDepartmentId", "institutionId") REFERENCES "Department"("id", "institutionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentChangeRequest" ADD CONSTRAINT "DepartmentChangeRequest_replacementDepartmentId_institutio_fkey" FOREIGN KEY ("replacementDepartmentId", "institutionId") REFERENCES "Department"("id", "institutionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentChangeRequest" ADD CONSTRAINT "DepartmentChangeRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentChangeRequest" ADD CONSTRAINT "DepartmentChangeRequest_membershipId_institutionId_request_fkey" FOREIGN KEY ("membershipId", "institutionId", "requestedById") REFERENCES "InstitutionMembership"("id", "institutionId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentChangeRequest" ADD CONSTRAINT "DepartmentChangeRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentChangeRequest" ADD CONSTRAINT "DepartmentChangeRequest_reviewedByMembershipId_institution_fkey" FOREIGN KEY ("reviewedByMembershipId", "institutionId", "reviewedById") REFERENCES "InstitutionMembership"("id", "institutionId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_departmentId_institutionId_fkey" FOREIGN KEY ("departmentId", "institutionId") REFERENCES "Department"("id", "institutionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_departmentId_institutionId_fkey" FOREIGN KEY ("departmentId", "institutionId") REFERENCES "Department"("id", "institutionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_subscriptionId_departmentId_institutionId_fkey" FOREIGN KEY ("subscriptionId", "departmentId", "institutionId") REFERENCES "Subscription"("id", "departmentId", "institutionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_departmentId_institutionId_fkey" FOREIGN KEY ("departmentId", "institutionId") REFERENCES "Department"("id", "institutionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_reporterMembershipId_institutionId_reporterId_fkey" FOREIGN KEY ("reporterMembershipId", "institutionId", "reporterId") REFERENCES "InstitutionMembership"("id", "institutionId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_archivedByMembershipId_institutionId_archivedById_fkey" FOREIGN KEY ("archivedByMembershipId", "institutionId", "archivedById") REFERENCES "InstitutionMembership"("id", "institutionId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueHistory" ADD CONSTRAINT "IssueHistory_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueHistory" ADD CONSTRAINT "IssueHistory_issueId_institutionId_fkey" FOREIGN KEY ("issueId", "institutionId") REFERENCES "Issue"("id", "institutionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueHistory" ADD CONSTRAINT "IssueHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueHistory" ADD CONSTRAINT "IssueHistory_changedByMembershipId_institutionId_changedBy_fkey" FOREIGN KEY ("changedByMembershipId", "institutionId", "changedById") REFERENCES "InstitutionMembership"("id", "institutionId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueNote" ADD CONSTRAINT "IssueNote_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueNote" ADD CONSTRAINT "IssueNote_issueId_institutionId_fkey" FOREIGN KEY ("issueId", "institutionId") REFERENCES "Issue"("id", "institutionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueNote" ADD CONSTRAINT "IssueNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueNote" ADD CONSTRAINT "IssueNote_authorMembershipId_institutionId_authorId_fkey" FOREIGN KEY ("authorMembershipId", "institutionId", "authorId") REFERENCES "InstitutionMembership"("id", "institutionId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorMembershipId_institutionId_actorId_fkey" FOREIGN KEY ("actorMembershipId", "institutionId", "actorId") REFERENCES "InstitutionMembership"("id", "institutionId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientMembershipId_institutionId_recipient_fkey" FOREIGN KEY ("recipientMembershipId", "institutionId", "recipientId") REFERENCES "InstitutionMembership"("id", "institutionId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enforce the approved canonical identity and lifecycle constraints.
ALTER TABLE "InstitutionMembership"
ADD CONSTRAINT "InstitutionMembership_role_official_id_check"
CHECK (
    ("role" = 'STUDENT' AND "studentId" IS NOT NULL AND "teacherId" IS NULL)
 OR ("role" = 'TEACHER' AND "teacherId" IS NOT NULL AND "studentId" IS NULL)
 OR ("role" = 'AUTHORITY' AND "studentId" IS NULL AND "teacherId" IS NULL)
);

ALTER TABLE "InstitutionMembership"
ADD CONSTRAINT "InstitutionMembership_deleted_authority_check"
CHECK (
    "deletedAt" IS NULL
 OR ("role" = 'AUTHORITY' AND "status" = 'INACTIVE')
);

ALTER TABLE "DepartmentMembership"
ADD CONSTRAINT "DepartmentMembership_primary_requires_active_check"
CHECK (NOT "isPrimary" OR "isActive");

ALTER TABLE "DepartmentChangeRequest"
ADD CONSTRAINT "DepartmentChangeRequest_department_fields_check"
CHECK (
    ("changeType" = 'STUDENT_CHANGE'
        AND "currentDepartmentId" IS NOT NULL
        AND "requestedDepartmentId" IS NOT NULL
        AND "currentDepartmentId" <> "requestedDepartmentId"
        AND "replacementDepartmentId" IS NULL)
 OR ("changeType" = 'TEACHER_ADD'
        AND "currentDepartmentId" IS NULL
        AND "requestedDepartmentId" IS NOT NULL
        AND "replacementDepartmentId" IS NULL)
 OR ("changeType" = 'TEACHER_REMOVE'
        AND "currentDepartmentId" IS NOT NULL
        AND "requestedDepartmentId" IS NULL
        AND ("replacementDepartmentId" IS NULL
             OR "replacementDepartmentId" <> "currentDepartmentId"))
 OR ("changeType" = 'TEACHER_PRIMARY_CHANGE'
        AND "currentDepartmentId" IS NOT NULL
        AND "requestedDepartmentId" IS NOT NULL
        AND "currentDepartmentId" <> "requestedDepartmentId"
        AND "replacementDepartmentId" IS NULL)
);

ALTER TABLE "Subscription"
ADD CONSTRAINT "Subscription_valid_term_check"
CHECK ("startsAt" < "endsAt");

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_success_requires_subscription_check"
CHECK ("status" <> 'SUCCESSFUL' OR "subscriptionId" IS NOT NULL);

ALTER TABLE "Issue"
ADD CONSTRAINT "Issue_archive_metadata_check"
CHECK (
    ("archivedAt" IS NULL
        AND "archivedById" IS NULL
        AND "archivedByMembershipId" IS NULL
        AND "archiveReason" IS NULL)
 OR ("archivedAt" IS NOT NULL
        AND "archivedById" IS NOT NULL
        AND "archivedByMembershipId" IS NOT NULL
        AND "archiveReason" IS NOT NULL
        AND "status" IN ('RESOLVED', 'CLOSED'))
);

CREATE UNIQUE INDEX "DepartmentMembership_one_active_primary_per_member_key"
ON "DepartmentMembership" ("membershipId")
WHERE "isActive" AND "isPrimary";

CREATE UNIQUE INDEX "DepartmentChangeRequest_one_pending_per_membership_key"
ON "DepartmentChangeRequest" ("membershipId")
WHERE "status" = 'PENDING';

CREATE FUNCTION "set_institution_normalized_name"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW."normalizedName" := lower(
        regexp_replace(
            regexp_replace(
                normalize(NEW."name", NFKC),
                '^[[:space:]]+|[[:space:]]+$',
                '',
                'g'
            ),
            '[[:space:]]+',
            ' ',
            'g'
        )
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER "Institution_normalized_name_trigger"
BEFORE INSERT OR UPDATE OF "name", "normalizedName"
ON "Institution"
FOR EACH ROW
EXECUTE FUNCTION "set_institution_normalized_name"();

CREATE FUNCTION "canonicalize_user_email"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW."email" := lower(btrim(NEW."email"));
    RETURN NEW;
END;
$$;

CREATE TRIGGER "User_canonical_email_trigger"
BEFORE INSERT OR UPDATE OF "email"
ON "User"
FOR EACH ROW
EXECUTE FUNCTION "canonicalize_user_email"();

CREATE FUNCTION "canonicalize_institution_contact_email"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW."contactEmail" := lower(btrim(NEW."contactEmail"));
    RETURN NEW;
END;
$$;

CREATE TRIGGER "Institution_canonical_contact_email_trigger"
BEFORE INSERT OR UPDATE OF "contactEmail"
ON "Institution"
FOR EACH ROW
EXECUTE FUNCTION "canonicalize_institution_contact_email"();

CREATE FUNCTION "enforce_membership_lifecycle"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    reviewer_role "UserRole";
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF NEW."id" <> OLD."id"
            OR NEW."institutionId" <> OLD."institutionId"
            OR NEW."userId" <> OLD."userId"
            OR NEW."role" <> OLD."role" THEN
            RAISE EXCEPTION 'Membership identity and role are immutable';
        END IF;

        IF NEW."status" IS NOT DISTINCT FROM OLD."status" THEN
            RETURN NEW;
        END IF;

        IF OLD."role" IN ('STUDENT', 'TEACHER')
            AND NOT (
                (OLD."status" = 'PENDING' AND NEW."status" IN ('ACTIVE', 'REJECTED'))
                OR (OLD."status" = 'ACTIVE' AND NEW."status" = 'INACTIVE')
                OR (OLD."status" = 'INACTIVE' AND NEW."status" = 'ACTIVE')
            ) THEN
            RAISE EXCEPTION 'Invalid student or teacher membership status transition';
        END IF;
    ELSIF NEW."role" IN ('STUDENT', 'TEACHER')
        AND NEW."status" <> 'PENDING' THEN
        RAISE EXCEPTION 'Student and teacher memberships must start pending';
    END IF;

    IF NEW."role" IN ('STUDENT', 'TEACHER')
        AND NEW."status" <> 'PENDING' THEN
        IF NEW."reviewedById" IS NULL
            OR NEW."reviewedByMembershipId" IS NULL
            OR NEW."reviewedAt" IS NULL THEN
            RAISE EXCEPTION 'Membership decisions require an Authority reviewer and review time';
        END IF;

        SELECT "role"
        INTO reviewer_role
        FROM "InstitutionMembership"
        WHERE "id" = NEW."reviewedByMembershipId"
          AND "institutionId" = NEW."institutionId"
          AND "userId" = NEW."reviewedById"
          AND "status" = 'ACTIVE'
          AND "deletedAt" IS NULL;

        IF reviewer_role IS DISTINCT FROM 'AUTHORITY'::"UserRole" THEN
            RAISE EXCEPTION 'Membership decisions must be reviewed by an active Authority in the same institution';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "InstitutionMembership_lifecycle_trigger"
BEFORE INSERT OR UPDATE
ON "InstitutionMembership"
FOR EACH ROW
EXECUTE FUNCTION "enforce_membership_lifecycle"();

CREATE FUNCTION "enforce_active_member_primary_department"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    target_membership_id TEXT;
    target_role "UserRole";
    target_status "MembershipStatus";
    primary_count INTEGER;
BEGIN
    IF TG_TABLE_NAME = 'InstitutionMembership' THEN
        target_membership_id := COALESCE(NEW."id", OLD."id");
    ELSIF TG_OP = 'DELETE' THEN
        target_membership_id := OLD."membershipId";
    ELSE
        target_membership_id := NEW."membershipId";
    END IF;

    SELECT "role", "status"
    INTO target_role, target_status
    FROM "InstitutionMembership"
    WHERE "id" = target_membership_id;

    IF target_status = 'ACTIVE'
        AND target_role IN ('STUDENT', 'TEACHER') THEN
        SELECT count(*)
        INTO primary_count
        FROM "DepartmentMembership"
        WHERE "membershipId" = target_membership_id
          AND "isActive"
          AND "isPrimary";

        IF primary_count <> 1 THEN
            RAISE EXCEPTION 'Every active student or teacher must have exactly one active primary department';
        END IF;
    END IF;

    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "InstitutionMembership_primary_department_trigger"
AFTER INSERT OR UPDATE
ON "InstitutionMembership"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "enforce_active_member_primary_department"();

CREATE CONSTRAINT TRIGGER "DepartmentMembership_primary_department_trigger"
AFTER INSERT OR UPDATE OR DELETE
ON "DepartmentMembership"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "enforce_active_member_primary_department"();

CREATE FUNCTION "enforce_department_change_request"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    member_role "UserRole";
    member_status "MembershipStatus";
    reviewer_role "UserRole";
    current_is_primary BOOLEAN;
BEGIN
    SELECT "role", "status"
    INTO member_role, member_status
    FROM "InstitutionMembership"
    WHERE "id" = NEW."membershipId"
      AND "institutionId" = NEW."institutionId";

    IF NOT FOUND OR member_status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'Only active institution members can request department changes';
    END IF;

    IF (NEW."changeType" = 'STUDENT_CHANGE' AND member_role <> 'STUDENT')
        OR (NEW."changeType" <> 'STUDENT_CHANGE' AND member_role <> 'TEACHER') THEN
        RAISE EXCEPTION 'Department change type does not match membership role';
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF NEW."status" <> 'PENDING'
            OR NEW."reviewedById" IS NOT NULL
            OR NEW."reviewedByMembershipId" IS NOT NULL
            OR NEW."reviewedAt" IS NOT NULL THEN
            RAISE EXCEPTION 'Department change requests must start pending';
        END IF;

        RETURN NEW;
    END IF;

    IF NEW."membershipId" <> OLD."membershipId"
        OR NEW."institutionId" <> OLD."institutionId"
        OR NEW."changeType" <> OLD."changeType"
        OR NEW."currentDepartmentId" IS DISTINCT FROM OLD."currentDepartmentId"
        OR NEW."requestedDepartmentId" IS DISTINCT FROM OLD."requestedDepartmentId"
        OR NEW."replacementDepartmentId" IS DISTINCT FROM OLD."replacementDepartmentId"
        OR NEW."requestedById" <> OLD."requestedById" THEN
        RAISE EXCEPTION 'Department change request details are immutable after submission';
    END IF;

    IF NEW."status" IS NOT DISTINCT FROM OLD."status" THEN
        RETURN NEW;
    END IF;

    IF OLD."status" <> 'PENDING'
        OR NEW."status" NOT IN ('APPROVED', 'REJECTED', 'CANCELLED') THEN
        RAISE EXCEPTION 'Only pending department change requests can be decided or cancelled';
    END IF;

    IF NEW."status" = 'CANCELLED' THEN
        IF NEW."reviewedById" IS NOT NULL
            OR NEW."reviewedByMembershipId" IS NOT NULL
            OR NEW."reviewedAt" IS NOT NULL THEN
            RAISE EXCEPTION 'Requester cancellation must not record an Authority reviewer';
        END IF;
        RETURN NEW;
    END IF;

    IF NEW."reviewedById" IS NULL
        OR NEW."reviewedByMembershipId" IS NULL
        OR NEW."reviewedAt" IS NULL THEN
        RAISE EXCEPTION 'Authority decisions require a reviewer and review time';
    END IF;

    SELECT "role"
    INTO reviewer_role
    FROM "InstitutionMembership"
    WHERE "id" = NEW."reviewedByMembershipId"
      AND "institutionId" = NEW."institutionId"
      AND "userId" = NEW."reviewedById"
      AND "status" = 'ACTIVE'
      AND "deletedAt" IS NULL;

    IF reviewer_role IS DISTINCT FROM 'AUTHORITY'::"UserRole" THEN
        RAISE EXCEPTION 'Department change requests must be reviewed by an active Authority in the same institution';
    END IF;

    IF NEW."status" = 'APPROVED' THEN
        IF NEW."changeType" IN ('STUDENT_CHANGE', 'TEACHER_ADD', 'TEACHER_PRIMARY_CHANGE')
            AND NOT EXISTS (
                SELECT 1
                FROM "Department"
                WHERE "id" = NEW."requestedDepartmentId"
                  AND "institutionId" = NEW."institutionId"
                  AND "status" = 'ACTIVE'
            ) THEN
            RAISE EXCEPTION 'The requested department must be active';
        END IF;

        IF NEW."changeType" = 'TEACHER_PRIMARY_CHANGE'
            AND NOT EXISTS (
                SELECT 1
                FROM "DepartmentMembership"
                WHERE "membershipId" = NEW."membershipId"
                  AND "departmentId" = NEW."requestedDepartmentId"
                  AND "institutionId" = NEW."institutionId"
                  AND "isActive"
            ) THEN
            RAISE EXCEPTION 'The requested teacher department must already be an active department membership';
        END IF;

        IF NEW."changeType" IN ('STUDENT_CHANGE', 'TEACHER_REMOVE', 'TEACHER_PRIMARY_CHANGE')
            AND NOT EXISTS (
                SELECT 1
                FROM "DepartmentMembership"
                WHERE "membershipId" = NEW."membershipId"
                  AND "departmentId" = NEW."currentDepartmentId"
                  AND "institutionId" = NEW."institutionId"
                  AND "isActive"
            ) THEN
            RAISE EXCEPTION 'The current department must be an active membership';
        END IF;

        IF NEW."changeType" = 'TEACHER_ADD'
            AND EXISTS (
                SELECT 1
                FROM "DepartmentMembership"
                WHERE "membershipId" = NEW."membershipId"
                  AND "departmentId" = NEW."requestedDepartmentId"
                  AND "institutionId" = NEW."institutionId"
                  AND "isActive"
            ) THEN
            RAISE EXCEPTION 'The teacher already has an active membership in the requested department';
        END IF;

        IF NEW."changeType" = 'TEACHER_REMOVE' THEN
            SELECT "isPrimary"
            INTO current_is_primary
            FROM "DepartmentMembership"
            WHERE "membershipId" = NEW."membershipId"
              AND "departmentId" = NEW."currentDepartmentId"
              AND "institutionId" = NEW."institutionId"
              AND "isActive";

            IF current_is_primary
                AND NEW."replacementDepartmentId" IS NULL THEN
                RAISE EXCEPTION 'Removing a teacher primary department requires a replacement department';
            END IF;

            IF NEW."replacementDepartmentId" IS NOT NULL
                AND NOT EXISTS (
                    SELECT 1
                    FROM "DepartmentMembership"
                    JOIN "Department"
                      ON "Department"."id" = "DepartmentMembership"."departmentId"
                     AND "Department"."institutionId" = "DepartmentMembership"."institutionId"
                    WHERE "DepartmentMembership"."membershipId" = NEW."membershipId"
                      AND "DepartmentMembership"."departmentId" = NEW."replacementDepartmentId"
                      AND "DepartmentMembership"."institutionId" = NEW."institutionId"
                      AND "DepartmentMembership"."isActive"
                      AND "Department"."status" = 'ACTIVE'
                ) THEN
                RAISE EXCEPTION 'Replacement must be an active membership in an active department';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "DepartmentChangeRequest_lifecycle_trigger"
BEFORE INSERT OR UPDATE
ON "DepartmentChangeRequest"
FOR EACH ROW
EXECUTE FUNCTION "enforce_department_change_request"();

CREATE FUNCTION "enforce_issue_audience_and_lifecycle"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    reporter_role "UserRole";
    reporter_status "MembershipStatus";
    archiver_role "UserRole";
BEGIN
    SELECT "role", "status"
    INTO reporter_role, reporter_status
    FROM "InstitutionMembership"
    WHERE "id" = NEW."reporterMembershipId"
      AND "institutionId" = NEW."institutionId"
      AND "userId" = NEW."reporterId";

    IF reporter_role IS NULL
        OR reporter_role::TEXT <> NEW."audience"::TEXT THEN
        RAISE EXCEPTION 'Issue audience must match the reporter membership role';
    END IF;

    IF TG_OP = 'INSERT'
        AND (reporter_status <> 'ACTIVE'
             OR EXISTS (
                 SELECT 1
                 FROM "InstitutionMembership"
                 WHERE "id" = NEW."reporterMembershipId"
                   AND "deletedAt" IS NOT NULL
             )) THEN
        RAISE EXCEPTION 'Only active members can create issues';
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF OLD."status" IS DISTINCT FROM NEW."status"
            AND NOT (
                (OLD."status" = 'OPEN' AND NEW."status" = 'IN_PROGRESS')
                OR (OLD."status" = 'IN_PROGRESS' AND NEW."status" = 'RESOLVED')
                OR (OLD."status" = 'RESOLVED' AND NEW."status" = 'CLOSED')
            ) THEN
            RAISE EXCEPTION 'Invalid issue status transition';
        END IF;

        IF OLD."archivedAt" IS NOT NULL
            AND NEW."archivedAt" IS NULL THEN
            RAISE EXCEPTION 'Archived issues cannot be unarchived';
        END IF;

        IF OLD."archivedAt" IS NOT NULL
            AND (NEW."archivedAt" IS DISTINCT FROM OLD."archivedAt"
                 OR NEW."archivedById" IS DISTINCT FROM OLD."archivedById"
                 OR NEW."archivedByMembershipId" IS DISTINCT FROM OLD."archivedByMembershipId"
                 OR NEW."archiveReason" IS DISTINCT FROM OLD."archiveReason") THEN
            RAISE EXCEPTION 'Issue archive metadata is immutable';
        END IF;

        IF OLD."archivedAt" IS NULL
            AND NEW."archivedAt" IS NOT NULL THEN
            SELECT "role"
            INTO archiver_role
            FROM "InstitutionMembership"
            WHERE "id" = NEW."archivedByMembershipId"
              AND "institutionId" = NEW."institutionId"
              AND "userId" = NEW."archivedById"
              AND "role" = 'AUTHORITY'
              AND "status" = 'ACTIVE'
              AND "deletedAt" IS NULL;

            IF archiver_role IS DISTINCT FROM 'AUTHORITY'::"UserRole" THEN
                RAISE EXCEPTION 'Only an active Authority in the institution can archive an issue';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "Issue_audience_and_lifecycle_trigger"
BEFORE INSERT OR UPDATE
ON "Issue"
FOR EACH ROW
EXECUTE FUNCTION "enforce_issue_audience_and_lifecycle"();

CREATE FUNCTION "enforce_active_department_has_successful_payment"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    target_department_id TEXT;
    target_institution_id TEXT;
BEGIN
    IF TG_TABLE_NAME = 'Department' THEN
        IF TG_OP = 'DELETE' THEN
            target_department_id := OLD."id";
            target_institution_id := OLD."institutionId";
        ELSE
            target_department_id := NEW."id";
            target_institution_id := NEW."institutionId";
        END IF;
    ELSIF TG_TABLE_NAME = 'Subscription' THEN
        IF TG_OP = 'DELETE' THEN
            target_department_id := OLD."departmentId";
            target_institution_id := OLD."institutionId";
        ELSE
            target_department_id := NEW."departmentId";
            target_institution_id := NEW."institutionId";
        END IF;
    ELSE
        IF TG_OP = 'DELETE' THEN
            target_department_id := OLD."departmentId";
            target_institution_id := OLD."institutionId";
        ELSE
            target_department_id := NEW."departmentId";
            target_institution_id := NEW."institutionId";
        END IF;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM "Department"
        WHERE "id" = target_department_id
          AND "institutionId" = target_institution_id
          AND "status" = 'ACTIVE'
    ) AND NOT EXISTS (
        SELECT 1
        FROM "Subscription"
        JOIN "Payment"
          ON "Payment"."subscriptionId" = "Subscription"."id"
         AND "Payment"."departmentId" = "Subscription"."departmentId"
         AND "Payment"."institutionId" = "Subscription"."institutionId"
        WHERE "Subscription"."departmentId" = target_department_id
          AND "Subscription"."institutionId" = target_institution_id
          AND "Subscription"."status" = 'ACTIVE'
          AND "Subscription"."startsAt" <= CURRENT_TIMESTAMP
          AND "Subscription"."endsAt" > CURRENT_TIMESTAMP
          AND "Payment"."status" = 'SUCCESSFUL'
    ) THEN
        RAISE EXCEPTION 'An active department requires a current active subscription and successful payment';
    END IF;

    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "Department_paid_activation_trigger"
AFTER INSERT OR UPDATE OR DELETE
ON "Department"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "enforce_active_department_has_successful_payment"();

CREATE CONSTRAINT TRIGGER "Subscription_paid_activation_trigger"
AFTER INSERT OR UPDATE OR DELETE
ON "Subscription"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "enforce_active_department_has_successful_payment"();

CREATE CONSTRAINT TRIGGER "Payment_paid_activation_trigger"
AFTER INSERT OR UPDATE OR DELETE
ON "Payment"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "enforce_active_department_has_successful_payment"();

CREATE FUNCTION "enforce_notification_recipient_tenant"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW."recipientMembershipId" IS NULL
        AND NOT EXISTS (
            SELECT 1
            FROM "Institution"
            WHERE "id" = NEW."institutionId"
              AND "adminUserId" = NEW."recipientId"
        ) THEN
        RAISE EXCEPTION 'Notification recipient must belong to the institution or administer it';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "Notification_recipient_tenant_trigger"
BEFORE INSERT OR UPDATE
ON "Notification"
FOR EACH ROW
EXECUTE FUNCTION "enforce_notification_recipient_tenant"();

CREATE FUNCTION "enforce_audit_actor_tenant"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW."institutionId" IS NOT NULL
        AND NEW."actorId" IS NOT NULL
        AND NEW."actorMembershipId" IS NULL
        AND NOT EXISTS (
            SELECT 1
            FROM "Institution"
            WHERE "id" = NEW."institutionId"
              AND "adminUserId" = NEW."actorId"
        ) THEN
        RAISE EXCEPTION 'Audit actor must belong to the institution or administer it';
    END IF;

    IF NEW."institutionId" IS NULL
        AND NEW."actorMembershipId" IS NOT NULL THEN
        RAISE EXCEPTION 'Platform audit entries cannot reference an institution membership';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "AuditLog_actor_tenant_trigger"
BEFORE INSERT OR UPDATE
ON "AuditLog"
FOR EACH ROW
EXECUTE FUNCTION "enforce_audit_actor_tenant"();

CREATE FUNCTION "prevent_append_only_row_changes"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION '% records are append-only', TG_TABLE_NAME;
    RETURN NULL;
END;
$$;

CREATE TRIGGER "AuditLog_append_only_trigger"
BEFORE UPDATE OR DELETE
ON "AuditLog"
FOR EACH ROW
EXECUTE FUNCTION "prevent_append_only_row_changes"();

CREATE TRIGGER "IssueHistory_append_only_trigger"
BEFORE UPDATE OR DELETE
ON "IssueHistory"
FOR EACH ROW
EXECUTE FUNCTION "prevent_append_only_row_changes"();
