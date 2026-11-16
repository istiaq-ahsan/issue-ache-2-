# Issue Ache! --- Product Requirements Document

**Version:** 1.0\
**Scope:** Initial release (MVP)\
**Source:** Issue Ache! PRD supplied by the user

## 1. Product Overview

Issue Ache! is a multi-tenant campus management and
issue-reporting SaaS platform for educational institutions. Each
institution manages its departments, subscriptions, authorities,
students, teachers, and campus issues independently.

### Product goals

-   Allow institutions to register and manage their campus workspace.
-   Allow institutions to create departments and activate them through
    subscriptions.
-   Allow institutions to create and manage Authority accounts.
-   Allow students and teachers to register using an Institution Code
    and official institutional ID.
-   Require Authority approval before student or teacher accounts become
    active.
-   Support role-specific issue reporting and tracking.
-   Provide institution-level and Authority-level analytics.
-   Preserve important actions through audit logs.
-   Enforce strict tenant isolation at the backend and database levels.

### Out of scope

-   AI assistant or chatbot.
-   AI issue classification, recommendations, diagnosis, or duplicate
    detection.
-   Automatic issue merging or deletion.
-   Real payment gateway in the initial release.

## 2. Roles and Access Contexts

The application has exactly three user roles:

  -----------------------------------------------------------------------
  Role                                Description
  ----------------------------------- -----------------------------------
  `AUTHORITY`                         Institution-created user who
                                      manages institutional users,
                                      requests, issues, analytics, and
                                      audit logs.

  `STUDENT`                           Institution member who reports and
                                      tracks student-audience issues.

  `TEACHER`                           Institution member who reports and
                                      tracks teacher-audience issues.
  -----------------------------------------------------------------------

Institution registration and institution administration are a separate
onboarding/administrative context. There is no `STAFF` role and no
public Authority registration.

## 3. Technology Requirements

### Frontend

-   React, Vite, JavaScript, JSX
-   Tailwind CSS, shadcn/ui
-   Framer Motion, GSAP
-   React Icons, Lucide React
-   React Router
-   Axios, TanStack Query
-   Sonner, SweetAlert2
-   React Hook Form, Zod
-   Firebase Authentication SDK
-   Additional JavaScript libraries may be used when necessary.

### Backend

-   Node.js, Express.js, JavaScript
-   Prisma ORM
-   JavaScript files only (`.js`); no TypeScript.

### Database and authentication

-   PostgreSQL hosted on Supabase
-   Firebase Authentication with email/password
-   Firebase ID-token verification on protected backend requests

### Payment

-   Simulated/demo payment only. No real payment gateway is required for
    the initial version.

## 4. Institution Registration and Uniqueness

Public institution registration fields: - Institution name - Contact
person name - Contact email - Campus type - Campus size - Location

After successful registration: 1. Normalize the institution name. 2.
Check for an existing institution. 3. Create the institution. 4.
Generate a unique Institution Code. 5. Provide the institution
dashboard.

The same institution must not register more than once. The database must
enforce uniqueness using a normalized institution name. Contact email
must also be unique according to the source PRD's recommended
constraint.

The Institution Code is required for student and teacher registration,
but not for normal login.

## 5. Institution Dashboard and Management

The institution dashboard displays: - Institution name and Institution
Code - Total, active, locked, and expired departments - Total students
and teachers - Pending approvals - Student and teacher issue counts -
Authority account counts/status

The institution can: - Create, view, and edit departments. - Activate
departments through a subscription. - View subscriptions and payment
history. - Lock/disable departments. - Create, view, edit, enable,
disable, and delete Authority accounts. - Manage initial Authority
credentials.

## 6. Department and Subscription Rules

-   Department creation is free.
-   A newly created department starts in `LOCKED` state.
-   Normal student/teacher registration and department operations
    require an active department.
-   Subscriptions belong to departments, not institutions.
-   Subscription statuses: `ACTIVE`, `EXPIRED`, `CANCELLED`.
-   Payment statuses: `PENDING`, `SUCCESSFUL`, `FAILED`, `CANCELLED`.

### Department activation flow

`Create Department → LOCKED → Select Plan → Demo Checkout → Payment Successful → Subscription Created → Department ACTIVE`

Payment, subscription creation, and department activation must be
handled transactionally.

## 7. Authority Management

