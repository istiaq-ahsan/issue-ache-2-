CREATE UNIQUE INDEX "AuthorityDepartment_authorityMembershipId_key"
ON "AuthorityDepartment"("authorityMembershipId");

DROP INDEX IF EXISTS "AuthorityDepartment_authorityMembershipId_departmentId_key";

ALTER TABLE "AuditLog"
DROP CONSTRAINT "AuditLog_departmentId_institutionId_fkey";

CREATE INDEX "AuditLog_institutionId_departmentId_idx"
ON "AuditLog"("institutionId", "departmentId");
