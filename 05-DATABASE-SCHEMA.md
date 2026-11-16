# Issue Ache! --- Database Schema Blueprint

**Purpose:** Relational model blueprint for implementing the PRD in
PostgreSQL with Prisma.\
**Important:** This is a design blueprint, not a
generated/migration-tested Prisma schema. Confirm the open decisions at
the end before finalizing migrations.

## 1. Modeling Principles

1.  Every institution-owned record must carry or be reachable through an
    `institutionId`.
2.  Every protected request derives institution scope from the
    authenticated user and membership.
3.  Use database unique constraints for institution names, Institution
    Codes, and institutional IDs.
4.  Use foreign keys and transactional workflows to protect referential
    integrity.
5.  Firebase authenticates users; PostgreSQL stores application identity
    and authorization.
6.  Do not create an `IssueDuplicate` model.

## 2. Enums

``` prisma
enum UserRole {
  AUTHORITY
  STUDENT
  TEACHER
}

enum MembershipStatus {
  PENDING
  ACTIVE
  REJECTED
  INACTIVE
}

enum DepartmentStatus {
  LOCKED
  ACTIVE
  EXPIRED
}

enum SubscriptionStatus {
  ACTIVE
  EXPIRED
  CANCELLED
}

enum PaymentStatus {
  PENDING
  SUCCESSFUL
  FAILED
  CANCELLED
}

enum DepartmentChangeStatus {
  PENDING
  APPROVED
  REJECTED
  CANCELLED
}

enum DepartmentChangeType {
  STUDENT_CHANGE
  TEACHER_ADD
  TEACHER_REMOVE
  TEACHER_PRIMARY_CHANGE
}

enum IssueCategory {
  CLASSROOM_EQUIPMENT
  WIFI_NETWORKING
  ELECTRICAL
  FURNITURE_INFRASTRUCTURE
  CLEANING_SANITATION
  LAB_EQUIPMENT
  OTHER
}

enum IssuePriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

enum IssueStatus {
  OPEN
  IN_PROGRESS
  RESOLVED
  CLOSED
}

enum IssueAudience {
  STUDENT
  TEACHER
}

enum NoteVisibility {
  INTERNAL
  PUBLIC
}
```

The PRD does not explicitly define all enum values for institution
status, notification status, or Authority status. Avoid adding them
without agreeing on the lifecycle.

## 3. Core Models and Fields

### Institution

-   `id`
-   `name`
-   `normalizedName` --- unique
-   `institutionCode` --- unique
-   `contactPersonName`
-   `contactEmail` --- unique according to the PRD recommendation
-   `campusType`
-   `campusSize`
-   `location`
-   `createdAt`
-   `updatedAt`

### User

-   `id`
-   `firebaseUid` --- unique
-   `name`
-   `email`
-   `phone`
-   `role` --- `AUTHORITY`, `STUDENT`, or `TEACHER`
-   `studentId` --- nullable
-   `teacherId` --- nullable
-   `requestedDepartmentId` --- nullable, institution-scoped department
    requested during student/teacher registration; retained for
    Authority review and registration history
-   `createdAt`
-   `updatedAt`

Role-specific ID rules: - Student: `studentId` required, `teacherId`
null. - Teacher: `teacherId` required, `studentId` null. - Authority:
both null.

The PRD describes institution-scoped uniqueness for student/teacher IDs.
If users belong to only one institution, enforce composite uniqueness
through membership-aware modeling or store the institutional ID on the
membership record. Do not assume global uniqueness.

### InstitutionMembership

-   `id`
-   `institutionId`
-   `userId`
-   `role`
-   `status`
-   `createdAt`
-   `updatedAt`
-   `reviewedById` (nullable, if recording the approver directly)

Recommended constraints: - Unique `(institutionId, userId)` if one
membership per user per institution. - Enforce role/ID consistency. - A
user's institution and role must be resolved from this record, not
request payloads.

The requested department is stored on the pending membership so an
Authority can review it without creating an active department membership
before approval. Approval creates the active primary
`DepartmentMembership` transactionally; rejection retains the requested
department for audit/history.

### Department

-   `id`
-   `institutionId`
-   `name`
-   `status` --- starts `LOCKED`
-   `createdAt`
-   `updatedAt`

Recommended constraint: unique
`(institutionId, normalizedDepartmentName)` if duplicate department
names should be prevented. This duplicate rule is a recommendation, not
specified by the PRD.

### DepartmentMembership

-   `id`
-   `institutionId`
-   `membershipId`
-   `departmentId`
-   `isPrimary`
-   `isActive`
-   `createdAt`
-   `updatedAt`

Recommended constraints: - Membership and department must belong to the
same institution. - Student may have only one active primary
department. - Teacher may have multiple active departments; define the
primary-department invariant.

### MembershipDepartmentRequest

The source model list includes `MembershipDepartmentRequest`, but its
purpose/fields are not separately explained. Confirm whether this is
distinct from `DepartmentChangeRequest` or redundant before
implementation.

### DepartmentChangeRequest

-   `id`
-   `institutionId`
-   `membershipId`
-   `changeType`
-   `currentDepartmentId` (nullable for add)
-   `requestedDepartmentId` (nullable for remove, depending on
    operation)
-   `reason`
-   `status`
-   `requestedById`
-   `reviewedById` (nullable)
-   `requestedAt`
-   `reviewedAt` (nullable)

The PRD's base fields are preserved. `institutionId` and `changeType`
are recommended to make tenant scoping and teacher
add/remove/primary-change operations explicit.

### Subscription

