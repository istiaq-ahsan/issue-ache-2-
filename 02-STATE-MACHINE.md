# Issue Ache! --- State Machines

This document defines the lifecycle states and permitted transitions
described by the PRD. Where the PRD does not define a transition or
edge-case policy, it is marked **Needs decision** rather than assumed.

## 1. Institution Lifecycle

The PRD defines institution registration and uniqueness, but does not
define institution status values or a full institution lifecycle.

``` mermaid
flowchart TD
    A[Institution registration submitted] --> B{Normalized name already exists?}
    B -- Yes --> C[Reject duplicate registration]
    B -- No --> D[Create institution]
    D --> E[Generate unique Institution Code]
    E --> F[Institution dashboard available]
```

**Needs decision:** institution active/suspended/deleted states and who
can change them.

## 2. Department Lifecycle

``` mermaid
stateDiagram-v2
    [*] --> LOCKED: Department created
    LOCKED --> ACTIVE: Successful demo payment and subscription
    ACTIVE --> LOCKED: Institution locks/disables department
    ACTIVE --> EXPIRED: Subscription expires
    EXPIRED --> ACTIVE: New successful subscription/payment
    ACTIVE --> CANCELLED: Subscription cancelled (department effect needs decision)
```

Important constraints: - A newly created department is `LOCKED`. -
Registration and normal department operations require an active
department. - Subscription status and department status are separate
concepts. - The PRD lists subscription statuses `ACTIVE`, `EXPIRED`,
`CANCELLED`; it does not fully define whether cancellation automatically
locks a department.

**Needs decision:** whether a manually locked department can be
reactivated without payment when its subscription remains active; exact
expiration and renewal behavior.

## 3. Payment Lifecycle

``` mermaid
stateDiagram-v2
    [*] --> PENDING: Demo checkout initiated
    PENDING --> SUCCESSFUL: Demo payment succeeds
    PENDING --> FAILED: Demo payment fails
    PENDING --> CANCELLED: Checkout cancelled
```

Only a successful payment may trigger subscription creation and
department activation. Payment + subscription + department activation
must be one database transaction.

**Needs decision:** retry behavior, refund state, and whether
failed/cancelled payment records can be retried or replaced.

## 4. Subscription Lifecycle

``` mermaid
stateDiagram-v2
    [*] --> ACTIVE: Created after successful payment
    ACTIVE --> EXPIRED: Subscription term ends
    ACTIVE --> CANCELLED: Subscription cancelled
```

Subscriptions belong to departments, not institutions.

**Needs decision:** renewal transition, grace period, and whether a
cancelled subscription can be reactivated.

## 5. Student and Teacher Membership Approval

The same approval lifecycle applies to student and teacher memberships.

``` mermaid
stateDiagram-v2
    [*] --> PENDING: Registration submitted
    PENDING --> ACTIVE: Authority approves
    PENDING --> REJECTED: Authority rejects
    ACTIVE --> INACTIVE: Authority deactivates
    INACTIVE --> ACTIVE: Authority activates
```

Rules: - A registration starts as `PENDING`. - A user cannot use normal
role-protected features until approved/active. - Authority can approve,
reject, activate, and deactivate students and teachers.

**Needs decision:** whether a rejected registration can be resubmitted,
whether `REJECTED` is terminal, and whether deactivation can be reversed
after institution/department changes.

## 6. Department Membership Lifecycle

A department membership associates an approved institutional member with
a department.

``` mermaid
stateDiagram-v2
    [*] --> ACTIVE: Created as part of approval or approved change
    ACTIVE --> INACTIVE: Department removed or student changes department
    INACTIVE --> ACTIVE: Re-enabled through an authorized workflow
```

Student constraints: - One primary department at a time. - On approved
department change, old department membership becomes inactive and the
new one becomes active.

Teacher constraints: - May belong to multiple departments. - May request
adding/removing a department or changing primary department. - All
changes require Authority approval.

**Needs decision:** whether a teacher must always have exactly one
primary department and how primary status is reassigned when removing
the current primary department.

## 7. Department Change Request Lifecycle

``` mermaid
stateDiagram-v2
    [*] --> PENDING: Student/teacher submits request
    PENDING --> APPROVED: Authority approves
    PENDING --> REJECTED: Authority rejects
    PENDING --> CANCELLED: Requester cancels (if supported)
```

Request fields include membership, current department, requested
department, reason, status, requester, reviewer, requested time, and
reviewed time.

Every Authority decision must create an audit log. Approval must update
the relevant department memberships and request state transactionally,
with notification and audit log.

**Needs decision:** requester cancellation permissions and handling of
conflicting pending requests.

## 8. Issue Lifecycle

``` mermaid
stateDiagram-v2
    [*] --> OPEN: Issue created
    OPEN --> IN_PROGRESS: Authority starts work
    IN_PROGRESS --> RESOLVED: Authority resolves
    RESOLVED --> CLOSED: Authority closes
```

Issue status values: - `OPEN` - `IN_PROGRESS` - `RESOLVED` - `CLOSED`

The PRD describes this sequence. It does not explicitly define
reopening, direct transitions, or who can move an issue backward.

**Needs decision:** whether reopening is allowed; whether
`OPEN → RESOLVED`, `OPEN → CLOSED`, or `RESOLVED → IN_PROGRESS` are
permitted.

## 9. Issue Archiving

Archiving is an additional lifecycle attribute, not a replacement for
issue status.

-   Resolved or closed issues can be archived.
-   Store `archivedAt`, `archivedById`, and archive reason.
-   Archived issues remain stored for historical purposes.

**Needs decision:** whether only `CLOSED` issues may be archived or
whether `RESOLVED` issues may also be archived (the PRD allows both);
whether archived issues can be unarchived.

## 10. Issue Note Visibility

Notes have one of two visibility values: - `INTERNAL`: restricted to
authorized institutional users. - `PUBLIC`: visible to the relevant
reporter/user where appropriate.

This is a visibility classification, not a lifecycle state.

## 11. Authority Account Lifecycle

The institution creates Authority accounts; public Authority
registration is prohibited.

``` mermaid
stateDiagram-v2
    [*] --> ENABLED: Institution creates account
    ENABLED --> DISABLED: Institution disables account
    DISABLED --> ENABLED: Institution enables account
    ENABLED --> DELETED: Institution deletes account
    DISABLED --> DELETED: Institution deletes account
```

The PRD supports create, view, edit, disable, enable, delete, and
credential management.

**Needs decision:** soft delete versus hard delete, audit retention, and
Firebase account deletion/deactivation behavior.

## 12. Notification Lifecycle

The PRD specifies notification events but not notification read/delivery
states.

**Needs decision:** whether notifications need `UNREAD/READ`, delivery
channels, retry status, expiry, and user preferences.