Authority accounts: - Cannot be publicly registered. - Are created only
by the institution. - Require name, email, and an initial password. -
Must have a Firebase account and corresponding PostgreSQL user record. -
Receive initial credentials from the institution. - Must be able to
change/reset their password through Firebase's authentication flow.

The institution can edit, disable, enable, or delete Authority accounts.

## 8. Student Registration and Approval

Required fields: - Institution Code - Official Student ID - Full name -
Email - Phone - Department - Password

Rules: - Institution must exist. - Department must belong to the
institution and be active. - Student ID is unique within the
institution: `(institutionId, studentId)`. - Registration creates/links
Firebase authentication and PostgreSQL records. - Membership starts as
`PENDING`. - Authority approval is required before the student becomes
active.

## 9. Teacher Registration and Approval

Required fields: - Institution Code - Official Teacher/Employee ID -
Full name - Email - Phone - Department - Password

Rules: - Institution must exist. - Department must belong to the
institution and be active. - Teacher ID is unique within the
institution: `(institutionId, teacherId)`. - Registration creates/links
Firebase authentication and PostgreSQL records. - Membership starts as
`PENDING`. - Authority approval is required before the teacher becomes
active.

## 10. Authentication and Authorization

Firebase handles authentication. PostgreSQL is the source of truth for
application users, roles, memberships, institution access, and business
authorization.

Protected request flow:
`Request → Firebase ID Token → Verify Token → firebaseUid → PostgreSQL User → Institution Membership → Role → Status → Authorization`

The backend must determine the user's institution, role, membership,
department, and status. The frontend must never be trusted for
authorization.

## 11. User Profiles and Department Changes

Student and teacher profiles contain: - Name, email, phone - Student ID
or Teacher ID - Institution - Department(s) - Account status

Users may update only allowed profile fields. They cannot directly
modify institution, role, official ID, approval status, or department
membership.

### Student department change

-   Student has one primary department.
-   Student submits a new department and reason.
-   Request starts as `PENDING`.
-   Authority approves or rejects it.
-   On approval, the old department membership becomes inactive and the
    new department becomes the student's active primary department.

### Teacher department change

Teachers may: - Add a department. - Remove a department. - Change
primary department.

All changes require Authority approval.

Department-change request statuses: `PENDING`, `APPROVED`, `REJECTED`,
`CANCELLED`.

Every decision must create an audit log.

## 12. Issue Management

### Categories

-   `CLASSROOM_EQUIPMENT`
-   `WIFI_NETWORKING`
-   `ELECTRICAL`
-   `FURNITURE_INFRASTRUCTURE`
-   `CLEANING_SANITATION`
-   `LAB_EQUIPMENT`
-   `OTHER`

### Priority

`LOW`, `MEDIUM`, `HIGH`, `URGENT`

### Status

`OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`

### Issue data

-   Title and description
-   Category, priority, status
-   Department and location
-   Reporter
-   Audience
-   Resolution summary
-   Created/updated timestamps
-   Archive metadata where applicable

### Audience and visibility

Every issue has an audience: `STUDENT` or `TEACHER`.

  Viewer      Visible issue audience
  ----------- ------------------------
  Student     `STUDENT` only
  Teacher     `TEACHER` only
  Authority   Both

The backend derives audience from the authenticated user's role when an
issue is created. A client-supplied audience must be ignored or
rejected.

### Issue permissions

-   Students create student issues and see student issues.
-   Teachers create teacher issues and see teacher issues.
-   Authority sees and manages both issue audiences.
-   Authority manages the issue lifecycle, notes, resolution, closure,
    and archiving.
-   The source PRD describes limited/relevant reporter actions for
    student/teacher issue management; enforce only explicitly authorized
    actions.

### History, notes, and archive

-   Important status changes are recorded in Issue History.
-   History includes old/new status, actor, note, resolution summary,
    and timestamp.
-   Notes have `INTERNAL` or `PUBLIC` visibility.
-   Internal notes are restricted to authorized institutional users.
-   Public notes may be visible to the relevant reporter/user.
-   Resolved/closed issues can be archived.
-   Archived issues remain stored for historical purposes.

## 13. Notifications

Generate notifications for: - Student/teacher registration approval or
rejection. - Department-change approval or rejection. - Issue status
changes. - New student/teacher registrations for Authority. - New
department-change requests for Authority. - New student/teacher issues
for Authority. - Department activation and payment status for
Institution. - Authority account events for Institution.

