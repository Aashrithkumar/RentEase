# Verification — 14 October 2026

## Passed

- `npm run build`: backend and frontend TypeScript checks and Vite production bundle.
- Backend reorganization: separate config, controllers, middleware, models and routes verified by TypeScript compilation and all 26 existing integration tests. All 62 feature route paths were retained, scripts were updated, and obsolete compiled files are removed by the backend build.
- `npm test`: 26 integration tests using an isolated temporary MongoDB replica set; no Atlas test records. Admin checks include role restrictions, server-side user search, suspension and session revocation, listing visibility, active-tenancy protection, archive/history preservation and audit records.
- MongoDB Atlas read-only connection check with process-local DNS resolver.
- API health: HTTP 200, database connected.
- Frontend-to-backend proxy: HTTP 200 for the public property endpoint.
- Cloudinary authentication, public image upload/retrieval, authenticated private PDF upload and expiring signed retrieval. All temporary Cloudinary verification resources were deleted.
- Live browser desktop homepage rendering.
- Live browser mobile homepage at a 390 px viewport, with no document horizontal overflow.
- Mobile search navigation and URL synchronization, filters opening, city/bedroom selection and genuine empty state from the live database.
- Anonymous access to the protected workspace redirected to login with the return path.
- Dedicated `/admin` panel: demo administrator login and overview verified against Atlas. A signed-in tenant was denied access. User search, linked-user details, listing search/pagination and the moderation reason/confirmation dialog were verified in the browser. The dialog was dismissed without changing live listings.
- Mobile administration was checked at 390 px; the document had no horizontal overflow and wide tables scroll within their own container. Desktop navigation was checked at 1280 px. Search input resets correctly between user and listing management.

## Limits and pending configuration

- After the user explicitly confirmed the development database and approved insertion, the seed script added 17 labelled demo properties, three random-password demo accounts and linked rental records to Atlas. Initial approval review had blocked insertion before that confirmation.
- Sixteen available demo listings now appear in the public catalogue; the seventeenth is occupied by the demo tenant. Account passwords are in the ignored local `demo-credentials.txt` file.
- SMTP sending has not been tested because no SMTP provider credentials were supplied. Development outbox support is implemented.
- Docker/Cloud Run/Vercel deployment is configured but has not been executed.
- Demo owner and tenant login, dashboards and rent-history screens were verified in the live browser against Atlas. The owner dashboard displayed 17 properties, 16 available, one occupied, and finance charts calculated from seeded records. The tenant saw the linked home, lease, pending application, maintenance count and outstanding balance. Workflow APIs also passed in the isolated test database.
- The UI adapts the 99acres public search structure to RentEase's rental scope and branding; it is not an exact reproduction of every 99acres screen.

The temporary mobile viewport override is reset after QA. Runtime secrets remain in ignored backend configuration.
