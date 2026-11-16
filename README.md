# Issue Ache!

Issue Ache! is a multi-tenant campus issue-management platform. The project is
organized as independently runnable JavaScript applications:

- `client/` — React, Vite, and JSX frontend.
- `server/` — Node.js and Express API.
- `documentation/` — implementation documentation; the six original source
  documents remain unchanged at the repository root.

The frontend includes React Router, Axios, TanStack Query, Firebase email and
password sign-in support, Firebase logout, and a server-backed protected-route
guard. The API verifies Firebase ID tokens, resolves application identities
and institution memberships through PostgreSQL, and provides
`GET /api/auth/me`. institution administrators can register workspaces, view
tenant-protected dashboards, manage departments and institution subscriptions, and
create/manage institution-scoped Authority accounts.

Student and teacher registration, Authority registration review, member
profile/department-change workflows, issue management, notifications, and
read-only audit history are implemented.

## Requirements

- Node.js 20.19+ (Node.js 24 LTS recommended).
- npm.

## Install

In PowerShell, open a terminal at the repository root and run:

```powershell
cd client
Copy-Item .env.example .env
npm install

cd ..\server
Copy-Item .env.example .env
npm install
```

Set the `VITE_FIREBASE_*` values in `client/.env` from the Firebase web app.
Enable the email/password provider in Firebase Authentication. Set
`DATABASE_URL` and `FIREBASE_PROJECT_ID` in `server/.env`. The backend accepts
Firebase Admin service-account values through `FIREBASE_CLIENT_EMAIL` and
`FIREBASE_PRIVATE_KEY`, or uses Application Default Credentials for local
development when those values are omitted. Production requires the complete
service-account configuration; it never falls back to development credentials.
Keep service-account credentials in the backend only; local `.env` files are
ignored by Git.

Institution onboarding uses `GET /api/plans` and
`POST /api/registration/start`. The backend selects prices from its plan
catalog, creates the administrator's Firebase account as disabled, and never
stores the submitted password in PostgreSQL. A Basic trial completes
immediately; other registrations remain pending until the payment provider
verifies payment. Successful completion creates the institution, administrator
link, and subscription transactionally, then enables Firebase sign-in.
`POST /api/payments/:id/callback` processes provider results, while
`GET /api/registration/status/:paymentId` returns checkout status. The legacy
`POST /api/institutions/register` endpoint is disabled.

Institution billing is non-recurring. `GET /api/subscriptions/current` returns
the current subscription and billing history; institution administrators renew
or change plans through `POST /api/subscriptions/renew`. Each successful payment
purchases one term, and a paid plan change starts after any currently valid
term. Expired subscriptions retain all data and allow read-only access and
billing, while write operations return `SUBSCRIPTION_INACTIVE`. A Basic trial
starts without a payment. Department creation and editing are free; deletion is
allowed only when no records or legacy billing history reference the department.
Legacy department subscription and payment records are retained as read-only
history and no longer grant access.

The institution contact email is a separate, globally unique business contact
and may differ from the administrator login. A new staged registration requires
an administrator email that is not already linked to an application account.
The expired-registration cleanup job is exposed at
`GET /api/registration/cleanup-expired` and requires
`Authorization: Bearer <CRON_SECRET>`; configure that secret for Vercel Cron.

Institution administrators manage Authorities at
`/institution/authorities?institutionId=<id>`. Initial email/password
credentials create a Firebase Authentication account and an active PostgreSQL
Authority membership. Passwords are never stored in PostgreSQL; administrators
must deliver the initial password securely. Authority membership deletion is
soft-deleted and audited. Firebase is disabled only when the identity has no
other active institution membership or institution-administrator access.
Authorities can request password-reset emails from the sign-in page through
Firebase Authentication.

Students and teachers can register separately at `/student/register` and
`/teacher/register` using an Institution Code and a department belonging to
that institution.
Their Firebase account and pending membership are created together with an
audit record; registration failures trigger Firebase account cleanup. Active
Authorities review requests at
`/authority/institutions/<institutionId>/pending-registrations`. Approval
records the Authority, activates the membership, creates its primary
department membership, and notifies the applicant transactionally. Rejected
registrations remain terminal, and pending or rejected members cannot access
normal application features.

