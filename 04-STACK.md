# Issue Ache! --- Technology Stack

## 1. Stack Summary

  Layer            Technology                  Required language
  ---------------- --------------------------- ----------------------------
  Frontend         React + Vite                JavaScript + JSX
  Styling          Tailwind CSS, shadcn/ui     CSS / JSX
  Animation        Framer Motion, GSAP         JavaScript
  Routing          React Router                JavaScript
  HTTP             Axios                       JavaScript
  Server state     TanStack Query              JavaScript
  Forms            React Hook Form + Zod       JavaScript
  Feedback         Sonner, SweetAlert2         JavaScript
  Icons            Lucide React,Phosphor Icons JavaScript
  Authentication   Firebase Authentication     JavaScript
  Backend          Node.js + Express.js        JavaScript
  ORM              Prisma                      Prisma Schema + JavaScript
  Database         PostgreSQL on Supabase      SQL via Prisma
  Payment          Demo/simulated payment      JavaScript backend logic

## 2. Non-Negotiable Language Rule

TypeScript is not used.

-   Frontend source: `.jsx`, `.js`
-   Backend source: `.js`
-   Do not create `.ts` or `.tsx` files.
-   Prisma schema remains `schema.prisma`.

## 3. Frontend Responsibilities

-   Render public, institution, Authority, student, and teacher pages.
-   Use React Router for route organization and protected route
    presentation.
-   Use Firebase client SDK for sign-in, sign-up, sign-out, and password
    reset.
-   Send Firebase ID tokens to the Express API.
-   Use Axios for API communication.
-   Use TanStack Query for server-state caching, loading, refetching,
    and mutations.
-   Use React Hook Form and Zod for form handling and client-side
    validation.
-   Use shadcn/ui and Tailwind for consistent components and styling.

Frontend route guards improve user experience only. They are not
security boundaries.

## 4. Backend Responsibilities

-   Verify Firebase ID tokens using Firebase Admin SDK.
-   Resolve `firebaseUid` to the PostgreSQL user.
-   Determine institution membership, role, account status, and
    department access.
-   Enforce tenant isolation and resource ownership.
-   Validate all request bodies and parameters.
-   Execute business workflows and database transactions.
-   Generate notifications and audit records.
-   Expose REST API route groups defined in the PRD.

## 5. Database Responsibilities

PostgreSQL is the authoritative store for: - Institutions and
Institution Codes - Users and roles - Institution memberships -
Departments and department memberships - Department-change requests -
Subscriptions and payments - Issues, history, notes, and archive
metadata - Notifications and audit logs

Firebase is not the source of application roles or tenant authorization.

## 6. Firebase Setup

Use: - Firebase client SDK in the frontend. - Firebase Admin SDK in the
backend. - Email/password provider. - ID-token verification for
protected API requests.

The backend should receive the ID token in an Authorization Bearer
header. Never trust a role, institution ID, or Firebase UID supplied as
an authorization claim by the frontend without verifying and resolving
it server-side.

Keep Firebase service-account credentials and other secrets in backend
environment variables. Frontend Firebase configuration values may be
exposed as client configuration; they are not a substitute for backend
security.

## 7. Suggested Repository Structure

``` text
campus-intelligence/
├── frontend/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── context/
│   │   ├── firebase/
│   │   ├── hooks/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── utils/
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
│
├── backend/
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── repositories/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── validators/
│   │   ├── utils/
│   │   └── server.js
│   └── package.json
│
└── README.md
```

## 8. Backend Middleware

Recommended middleware: - `requireAuth()` --- verify Firebase token and
resolve local user. - `requireRole()` --- enforce allowed application
role(s). - `requireInstitutionAccess()` --- ensure the request is scoped
to the authenticated institution. - `requireDepartmentAccess()` ---
validate department membership/ownership. - `requireActiveDepartment()`
--- enforce department activation rules.

Middleware must use database-resolved identity and membership data.

## 9. API Route Groups

``` text
/api/auth
/api/institutions
/api/departments
/api/subscriptions
/api/payments
/api/authorities
/api/students
/api/teachers
/api/memberships
/api/department-change-requests
/api/issues
/api/notifications
/api/analytics
/api/audit-logs
```

## 10. Environment Variables

### Frontend example

``` env
VITE_API_BASE_URL=
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

### Backend example

``` env
PORT=5000
DATABASE_URL=
DIRECT_URL=
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
CLIENT_ORIGIN=
NODE_ENV=development
```

Use the exact environment-variable names consistently in code and
deployment configuration. Never commit secrets.

## 11. Important Implementation Rules

-   Use Prisma transactions for multi-record workflows.
-   Add database constraints for uniqueness and referential integrity.
-   Do not use frontend role checks as authorization.
-   Scope all tenant-owned queries by the authenticated institution.
-   Validate that related records share the same institution.
-   Avoid returning sensitive account or credential data in API
    responses.
-   Handle Firebase account creation/deletion failures and PostgreSQL
    consistency explicitly.
-   Use rate limits for registration, login-adjacent, and other
    sensitive endpoints as appropriate.
