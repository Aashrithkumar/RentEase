# Backend structure

The backend uses separate folders for configuration, request handlers, middleware, database models and route declarations. Existing API URLs, model names, validation rules and environment settings are preserved.

```text
backend/
├── scripts/
│   └── build.mjs                 # Clean, compile and check TypeScript
├── src/
│   ├── config/
│   │   ├── env.ts                # Environment loading and validation
│   │   ├── database.ts           # MongoDB connection and transactions
│   │   ├── cloudinary.ts         # Configured media storage client
│   │   └── cors.ts               # Allowed frontend origins
│   ├── controllers/              # Request processing, one module per feature
│   │   ├── auth.controller.ts
│   │   ├── property.controller.ts
│   │   ├── application.controller.ts
│   │   ├── lease.controller.ts
│   │   ├── tenant.controller.ts
│   │   ├── rent-obligation.controller.ts
│   │   ├── payment.controller.ts
│   │   ├── maintenance.controller.ts
│   │   ├── expense.controller.ts
│   │   ├── notification.controller.ts
│   │   ├── analytics.controller.ts
│   │   ├── admin.controller.ts
│   │   ├── scheduler.controller.ts
│   │   └── health.controller.ts
│   ├── middleware/
│   │   ├── auth.middleware.ts    # JWT, role and record access checks
│   │   ├── validation.middleware.ts
│   │   ├── upload.middleware.ts  # Multer limits and accepted image types
│   │   ├── rate-limit.middleware.ts
│   │   ├── security.middleware.ts
│   │   ├── database.middleware.ts
│   │   └── error.middleware.ts
│   ├── models/                   # One Mongoose model per file
│   │   ├── User.model.ts
│   │   ├── Property.model.ts
│   │   ├── RentalApplication.model.ts
│   │   ├── Lease.model.ts
│   │   ├── RentObligation.model.ts
│   │   ├── Payment.model.ts
│   │   ├── MaintenanceRequest.model.ts
│   │   ├── Expense.model.ts
│   │   ├── Notification.model.ts
│   │   ├── RefreshToken.model.ts
│   │   ├── PasswordResetToken.model.ts
│   │   ├── AuditLog.model.ts
│   │   ├── schema.helpers.ts
│   │   └── index.ts              # Named model exports
│   ├── routes/                   # URLs and middleware, no inline handlers
│   │   ├── index.ts              # Mounts every /api/v1 feature router
│   │   └── *.routes.ts
│   ├── services/                 # Reusable email, storage and rental logic
│   │   ├── email.service.ts
│   │   ├── notification.service.ts
│   │   ├── storage.service.ts
│   │   ├── rent.service.ts
│   │   └── record.service.ts
│   ├── utils/                    # Response helpers, tokens and input schemas
│   ├── scripts/                  # Seed, admin bootstrap and service diagnostics
│   ├── tests/
│   │   └── app.test.ts
│   ├── app.ts                    # Express setup and application middleware
│   └── server.ts                 # Start listening, connect DB, graceful shutdown
├── .env                          # Private configuration; ignored by Git
├── .env.example
├── package.json
├── tsconfig.json
└── Dockerfile
```

## Request flow

`app.ts` configures security headers, CORS, JSON/cookies, origin checks and rate limits. `routes/index.ts` mounts the versioned API. Feature route files select the handler and its authorization/upload middleware. Controllers validate inputs, use models and reusable services, and return the existing response format. Errors flow into the shared error middleware.

Public authentication, property browsing, admin and scheduler routers retain their original authentication rules. Rental and analytics routers run behind the common authentication middleware. The health endpoint stays at `/api/health`. All 62 feature endpoint paths are preserved under `/api/v1`.

## Commands

The usual commands remain the same:

```powershell
npm run dev
npm run build
npm test
npm run seed
npm run create-admin -w backend
```

Optional diagnostics use `npm run check-db -w backend` and `npm run check-storage -w backend`. The storage diagnostic creates and deletes its temporary verification files; it is not part of a normal build or test run.

The backend build cleans only its verified `backend/dist` directory before compiling, so obsolete compiled files from the former flat layout do not remain in deployment artifacts. The Docker build copies the build helper alongside the source.

## Making changes

- Add an endpoint to its feature route file and implement its handler in the matching controller.
- Keep authentication, authorization, upload limits and shared error handling in middleware.
- Keep environment and service-client initialization in config.
- Put database schemas and indexes in the matching model file; export new models from `models/index.ts`.
- Place logic shared by controllers and scripts in services, rather than importing a controller from a script.
- Keep integration tests in `src/tests`; they use the isolated local MongoDB replica set.