Active students and teachers can view their profiles at
`/student/profile/<institutionId>` or `/teacher/profile/<institutionId>`.
Only name and phone are editable. Students request a primary department
change; teachers can request department additions, removals, and
primary-department changes. Requests remain pending until an Authority reviews
them in the institution-scoped workspace. Approval applies membership changes
transactionally; decisions are audited and notify the member. A member can
have only one pending department-change request at a time.

Students and teachers can report issues and view issues for their own role
audience at `/student/issues/<institutionId>` and
`/teacher/issues/<institutionId>`. Authorities can filter and manage both
audiences at `/authority/institutions/<institutionId>/issues`. Issue audience
is derived from the verified membership role. Status changes follow only
`OPEN → IN_PROGRESS → RESOLVED → CLOSED`; resolving requires a summary.
Authorities may add internal or public notes and archive resolved or closed
issues. Archived issues remain read-only and cannot be unarchived. Issue
creation, status changes, and archiving write history, audit records, and the
specified notifications transactionally.

Notifications are scoped to the signed-in user and institution at
`/notifications/<institutionId>`. The notification center shows unread counts
and supports marking one or all as read. Institution administrators and
Authorities can view read-only audit history at their workspace audit-log
pages; sensitive credential keys are redacted from metadata returned by the
audit API.

After adding or updating the PostgreSQL schema, deploy its migration from
`server/` before running the API:

```powershell
npm run db:migrate:deploy
```

## Run

Open two terminals from the repository root.

Frontend:

```powershell
cd client
npm run dev
```

Backend:

```powershell
cd server
npm run dev
```

Vite runs at `http://localhost:5173` by default. The API runs at
`http://localhost:5000`; check `http://localhost:5000/api/health` for
`{"status":"ok"}`.

If PowerShell blocks the `npm.ps1` shim due to its execution policy, use
`npm.cmd` in place of `npm` for these commands.

## Build the frontend

```powershell
cd client
npm run build
```

## Configuration

Copy each `.env.example` to `.env` and adjust values for your local setup.
`CLIENT_ORIGIN` accepts a comma-separated list of allowed frontend origins.
The backend derives roles and institution access from PostgreSQL; an
`X-Institution-Id` header or route parameter only selects a tenant context and
is never accepted as proof of access.

## Deployment (Vercel + Supabase + Firebase)

The application has **not** been deployed by this repository setup. Deploy and
verify the frontend and backend as separate Vercel projects before treating
deployment as complete.

### 1. Configure Supabase

1. Use the production Supabase project and take/verify a restorable backup
   before the first production migration.
2. Set `DATABASE_URL` to the Supabase connection-pooler URL appropriate for
   serverless runtime connections.
3. Set `DIRECT_URL` to the direct database connection URL for Prisma migration
   commands. Copy both URLs from the Supabase connection settings and keep
   their credentials private.
4. Ensure the database is reachable from Vercel and that the connection
   settings use the SSL requirements Supabase provides.

Never put either database URL in the client project or in a `VITE_*` variable.

### 2. Deploy the API

Create a Vercel project connected to this repository with **Root Directory**
set to `server/`. Use the Express framework preset (Vercel's Express
zero-configuration entry point is [server/index.js](./server/index.js)); set
the build command to `npm run vercel-build`. The local production start command
is `npm start`; Vercel runs the exported Express application as a function.

Configure these Vercel environment variables for the API deployment (production
and any preview environment you intend to use):

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `CLIENT_ORIGIN` | Comma-separated, exact HTTPS frontend origins; no paths or wildcard domains |
| `DATABASE_URL` | Supabase serverless runtime/pooler URL |
| `DIRECT_URL` | Supabase direct URL, used for migrations |
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | Firebase service-account client email |
| `FIREBASE_PRIVATE_KEY` | Firebase service-account private key; store only as a Vercel secret |
| `PAYMENT_PROVIDER` | `demo` or `sslcommerz` (default: `demo`) |
| `SSLCOMMERZ_STORE_ID` | SSLCommerz store ID; backend only |
| `SSLCOMMERZ_STORE_PASSWORD` | SSLCommerz store password; Vercel secret |
| `SSLCOMMERZ_IS_LIVE` | `true` for live SSLCommerz mode, otherwise `false` |
| `CRON_SECRET` | Bearer secret for protected registration/subscription cleanup jobs |

Vercel's `PORT` is not required for the function entry point. Production startup
fails closed if the database URLs, Firebase Admin credentials, explicit CORS
origins, or production `NODE_ENV` are missing or invalid. Do not define fallback
service-account credentials in the client project.

