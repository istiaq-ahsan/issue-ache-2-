# Issue Ache! --- Development Plan

This plan follows the nine development phases in the PRD and expands
them into practical implementation steps. Complete and test each phase
before moving to the next.

## Working Rules

-   JavaScript only; no TypeScript.
-   Frontend uses React + Vite + JSX.
-   Backend uses Node.js + Express.js.
-   PostgreSQL + Prisma is the system of record.
-   Firebase Authentication handles authentication only.
-   Backend is the authority for roles, institution scope, and
    permissions.
-   Do not implement AI or duplicate issue detection.
-   Do not build all modules at once. Keep each phase runnable and
    testable.

## Phase 0 --- Confirm Design Decisions

Before schema migrations, settle the open questions in
`05-DATABASE-SCHEMA.md`, especially: - Institution dashboard
authentication/ownership model. - Membership and official-ID
placement. - `MembershipDepartmentRequest` versus
`DepartmentChangeRequest`. - Department, subscription, issue, and
Authority deletion lifecycles. - Subscription plans, price, currency,
and duration.

**Exit criteria:** agreed schema decisions documented.

## Phase 1 --- Foundation

### Backend

1.  Initialize Node.js project.
2.  Configure Express app and server entry.
3.  Add environment loading.
4.  Add CORS, JSON parsing, request logging, and centralized error
    handling.
5.  Add health-check endpoint.
6.  Add route mounting structure.
7.  Add Prisma and PostgreSQL connection.
8.  Add Firebase Admin SDK configuration.
9.  Add request validation approach.

### Frontend

1.  Initialize Vite React JavaScript project.
2.  Configure Tailwind CSS and shadcn/ui.
3.  Configure React Router.
4.  Configure Axios instance and API base URL.
5.  Configure TanStack Query provider.
6.  Configure Firebase client SDK.
7.  Add shared layouts, error/loading states, and design tokens.

**Exit criteria:** frontend and backend run locally; frontend can call
backend health endpoint; database connection works.

## Phase 2 --- Database

1.  Implement Prisma enums and core models.
2.  Add institution and user identity models.
3.  Add membership and department models.
4.  Add subscription and payment models.
5.  Add department-change request model(s).
6.  Add issue, history, and note models.
7.  Add notification and audit-log models.
8.  Add unique constraints and indexes.
9.  Create and apply migrations.
10. Seed only safe development data.

**Exit criteria:** migrations apply cleanly; relations and unique
constraints are verified; no `IssueDuplicate` model exists.

## Phase 3 --- Authentication and Authorization

1.  Implement Firebase ID-token verification middleware.
2.  Resolve Firebase UID to PostgreSQL user.
3.  Resolve institution membership and role from database.
4.  Enforce membership/account status.
5.  Implement role middleware.
6.  Implement institution-scope middleware/helpers.
7.  Implement department-access validation.
8.  Add protected test endpoints.
9.  Test invalid, expired, and missing tokens.
10. Test role escalation and cross-tenant access attempts.

**Exit criteria:** backend derives identity and permissions from
verified token plus database records; client-supplied role/institution
IDs cannot grant access.

## Phase 4 --- Institution Onboarding and Departments

1.  Build institution registration UI and API.
2.  Normalize institution names consistently.
3.  Enforce duplicate institution constraint in PostgreSQL.
4.  Generate unique Institution Code.
5.  Implement institution dashboard access model.
6.  Build department create/list/detail/edit APIs and pages.
7.  Ensure new departments start `LOCKED`.
8.  Implement plan selection and demo checkout.
9.  Implement payment record creation.
10. Implement transactional subscription creation and department
    activation.
11. Implement department lock/disable and subscription/payment history.

**Exit criteria:** institution can onboard, create locked departments,
and activate departments through a successful demo payment; duplicate
institution registration is blocked.

## Phase 5 --- Authority

1.  Implement institution-controlled Authority creation.
2.  Create Firebase account using Firebase Admin SDK.
3.  Create corresponding PostgreSQL user and membership.
4.  Handle partial failure and compensation if either system operation
    fails.
5.  Implement Authority list, edit, enable, disable, and delete.
6.  Implement password reset/change through Firebase flow.
7.  Build Authority dashboard shell and navigation.
8.  Record Authority lifecycle actions in audit logs.

**Exit criteria:** no public Authority registration; institution can
manage Authority accounts; Authority can authenticate and access only
its institution.

## Phase 6 --- Student and Teacher

