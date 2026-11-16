ALTER TABLE "Notification"
ADD COLUMN "departmentId" TEXT;

UPDATE "Notification" AS notification
SET "departmentId" = issue."departmentId"
FROM "Issue" AS issue
WHERE notification."departmentId" IS NULL
  AND notification."relatedEntityType" = 'Issue'
  AND notification."relatedEntityId" = issue."id"
  AND notification."institutionId" = issue."institutionId";

UPDATE "Notification" AS notification
SET "departmentId" = membership."requestedDepartmentId"
FROM "InstitutionMembership" AS membership
WHERE notification."departmentId" IS NULL
  AND notification."relatedEntityType" = 'InstitutionMembership'
  AND notification."relatedEntityId" = membership."id"
  AND notification."institutionId" = membership."institutionId"
  AND membership."requestedDepartmentId" IS NOT NULL;

UPDATE "Notification" AS notification
SET "departmentId" = COALESCE(
    request."requestedDepartmentId",
    request."replacementDepartmentId",
    request."currentDepartmentId"
)
FROM "DepartmentChangeRequest" AS request
WHERE notification."departmentId" IS NULL
  AND notification."relatedEntityType" = 'DepartmentChangeRequest'
  AND notification."relatedEntityId" = request."id"
  AND notification."institutionId" = request."institutionId"
  AND COALESCE(
      request."requestedDepartmentId",
      request."replacementDepartmentId",
      request."currentDepartmentId"
  ) IS NOT NULL;

CREATE INDEX "Notification_institutionId_departmentId_recipientId_createdAt_idx"
ON "Notification"("institutionId", "departmentId", "recipientId", "createdAt");

ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_departmentId_institutionId_fkey"
FOREIGN KEY ("departmentId", "institutionId")
REFERENCES "Department"("id", "institutionId")
ON DELETE RESTRICT
ON UPDATE CASCADE;

UPDATE "AuditLog" AS log
SET "departmentId" = department."id"
FROM "Department" AS department
WHERE log."departmentId" IS NULL
  AND log."institutionId" = department."institutionId"
  AND department."id" = COALESCE(
      log."metadata" ->> 'departmentId',
      (
          SELECT issue."departmentId"
          FROM "Issue" AS issue
          WHERE log."entityType" = 'Issue'
            AND log."entityId" = issue."id"
            AND log."institutionId" = issue."institutionId"
          LIMIT 1
      ),
      (
          SELECT COALESCE(
              request."requestedDepartmentId",
              request."replacementDepartmentId",
              request."currentDepartmentId"
          )
          FROM "DepartmentChangeRequest" AS request
          WHERE log."entityType" = 'DepartmentChangeRequest'
            AND log."entityId" = request."id"
            AND log."institutionId" = request."institutionId"
          LIMIT 1
      ),
      (
          SELECT membership."requestedDepartmentId"
          FROM "InstitutionMembership" AS membership
          WHERE log."entityType" = 'InstitutionMembership'
            AND log."entityId" = membership."id"
            AND log."institutionId" = membership."institutionId"
          LIMIT 1
      )
  );
