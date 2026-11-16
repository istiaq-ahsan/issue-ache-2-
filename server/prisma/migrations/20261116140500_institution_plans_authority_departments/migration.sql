-- Expand institution billing and Authority department access without removing
-- legacy department status or billing data.
CREATE TYPE "PlanCode" AS ENUM ('BASIC', 'PRO');
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'YEARLY');
CREATE TYPE "RegistrationIntentStatus" AS ENUM (
    'PENDING_PAYMENT',
    'COMPLETED',
    'FAILED',
    'CANCELLED',
    'EXPIRED'
);
CREATE TYPE "PaymentProvider" AS ENUM ('DEMO', 'SSLCOMMERZ');

ALTER TYPE "SubscriptionStatus" ADD VALUE 'TRIALING';

ALTER TABLE "Subscription"
    ADD COLUMN "billingCycle" "BillingCycle",
    ADD COLUMN "planCode" "PlanCode",
    ADD COLUMN "trialEndsAt" TIMESTAMP(3),
    ALTER COLUMN "departmentId" DROP NOT NULL;

DO $$
DECLARE
    unsupported_providers TEXT;
BEGIN
    SELECT string_agg(DISTINCT "provider", ', ')
    INTO unsupported_providers
    FROM "Payment"
    WHERE upper("provider") NOT IN ('DEMO', 'SSLCOMMERZ');

    IF unsupported_providers IS NOT NULL THEN
        RAISE EXCEPTION
            'Cannot migrate Payment.provider; unsupported existing values: %',
            unsupported_providers;
    END IF;
END
$$;

ALTER TABLE "Payment"
    ADD COLUMN "billingCycle" "BillingCycle",
    ADD COLUMN "planCode" "PlanCode",
    ADD COLUMN "providerTransactionId" TEXT,
    ADD COLUMN "rawResponse" JSONB,
    ADD COLUMN "registrationIntentId" TEXT,
    ALTER COLUMN "institutionId" DROP NOT NULL,
    ALTER COLUMN "departmentId" DROP NOT NULL,
    ALTER COLUMN "provider" DROP DEFAULT;

ALTER TABLE "Payment"
    ALTER COLUMN "provider" TYPE "PaymentProvider"
    USING upper("provider")::"PaymentProvider";

ALTER TABLE "Payment"
    ALTER COLUMN "provider" SET DEFAULT 'DEMO';

ALTER TABLE "AuditLog"
    ADD COLUMN "departmentId" TEXT;