1.  Build Institution Code lookup.
2.  Load only active departments for the selected institution.
3.  Build student registration with Student ID.
4.  Build teacher registration with Teacher/Employee ID.
5.  Enforce institution-scoped ID uniqueness.
6.  Create Firebase identity and PostgreSQL user/membership.
7.  Set membership to `PENDING`.
8.  Build pending-registration queues for Authority.
9.  Implement approve/reject actions transactionally.
10. Build student and teacher profile pages.
11. Enforce editable versus protected profile fields.
12. Build department-change request forms and Authority review.
13. Apply approved department membership changes transactionally.

**Exit criteria:** student and teacher cannot become active without
Authority approval; official IDs are unique per institution; department
changes are approval-based.

## Phase 7 --- Issue Management

1.  Implement issue creation API and form for students.
2.  Implement issue creation API and form for teachers.
3.  Derive issue audience from authenticated role on backend.
4.  Implement role-filtered issue lists.
5.  Implement issue detail pages.
6.  Implement Authority issue dashboard and audience filters.
7.  Implement status transitions and Issue History.
8.  Implement internal/public notes and visibility checks.
9.  Implement resolution summary.
10. Implement archive operation and archive metadata.
11. Test student/teacher issue visibility boundaries.

**Exit criteria:** student sees student issues only; teacher sees
teacher issues only; Authority sees both; history is preserved; no
duplicate detection exists.

## Phase 8 --- Analytics, Notifications, and Audit

1.  Implement notification creation for all PRD events.
2.  Implement notification list and UI.
3.  Implement student and teacher dashboard statistics.
4.  Implement Authority dashboard statistics.
5.  Implement institution dashboard statistics.
6.  Implement analytics by role, department, issue category, audience,
    and status.
7.  Implement audit-log creation for important actions.
8.  Implement audit-log listing with institution scoping.
9.  Verify audit history cannot be silently altered through ordinary
    application endpoints.

**Exit criteria:** required dashboard metrics, notifications, and audit
records are available and tenant-scoped.

## Phase 9 --- Security and Acceptance Testing

### Tenant isolation

-   Institution A cannot list or read Institution B records.
-   Institution A cannot update/delete Institution B departments, users,
    payments, or issues.
-   Cross-tenant IDs supplied in request bodies or URLs are rejected.

### Authentication and roles

-   Invalid/expired Firebase token is rejected.
-   Student cannot call Authority endpoints.
-   Teacher cannot call Authority endpoints.
-   A client cannot change its role or institution by editing request
    payloads.
-   Disabled/inactive membership cannot use protected features.

### Registration and onboarding

-   Duplicate institution is blocked.
-   Duplicate student ID within one institution is blocked.
-   Duplicate teacher ID within one institution is blocked.
-   Same student/teacher ID in a different institution is allowed.
-   Registration into locked/expired department is blocked.
-   Pending users cannot access active-user features.

### Department and payment

-   New department starts locked.
-   Failed/cancelled demo payment does not activate department.
-   Successful payment creates subscription and activates department
    atomically.
-   Transaction rollback leaves no partial activation.

### Department changes

-   Student cannot directly edit department membership.
-   Teacher cannot directly add/remove departments.
-   Only authorized Authority can approve/reject requests.
-   Cross-institution department IDs are rejected.
-   Approval transaction updates membership, request, notification, and
    audit log consistently.

### Issues

-   Student-created issue audience is always `STUDENT`.
-   Teacher-created issue audience is always `TEACHER`.
-   Student cannot view teacher-only issues.
-   Teacher cannot view student-only issues.
-   Authority can view both.
-   Unauthorized internal notes are hidden.
-   Status changes create history.
-   Archive retains the issue record.

**Exit criteria:** all acceptance criteria in the PRD pass; critical
authorization and transaction tests pass.

## Suggested Build Order for a Small Team

1.  Foundation and database.
2.  Authentication/authorization.
3.  Institution onboarding and department activation.
4.  Authority account management.
5.  Student/teacher registration and approvals.
6.  Profiles and department-change requests.
7.  Issue reporting and Authority issue management.
8.  Notifications, analytics, audit logs.
9.  Security hardening and deployment.

## Deployment Readiness Checklist

-   Separate development and production environment variables.
-   Production PostgreSQL and Prisma migrations verified.
-   Firebase production project configured.
-   CORS restricted to approved frontend origins.
-   HTTPS enabled.
-   Secrets excluded from Git.
-   Database backups configured.
-   Error logs and server health monitoring available.
-   Rate limiting enabled on sensitive endpoints.
-   Production smoke tests completed for all three roles and institution
    onboarding.
