# RentEase

MERN rental property management with a 99acres-inspired public search interface, RentEase branding, and owner, tenant and administrator workspaces. The design follows the photo banner, overlaid navigation, tabbed search and exploration cards, adapted to rental workflows. It is not an exact reproduction of every 99acres page.

Live website: **https://rentease-aashrithkumar.vercel.app**. The administration panel is at **https://rentease-aashrithkumar.vercel.app/admin**. The API runs on Render at **https://rentease-api-xay8.onrender.com**. See the [deployment guide](docs/DEPLOYMENT.md) for hosting settings and future updates.

## Run in VS Code

1. Select **File → Open Folder** and open `RentEase1`.
2. Choose **Terminal → New Terminal** at the project root, where the main `package.json` is located.
3. On a fresh machine, install Node.js 22 LTS or newer and run `npm install`.
4. Run `npm run dev`.
5. Open **http://localhost:5173**. The API uses **http://localhost:5000**.

```powershell
npm install
npm run dev
```

Dependencies are already installed in this workspace. Use Ctrl+C to stop. If port 5173 or 5000 is in use, stop the previous RentEase terminal first. To start one service separately use `npm run dev -w frontend` or `npm run dev -w backend`.

## Configuration

Supplied MongoDB and Cloudinary credentials are configured in the ignored `backend/.env`. The frontend never receives them. Example settings are in the two `.env.example` files. The development frontend proxies `/api` to port 5000.

This machine's default DNS resolver refused Atlas SRV lookups. `MONGO_DNS_SERVERS=1.1.1.1,8.8.8.8` configures a process-local backend resolver without changing Windows. Remove it on networks that resolve Atlas normally. If connection still fails, check Atlas network access and database-user permissions.

The supplied `JWT_SECRET=your_secret_key` works for local development. Production rejects weak secrets. Replace shared credentials and use a random JWT secret before public deployment.

## Demo data

`npm run seed` adds labelled sample properties across Bengaluru, Hyderabad, Pune and Chennai, random-password demo accounts, applications, a lease, rent obligations, manual receipts, maintenance, expenses and notifications. It preserves existing records, avoids duplicate demo runs and refuses production. Run only against a confirmed development database. Generated credentials are written to the ignored `demo-credentials.txt` file and never printed. Demo listings are not real rental offers. Register normal accounts for real use.

## Workflows

### Administration panel

Open **http://localhost:5173/admin** and sign in as an administrator. The existing development demo administrator email is `admin@demo.rentease.local`; its generated password is in the ignored `demo-credentials.txt` file. Normal owners and tenants cannot access this panel. For a fresh non-demo administrator, use the operator bootstrap script described in the deployment guide.

The panel provides live platform statistics, account search with role/access filters, user activity summaries, suspension/reactivation, property review and hide/restore/archive controls, a read-only rental activity view, platform analytics, notifications, account settings and an administrative audit trail. Searches and filters are server-side and results are paginated. Admin changes record their actor, target, reason, previous value and new value in a transaction.

Hidden listings leave public search and cannot receive new rental applications. Hiding does not change occupancy or terminate leases. Owner edits cannot override administrator visibility controls. Archiving is blocked while a property has an active lease; no financial or lease records are deleted. Suspended users immediately lose access and old sessions stay revoked after reactivation. Administrator accounts cannot be suspended from this panel.

### Rental workflows

- Public search: city/locality, type, budget, bedrooms, bathrooms, amenities, sorting and pagination; filters are synchronized with the URL.
- Accounts: registration, login/logout, profile, password change and reset, 15-minute JWTs kept in memory, rotating HttpOnly refresh cookies, secure reset tokens and role checks.
- Properties: owner-only creation, edit and archive, Cloudinary photos, availability linked to active leases.
- Applications: tenant submission/withdrawal, duplicate prevention, owner review and approval without premature occupancy changes.
- Leases: create from an approved application, activation, termination, conflict prevention and private PDF attachments.
- Finance: monthly obligations, integer paise, partial manual receipts, overpayment prevention, auditable payment history. No money is transferred by the app.
- Maintenance: requests tied to tenant active leases, owner status/resolution updates and persisted notifications.
- Expenses: owner records, editing, archive and private PDF receipts. Tenant/owner relationships derive from leases.
- Dashboards: database-backed statistics and charts, empty/loading/error states, notifications, account settings and administrator moderation.
- Email: development outbox or optional SMTP, reusable templates, graceful failure handling and an authenticated idempotent reminder endpoint.

## Business conventions

Dates display in Indian format and Asia/Kolkata time. Each calendar month covered by an active lease incurs the full monthly rent; there is no automatic proration. A partial first month is due on the start date. A lease spans at most five years. Future leases start Pending and must be activated when their dates include today. Only one active lease per property is allowed. Approval alone does not change occupancy. Legal and payment history is preserved when a lease ends; untouched future obligations are cancelled, not deleted. Normal expense deletion archives the record.

Property images are public. PDF lease documents and receipts are private and accessed through authorized 60-second links. Catalogue images in the optional seed are illustrative external photos. Saved-property IDs live in this browser; authentication tokens do not.

## Validation

```powershell
npm test
npm run build
```

Tests use an isolated disposable MongoDB replica set, never the configured Atlas database. The first test run downloads MongoDB's official binary into an ignored workspace cache. Tests cover privilege escalation, refresh rotation/replay, resource ownership, private-data boundaries, application duplicates, lease consistency, partial payments, maintenance, expenses, notifications and history rules.

Build outputs are `frontend/dist` and `backend/dist`. The project includes `render.yaml` for the Render API and `frontend/vercel.json` plus `npm run build:vercel -w frontend` for the Vercel frontend. Set `RENDER_API_URL` on Vercel and the exact frontend HTTPS origin as `FRONTEND_URL` on Render. See the [step-by-step deployment guide](docs/DEPLOYMENT.md) and [verification](docs/VERIFICATION.md). Actual publishing and SMTP delivery require the destination accounts and settings.

## Architecture

`frontend/src` contains React pages, shared components, typed API helpers, auth context and responsive styles. `backend/src` is organized into `config`, `controllers`, `middleware`, `models`, and `routes`, with supporting `services`, `utils`, `scripts`, and `tests` folders. `app.ts` assembles Express and `server.ts` starts the API. See the [backend structure guide](docs/BACKEND_STRUCTURE.md) for the folder tree and request flow. APIs use `/api/v1` with `{ success, data }` responses or `{ success: false, message }` errors.

`User` is the identity record. `Property` references its owner. `RentalApplication` references property, owner and tenant. `Lease` references the approved application and both users. `RentObligation` has a unique lease/month key. `Payment` references the obligation and stores immutable receipt metadata. `MaintenanceRequest` references an active lease and both users. `Expense` belongs to owner/property. `Notification`, `RefreshToken` and `PasswordResetToken` belong to users. Transactions protect multi-document changes; unique indexes prevent duplicate active applications, active lease conflicts and duplicate monthly obligations.

`AuditLog` records administrator actions and has no edit/delete API. Property moderation visibility is stored separately from availability and occupancy. Admin endpoints are under `/api/v1/admin`: `overview`, `users`, `users/:id`, `users/:id/status`, `properties`, `properties/:id`, `properties/:id/moderation`, `activity` and `audit`.