CREATE TABLE "AuthorityDepartment" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "authorityMembershipId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuthorityDepartment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RegistrationIntent" (
    "id" TEXT NOT NULL,
    "planCode" "PlanCode" NOT NULL,
    "billingCycle" "BillingCycle" NOT NULL,
    "status" "RegistrationIntentStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BDT',
    "institutionName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "contactPersonName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "campusType" TEXT NOT NULL,
    "campusSize" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "adminName" TEXT NOT NULL,
    "adminEmail" TEXT NOT NULL,
    "firebaseUid" TEXT NOT NULL,
    "institutionId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RegistrationIntent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthorityDepartment_authorityMembershipId_departmentId_key"
    ON "AuthorityDepartment"("authorityMembershipId", "departmentId");
CREATE INDEX "AuthorityDepartment_institutionId_idx"
    ON "AuthorityDepartment"("institutionId");
CREATE INDEX "AuthorityDepartment_departmentId_idx"
    ON "AuthorityDepartment"("departmentId");

CREATE UNIQUE INDEX "RegistrationIntent_firebaseUid_key"
    ON "RegistrationIntent"("firebaseUid");
CREATE INDEX "RegistrationIntent_status_idx"
    ON "RegistrationIntent"("status");
CREATE INDEX "RegistrationIntent_expiresAt_idx"
    ON "RegistrationIntent"("expiresAt");
CREATE INDEX "RegistrationIntent_normalizedName_idx"
    ON "RegistrationIntent"("normalizedName");
CREATE INDEX "RegistrationIntent_contactEmail_idx"
    ON "RegistrationIntent"("contactEmail");

CREATE UNIQUE INDEX "Payment_registrationIntentId_key"
    ON "Payment"("registrationIntentId");
CREATE UNIQUE INDEX "Payment_provider_providerTransactionId_key"
    ON "Payment"("provider", "providerTransactionId");
CREATE INDEX "AuditLog_departmentId_createdAt_idx"
    ON "AuditLog"("departmentId", "createdAt");

ALTER TABLE "AuthorityDepartment"
    ADD CONSTRAINT "AuthorityDepartment_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "Institution"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuthorityDepartment"
    ADD CONSTRAINT "AuthorityDepartment_authorityMembershipId_institutionId_fkey"
    FOREIGN KEY ("authorityMembershipId", "institutionId")
    REFERENCES "InstitutionMembership"("id", "institutionId")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuthorityDepartment"
    ADD CONSTRAINT "AuthorityDepartment_departmentId_institutionId_fkey"
    FOREIGN KEY ("departmentId", "institutionId")
    REFERENCES "Department"("id", "institutionId")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuthorityDepartment"
    ADD CONSTRAINT "AuthorityDepartment_assignedById_fkey"
    FOREIGN KEY ("assignedById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Subscription"
    ADD CONSTRAINT "Subscription_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "Institution"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment"
    ADD CONSTRAINT "Payment_registrationIntentId_fkey"
    FOREIGN KEY ("registrationIntentId") REFERENCES "RegistrationIntent"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RegistrationIntent"
    ADD CONSTRAINT "RegistrationIntent_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "Institution"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditLog"
    ADD CONSTRAINT "AuditLog_departmentId_institutionId_fkey"
    FOREIGN KEY ("departmentId", "institutionId")
    REFERENCES "Department"("id", "institutionId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

COMMENT ON COLUMN "Department"."status"
    IS 'Deprecated: retained temporarily for expand/contract compatibility.';
COMMENT ON COLUMN "Subscription"."departmentId"
    IS 'Deprecated: populated only for legacy department subscriptions.';
COMMENT ON COLUMN "Subscription"."planName"
    IS 'Deprecated: legacy display label; planCode is canonical for institution subscriptions.';
COMMENT ON COLUMN "Payment"."departmentId"
    IS 'Deprecated: populated only for legacy department payments.';
COMMENT ON COLUMN "Payment"."transactionReference"
    IS 'Deprecated: legacy department payment reference.';

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "InstitutionMembership" AS membership
        WHERE membership."role" = 'AUTHORITY'
          AND NOT EXISTS (
              SELECT 1
              FROM "Department" AS department
              WHERE department."institutionId" = membership."institutionId"
          )
    ) THEN
        RAISE EXCEPTION
            'Cannot backfill AuthorityDepartment: an Authority belongs to an institution with no departments';
    END IF;
END
$$;

INSERT INTO "AuthorityDepartment" (
    "id",
    "institutionId",
    "authorityMembershipId",
    "departmentId",
    "assignedById",
    "createdAt"
)
SELECT
    'legacy_authority_department_' || membership."id" || '_' || department."id",
    membership."institutionId",
    membership."id",
    department."id",
    institution."adminUserId",
    CURRENT_TIMESTAMP
FROM "InstitutionMembership" AS membership
JOIN "Institution" AS institution
    ON institution."id" = membership."institutionId"
JOIN "Department" AS department
    ON department."institutionId" = membership."institutionId"
WHERE membership."role" = 'AUTHORITY';

INSERT INTO "Subscription" (
    "id",
    "institutionId",
    "departmentId",
    "planName",
    "planCode",
    "billingCycle",
    "status",
    "startsAt",
    "endsAt",
    "trialEndsAt",
    "createdAt",
    "updatedAt"
)
SELECT
    'grandfathered_' || institution."id",
    institution."id",
    NULL,
    'Pro (Grandfathered)',
    'PRO',
    'YEARLY',
    'ACTIVE',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP + INTERVAL '1 year',
    NULL,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Institution" AS institution;