### 3. Deploy the frontend

Create a second Vercel project for the same repository with **Root Directory**
set to `client/`, framework preset **Vite**, build command `npm run build`, and
output directory `dist`.

Configure these public frontend build variables in that project:

| Variable | Value |
|---|---|
| `VITE_API_BASE_URL` | The deployed API's HTTPS origin followed by `/api`, e.g. `https://api.example.com/api` |
| `VITE_FIREBASE_API_KEY` | Firebase web-app configuration |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase web-app configuration |
| `VITE_FIREBASE_PROJECT_ID` | Firebase web-app configuration |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase web-app configuration |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase web-app configuration |
| `VITE_FIREBASE_APP_ID` | Firebase web-app configuration |

The `VITE_FIREBASE_*` settings are client configuration and will be included
in the frontend bundle; they must never contain service-account credentials.
The Vercel build checks that all required Firebase web settings are present
and that `VITE_API_BASE_URL` is an HTTPS `/api` URL. The client uses localhost
only in development and does not silently fall back to it in production.
`client/vercel.json` sends client-side routes back to the SPA entry point.

### 4. Configure Firebase Authentication

In Firebase Console:

1. Select the same Firebase project configured in both Vercel projects.
2. Enable **Authentication → Sign-in method → Email/Password**.
3. Under **Authentication → Settings → Authorized domains**, add the exact
   deployed frontend domain(s), including the Vercel production domain and any
   custom domain. Add preview domains explicitly if preview sign-in is needed.
4. Verify the app's custom domain is connected to Vercel and served over HTTPS.
5. Create or select a service account with the Firebase Admin permissions this
   API requires. Put its project ID, client email, and private key only in the
   API Vercel project's environment variables. Store multiline private keys
   without sharing them; literal `\n` sequences are also supported.

After adding or changing Vercel environment variables, redeploy so the
production build and functions receive the updated values. CORS origins and
Firebase authorized domains are separate settings; configure both.

### 5. Apply Prisma migrations safely

Do not run `prisma migrate dev` against production and do not run migrations
automatically during a Vercel build. From `server/`, provide the production
`DIRECT_URL` (and `DATABASE_URL`) through a private local environment or the
deployment shell, then inspect and apply checked-in migrations:

```powershell
npm run db:validate
npm run db:migrate:status
npm run db:migrate:deploy
npm run db:migrate:status
```

Confirm the target is the intended Supabase project and that a current backup
is recoverable before applying migrations. `migrate deploy` applies pending
checked-in migrations; it does not create migrations. Never print or paste
database URLs into tickets, chat, logs, or source files.

### 6. Deployment smoke checks

After both projects have deployed:

1. Request `https://<api-domain>/api/health`; verify a successful response.
2. Open the frontend over HTTPS and confirm assets load and client-side routes
   survive refresh.
3. Verify Firebase sign-in, sign-out, and password reset with a test account.
4. Verify the API `/api/auth/me` flow with authenticated test accounts for each
   role and confirm cross-institution requests are denied.
5. Confirm the browser can call the API from the exact production frontend
   origin and that an unapproved origin is not allowed.
6. Confirm Vercel logs contain no credentials or request bodies, and verify
   no database or Firebase Admin values are present in client build assets.

### Deployment checklist

- [ ] Two Vercel projects use `client/` and `server/` as their respective roots.
- [ ] Frontend build variables include the HTTPS API URL and Firebase web config.
- [ ] Backend variables include production `NODE_ENV`, exact CORS origins,
      Supabase URLs, and Firebase Admin service-account credentials.
- [ ] No `.env` files, database URLs, or Firebase Admin private keys are tracked
      or included in frontend variables.
- [ ] Firebase Email/Password is enabled and deployed frontend domains are
      authorized.
- [ ] Supabase backup and connection settings are verified.
- [ ] Prisma migrations are validated, reviewed, and applied with
      `migrate deploy`; migration status is clean.
- [ ] API health endpoint returns successfully over HTTPS.
- [ ] Frontend, Firebase login, protected role routes, tenant boundaries, and
      API CORS are smoke-tested against the deployed services.
- [ ] Vercel production logs and client build output have been checked for
      secrets.
- [ ] Deployment is considered complete only after the above checks pass on
      the actual deployed domains.