-   `id`
-   `institutionId`
-   `departmentId`
-   `planName` or `planId`
-   `status`
-   `startsAt`
-   `endsAt`
-   `createdAt`
-   `updatedAt`

Subscriptions belong to departments. Plan catalog details and billing
periods are not defined in the PRD.

### Payment

-   `id`
-   `institutionId`
-   `departmentId`
-   `subscriptionId` (nullable until created, depending on transaction
    design)
-   `amount`
-   `currency`
-   `status`
-   `paymentMethod` or `provider` (e.g. demo)
-   `transactionReference`
-   `createdAt`
-   `updatedAt`

The PRD requires demo payment and payment history but does not specify
plan prices, currency, tax, or refund behavior.

### Issue

-   `id`
-   `institutionId`
-   `departmentId`
-   `reporterId`
-   `title`
-   `description`
-   `category`
-   `priority`
-   `status`
-   `audience`
-   `location`
-   `resolutionSummary` (nullable)
-   `archivedAt` (nullable)
-   `archivedById` (nullable)
-   `archiveReason` (recommended from archive requirements)
-   `createdAt`
-   `updatedAt`

Audience must be assigned by the backend from the authenticated
reporter's role.

### IssueHistory

-   `id`
-   `institutionId`
-   `issueId`
-   `oldStatus`
-   `newStatus`
-   `changedById`
-   `note` (nullable)
-   `resolutionSummary` (nullable)
-   `createdAt`

History is append-only for ordinary application workflows.

### IssueNote

-   `id`
-   `institutionId`
-   `issueId`
-   `authorId`
-   `content`
-   `visibility` --- `INTERNAL` or `PUBLIC`
-   `createdAt`
-   `updatedAt`

### AuditLog

-   `id`
-   `institutionId` (nullable for platform-level events if such events
    are later introduced)
-   `actorId` (nullable for system events if needed)
-   `action`
-   `entityType`
-   `entityId`
-   `metadata` (JSON)
-   `createdAt`

### Notification

-   `id`
-   `institutionId`
-   `recipientId`
-   `type`
-   `title`
-   `message`
-   `relatedEntityType` (nullable)
-   `relatedEntityId` (nullable)
-   `readAt` (nullable; recommended, though read state is not defined in
    the PRD)
-   `createdAt`

## 4. Relationship Overview

``` mermaid
erDiagram
    Institution ||--o{ InstitutionMembership : has
    Institution ||--o{ Department : has
    User ||--o{ InstitutionMembership : joins
    InstitutionMembership ||--o{ DepartmentMembership : has
    Department ||--o{ DepartmentMembership : contains
    InstitutionMembership ||--o{ DepartmentChangeRequest : requests
    Department ||--o{ Subscription : subscribed
    Department ||--o{ Payment : receives
    Institution ||--o{ Issue : owns
    Department ||--o{ Issue : categorizes
    User ||--o{ Issue : reports
    Issue ||--o{ IssueHistory : records
    Issue ||--o{ IssueNote : has
    Institution ||--o{ AuditLog : records
    User ||--o{ Notification : receives
```

## 5. Critical Database Constraints

-   `Institution.normalizedName` unique.
-   `Institution.institutionCode` unique.
-   `Institution.contactEmail` unique if following the PRD
    recommendation.
-   `User.firebaseUid` unique.
-   Student ID unique within institution.
-   Teacher ID unique within institution.
-   Department subscription references the same institution as the
    department.
-   Issue department and reporter must belong to the same institution.
-   Department membership must connect a membership and department from
    the same institution.
-   Department-change request must reference departments and membership
    in the same institution.
-   Prevent invalid role/official-ID combinations.
-   Do not allow cross-tenant relationships through API or database
    writes.

Some cross-table tenant constraints cannot be expressed as a simple
Prisma `@@unique`; enforce them through transaction/service validation
and, where appropriate, PostgreSQL composite foreign keys or database
constraints.

## 6. Important Transaction Boundaries

### Department activation

1.  Verify institution owns department.
2.  Verify payment is successful.
3.  Create subscription.
4.  Set department active.
5.  Create audit log and notification.
6.  Commit all related database changes together.

### Student/teacher approval

1.  Verify Authority and pending membership share institution.
2.  Set membership active.
3.  Create active department membership.
4.  Create notification.
5.  Create audit log.
6.  Commit together.

### Department-change approval

1.  Verify request is pending and tenant-scoped.
2.  Validate requested department is active and belongs to same
    institution.
3.  Apply the appropriate student/teacher membership changes.
4.  Mark request approved and record reviewer/time.
5.  Create notification and audit log.
6.  Commit together.

## 7. Schema Decisions Required Before Final Migration

1.  Is `MembershipDepartmentRequest` a separate entity or should it be
    removed in favor of `DepartmentChangeRequest`?
2.  Are Student ID and Teacher ID stored on `User` or
    `InstitutionMembership`? Membership is the safer location if a user
    may ever join multiple institutions.
3.  Can one email address have multiple role/institution memberships?
4.  What is the exact institution contact-email uniqueness rule?
5.  What are the subscription plans, prices, duration, and currency?
6.  What is the complete department status lifecycle, including manual
    lock and expiration?
7.  Can students/teachers be reactivated after rejection or
    deactivation?
8.  Can issues be reopened? Which status transitions are permitted?
9.  Can archived issues be unarchived?
10. Should notifications have read/unread state and delivery channels?
11. Should Authority deletion be soft or hard, and how should Firebase
    accounts be handled?
12. Is Institution an authenticated Firebase principal or is institution
    administration represented by a separate owner/account model? The
    PRD gives an institution dashboard immediately after registration
    but does not fully specify its login identity model.
