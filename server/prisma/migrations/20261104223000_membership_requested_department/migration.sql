ALTER TABLE "InstitutionMembership"
ADD COLUMN "requestedDepartmentId" TEXT;

CREATE INDEX "InstitutionMembership_institutionId_requestedDepartmentId_idx"
ON "InstitutionMembership"("institutionId", "requestedDepartmentId");

ALTER TABLE "InstitutionMembership"
ADD CONSTRAINT "InstitutionMembership_requestedDepartmentId_institutionId_fkey"
FOREIGN KEY ("requestedDepartmentId", "institutionId")
REFERENCES "Department"("id", "institutionId")
ON DELETE RESTRICT
ON UPDATE CASCADE;
