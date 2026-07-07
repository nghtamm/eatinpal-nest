# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EatinPal — NestJS backend for a Vietnamese calorie/nutrition tracking Flutter app (Android + iOS only, tương tự MyFitnessPal).

### Product Features

- **Auth:** Email/password login (implemented), Google/Apple OAuth (planned)
- **User profile:** Giới tính, ngày sinh, chiều cao, cân nặng, mức độ vận động, mục tiêu (lose/maintain/gain), timezone — dùng để tính TDEE và đề xuất nutrition goals
- **Nutrition goals:** Mục tiêu calories/protein/fat/carbs hàng ngày, có thể tự custom hoặc tính tự động từ profile
- **Weight log:** Lịch sử cân nặng theo ngày, theo dõi tiến trình
- **Daily tracking:** Schedule 7 ngày/tuần + schedule theo tháng để user theo dõi đã tracking hay chưa, chi tiết từng ngày (bao nhiêu bữa, mỗi bữa gồm gì, calories, dinh dưỡng)
- **Meals:** Mỗi ngày 3 meal mặc định (sáng, trưa, tối) + user có thể add thêm meal
- **Meal entries:** 2 cách thêm món: (1) search từ food database (data crawl sẵn) hoặc (2) tạo custom meal chọn từng thành phần + định lượng → tính toán dinh dưỡng/calories
- **Planned:** Scan barcode + chụp ảnh dùng AI API để map vào custom meal, push notification

### Current Progress

Auth module implemented, food/meal domain entities and seeds exist, tracking features are next.

## Commands

```bash
yarn start:dev              # Dev server with watch mode (port 3000)
yarn build                  # Compile TypeScript to dist/
yarn lint                   # ESLint with auto-fix
yarn format                 # Prettier (src/ and test/)

yarn test                   # Unit tests (Jest, *.spec.ts in src/)
yarn test:watch             # Unit tests in watch mode
yarn test:cov               # Unit tests with coverage
yarn test:e2e               # E2E tests (test/e2e/*.e2e-spec.ts)

yarn migration:generate     # Generate TypeORM migration from entity changes
yarn migration:run          # Run pending migrations
yarn migration:revert       # Revert last migration
yarn seed:food              # Seed food data from eatinpal-crawler package
```

Docker: `docker compose up -d` starts PostgreSQL 18 on port 5432.

## Architecture

### Global Pipeline (registered in `app.module.ts`)

Every request flows through these global providers:
1. **ThrottlerGuard** — rate limiting (3/s, 20/10s, 60/min); override per-route with `@Throttle()`, skip with `@SkipThrottle()`
2. **JwtAuthGuard** — all routes require JWT by default; use `@Public()` decorator to opt out
3. **TimeoutInterceptor** — 10s server-side timeout; override per-route with `@UseInterceptors(new TimeoutInterceptor(ms))`
4. **LoggingInterceptor** — Pino-based request/response logging (redacts auth headers, passwords, tokens)
5. **ValidationPipe** — `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`
6. **ResponseInterceptor** — wraps success responses as `{status_code, message, data, metadata?}` with snake_case keys
7. **HttpExceptionFilter** — formats errors as `{status_code, message, errors?}`

### DTO Serialization

Use `@Serialize(DtoClass)` decorator on routes to transform responses via `class-transformer`. The `SerializeInterceptor` runs `plainToInstance(dto, data, { excludeExtraneousValues: true })`, then `ResponseInterceptor` wraps the result. DTO fields must have `@Expose()` to be included. Use `@Expose({ name: 'sourceKey' })` to map from a different source property name.

### Module Organization

- `src/modules/auth/` — Passport strategies (local + jwt + jwt-refresh), access/refresh token rotation, register/login/refresh/logout
- `src/modules/users/` — User CRUD (service with findOneByEmail/findOneByID/create with transaction)
- `src/database/` — TypeORM DataSource, food/meal domain entities, migrations, seeds
- `src/modules/email/` — AWS SES email service (Phase 1: verification emails)
- `src/common/` — shared decorators (`@Public()`, `@Serialize()`), guards, interceptors, filters, utils, enums
- `src/config/` — JWT config and Pino logger config

### Entity Layout

Entities are split across two locations:
- **`src/database/entities/`** — food/meal domain (FoodItem, FoodCategory, Nutrient, ServingSize, DailyLog, Meal, MealEntry, CustomMealEntry) — registered in `DatabaseModule`
- **`src/modules/*/entities/`** — user/auth domain (User, UserProfile, NutritionGoal, WeightLog, RefreshToken, UserAuthProvider) — registered in their respective modules

Both paths are scanned by the TypeORM DataSource in `src/database/data-source.ts`.

### Key Patterns

- **Dual ID:** All entities expose a public `uuid` (UUIDv7 via `uuidv7()` PostgreSQL function) and an internal integer `id` for joins
- **Snake case everywhere in DB:** `SnakeNamingStrategy` auto-converts TypeScript camelCase to snake_case columns; `ResponseInterceptor` converts response keys to snake_case
- **Bilingual fields:** `nameVI`/`nameEN` on food/category/nutrient entities (Vietnamese-first)
- **Auth flow:** Access token (15m default) + refresh token (7d), refresh tokens stored hashed (SHA-256) in DB, revoked via `revokedAt`. Three strategies: `local` (email/password), `jwt` (access token), `jwt-refresh` (refresh token from body field)
- **`@Public()` decorator** on `src/common/decorators/public.decorator.ts` — sets metadata to bypass global JwtAuthGuard
- **`@GetUser(field?)`** param decorator on `src/modules/auth/decorators/user.decorator.ts` — extracts user from request
- **Transactional user creation** — `UsersService.create()` wraps User + UserAuthProvider in `DataSource.transaction()`
- **Cryptography utils** in `src/common/utils/cryptography.util.ts` — bcrypt (12 rounds) for passwords, SHA-256 for refresh tokens

### Message Convention

All user-facing messages (exceptions, DTOs, success responses) follow these rules:
- No trailing punctuation (no `.` or `!`)
- First letter capitalized
- Designed for client-side toast/snackbar display and future localization

### Environment

Copy `.env.example` to `.env`. Required vars: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`, `JWT_RF_SECRET`. Optional: `JWT_EXPIRATION` (default 900s), `JWT_RF_EXPIRATION` (default 7d), `NODE_ENV`.

**AWS SES (Phase 1 — Email Verification):** `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `SES_FROM_EMAIL` (e.g., `noreply@eatinpal.com`), `JWT_EMAIL_SECRET`, `JWT_EMAIL_EXPIRATION` (e.g., `86400s`).

### TypeScript

- `module: "nodenext"` with `moduleResolution: "nodenext"`
- `strictNullChecks: true`, `noImplicitAny: false`
- `emitDecoratorMetadata` + `experimentalDecorators` enabled for NestJS DI
- Use relative imports only (no `src/...` absolute paths)

### Database

- PostgreSQL with `pg_trgm` extension for GIN trigram indexes on food item names
- Migrations only (`synchronize: false`) — never enable synchronize
- Seeder uses `eatinpal-crawler` private package for food data