## 14. Audit Logs

Record important actions, including: - Institution and department
creation - Department activation - Payment completion - Authority
creation, disabling, and deletion - Student/teacher approval -
Department-change decisions - Issue creation, status changes, and
archiving

Audit log fields: - Actor - Institution - Action - Entity type and
entity ID - Metadata - Timestamp

Audit history must not be silently deleted.

## 15. Multi-Tenant Security and Data Integrity

Mandatory rules: - Institution A must never access Institution B's
data. - Backend authorization is mandatory; frontend hiding is
insufficient. - Validate that issue, department, reporter, membership,
and all related records belong to the same institution. - Validate
department ownership, membership ownership, and subscription/payment
ownership. - Protect administrative endpoints. - Validate API inputs. -
Use environment variables for secrets. - Rate-limit sensitive endpoints
where appropriate. - Prevent unauthorized profile and department
changes. - Enforce unique institution names, student IDs, and teacher
IDs at database level. - Use transactions for critical workflows.

### Required transactional workflows

-   Department activation: payment + subscription + department
    activation.
-   Student approval: membership activation + department membership +
    notification + audit log.
-   Teacher approval: membership activation + department membership +
    notification + audit log.
-   Department-change approval: membership updates + request decision +
    notification + audit log.

## 16. Frontend Pages

### Public

-   `/`
-   `/institution/register`
-   `/student/register`
-   `/teacher/register`
-   `/login`

### Institution

-   `/institution/dashboard`
-   `/institution/departments`
-   `/institution/departments/:id`
-   `/institution/subscriptions`
-   `/institution/payments`
-   `/institution/authorities`
-   `/institution/settings`

### Authority

-   `/authority/dashboard`
-   `/authority/students`
-   `/authority/teachers`
-   `/authority/pending-registrations`
-   `/authority/department-requests`
-   `/authority/issues`
-   `/authority/analytics`
-   `/authority/audit-logs`
-   `/profile`

### Student

-   `/student/dashboard`
-   `/student/issues`
-   `/student/issues/create`
-   `/student/issues/:id`
-   `/student/profile`

### Teacher

-   `/teacher/dashboard`
-   `/teacher/issues`
-   `/teacher/issues/create`
-   `/teacher/issues/:id`
-   `/teacher/profile`

## 17. Dashboards and Analytics

### Student dashboard

Student information, current department, registration status, recent
student issues, issue statistics, pending department-change request,
notifications.

### Teacher dashboard

Teacher information, departments, primary department, recent teacher
issues, issue statistics, pending department-change requests,
notifications.

### Authority dashboard

Total students/teachers, pending students/teachers, all/student/teacher
issue counts, and issue counts by status.

### Institution dashboard

Institution details, department totals/statuses, student/teacher totals,
pending registrations, issue totals by audience, and Authority account
statuses.

### Analytics

-   Student/teacher totals and active/pending counts
-   Department totals and active/locked/expired counts
-   Issue totals by audience and status
-   Issues by category and department

## 18. API Areas

Recommended route groups: - `/api/auth` - `/api/institutions` -
`/api/departments` - `/api/subscriptions` - `/api/payments` -
`/api/authorities` - `/api/students` - `/api/teachers` -
`/api/memberships` - `/api/department-change-requests` - `/api/issues` -
`/api/notifications` - `/api/analytics` - `/api/audit-logs`

## 19. Acceptance Criteria

The MVP is acceptable when: - Duplicate institution registration is
blocked at database level. - Each institution receives a unique
Institution Code. - Departments can be created free and begin locked. -
Demo payment activates a department transactionally. - Institutions can
create and manage Authority accounts. - Authority cannot publicly
register. - Student and teacher registrations require official IDs and
active departments. - IDs are unique within each institution. - Student
and teacher memberships remain pending until Authority approval. -
Profiles enforce field-level restrictions. - Department changes require
Authority approval. - Student and teacher issue visibility is strictly
separated. - Authority can see both issue audiences and manage issue
lifecycle. - Issue history, notes, notifications, and audit logs work. -
Firebase tokens are verified and backend authorization is enforced. -
Cross-tenant access and unauthorized actions are blocked. - No AI or
duplicate-detection functionality is present.
