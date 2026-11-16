DROP INDEX IF EXISTS "Department_institutionId_status_idx";

ALTER TABLE "Department"
DROP COLUMN "status";

DROP TYPE "DepartmentStatus";

CREATE INDEX "Department_institutionId_idx" ON "Department"("institutionId");
