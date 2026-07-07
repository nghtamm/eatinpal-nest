# EatinPal Backend — Development Roadmap

## Context

User is a backend beginner learning NestJS while building EatinPal (calorie tracking app). Auth module is done, all entities exist but most have NO API endpoints. This plan orders features from easy→hard to help learn progressively. AWS SES email verification is prioritized first per user request.

---

## Phase 1 — Email Verification (AWS SES)

**Học được:** Tích hợp SDK bên thứ 3, gửi email, JWT cho mục đích đặc biệt, mở rộng auth flow

**Install:** `yarn add @aws-sdk/client-sesv2`

**Flow:**
```
Register → gửi email verification (JWT 24h) → user click link → GET /auth/verify-email?token=xxx → emailVerified = true
```

**Token strategy:** Dùng JWT với secret riêng (`JWT_EMAIL_SECRET`), claim `{ sub: userId, purpose: 'email-verification' }`, expire 24h. Không cần thêm column DB vì `emailVerified` đã có trên `User` entity.

**Env vars mới** (thêm vào `.env.example`):
- `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- `SES_FROM_EMAIL` (e.g., `noreply@eatinpal.com`)
- `JWT_EMAIL_SECRET`, `JWT_EMAIL_EXPIRATION` (e.g., `86400s`)

**Endpoints mới:**
- `GET /auth/verify-email?token=xxx` — `@Public()`, verify JWT, set `emailVerified = true`
- `POST /auth/resend-verification` — `@Public()`, body `{ email }`, gửi lại email

**Files tạo mới:**
- `src/modules/email/email.module.ts` — wrap `SESv2Client`
- `src/modules/email/email.service.ts` — method `sendVerificationEmail(to, token)`
- `src/modules/auth/dto/resend-verification.dto.ts` — `{ email: string }`

**Files sửa:**
- `src/config/jwt.config.ts` — thêm `jwt_email_secret`, `jwt_email_expiration`
- `src/modules/auth/auth.service.ts` — thêm `sendVerificationEmail()`, `verifyEmail()`, `resendVerification()`; chặn login nếu chưa verify
- `src/modules/auth/auth.controller.ts` — thêm 2 endpoints trên
- `src/modules/auth/auth.module.ts` — import `EmailModule`
- `.env.example` — thêm AWS + email vars

**Xử lý unverified users:** Block login — trong `validateLocal()` check `emailVerified`, throw `ForbiddenException('Please verify your email')` nếu chưa verify.

---

## Phase 2 — User Profile CRUD

**Học được:** GET/PATCH pattern, `@IsOptional()`, partial update, get-or-create pattern

**Endpoints:**
- `GET /users/me/profile` — trả profile (tạo mới nếu chưa có)
- `PATCH /users/me/profile` — partial update

**Files tạo mới:**
- `src/modules/users/dto/update-profile.dto.ts` — tất cả fields optional: `gender?`, `dateOfBirth?`, `heightCm?`, `weightKg?`, `activityLevel?`, `goal?`, `timezone?`
- `src/modules/users/dto/response/profile-response.dto.ts`

**Files sửa:**
- `src/modules/users/users.service.ts` — thêm `getOrCreateProfile(userID)`, `updateProfile(userID, dto)`
- `src/modules/users/users.controller.ts` — thêm 2 endpoints

---

## Phase 3 — Weight Log CRUD

**Học được:** Collection CRUD, date filtering với `Between()`, upsert pattern, query params DTO, pagination

**Endpoints:**
- `GET /users/me/weight-logs?from=YYYY-MM-DD&to=YYYY-MM-DD` — list có filter
- `POST /users/me/weight-logs` — log cân nặng (upsert theo ngày)
- `DELETE /users/me/weight-logs/:date` — xoá log theo ngày

**Files tạo mới:**
- `src/modules/users/dto/create-weight-log.dto.ts` — `{ weightKg, loggedAt, note? }`
- `src/modules/users/dto/weight-log-query.dto.ts` — `{ from?, to? }` với `@IsOptional() @IsDateString()`

**Files sửa:**
- `src/modules/users/users.service.ts` — thêm `getWeightLogs()`, `upsertWeightLog()`, `deleteWeightLog()`
- `src/modules/users/users.controller.ts` — thêm 3 endpoints

---

## Phase 4 — Nutrition Goal (auto-calculation)

**Học được:** Business logic (BMR/TDEE), one-to-one owned resource, inter-service calls

**Endpoints:**
- `GET /users/me/nutrition-goal` — trả goal hiện tại (tạo mới nếu chưa có)
- `PUT /users/me/nutrition-goal` — set custom goal (`isCustom = true`)
- `POST /users/me/nutrition-goal/recalculate` — tính lại từ profile (`isCustom = false`)

**BMR (Mifflin-St Jeor):**
```
Male:   10 * weight(kg) + 6.25 * height(cm) - 5 * age + 5
Female: 10 * weight(kg) + 6.25 * height(cm) - 5 * age - 161
```
TDEE = BMR × activity multiplier. Goal: lose = TDEE-500, maintain = TDEE, gain = TDEE+300

**Files tạo mới:**
- `src/modules/users/dto/set-nutrition-goal.dto.ts` — `{ calories, protein?, fat?, carbs? }`
- `src/modules/users/dto/response/nutrition-goal-response.dto.ts`

**Files sửa:**
- `src/modules/users/users.service.ts` — thêm `getNutritionGoal()`, `setCustomGoal()`, `recalculateGoal()`, private `calculateTDEE()`

---

## Phase 5 — Food Search API (read-only)

**Học được:** QueryBuilder, `pg_trgm` search, pagination với metadata, read-only module

**Endpoints (tất cả `@Public()`):**
- `GET /food/search?q=pho&page=1&limit=20&type=dish` — search food items
- `GET /food/:uuid` — chi tiết food item + nutrients + serving sizes
- `GET /food/categories` — list categories

**Files tạo mới:**
- `src/modules/food/food.module.ts`
- `src/modules/food/food.controller.ts`
- `src/modules/food/food.service.ts` — dùng QueryBuilder + `ILIKE` trên `name_vi`, `name_en`, `name_ascii`
- `src/modules/food/dto/food-search-query.dto.ts`
- `src/modules/food/dto/response/food-list-response.dto.ts`
- `src/modules/food/dto/response/food-detail-response.dto.ts`

**Files sửa:**
- `src/app.module.ts` — import `FoodModule`

**Response metadata:** `{ total, page, limit, totalPages }` — dùng `findAndCount()` hoặc `getManyAndCount()`

---

## Phase 6 — GET /users/me (aggregate endpoint)

**Học được:** Aggregate nhiều relations vào 1 response, nested DTO serialization

**Endpoint:**
- `GET /users/me` — trả user + profile + nutritionGoal (data cho home screen)

**Files sửa:**
- `src/modules/users/users.controller.ts` — thêm endpoint
- `src/modules/users/users.service.ts` — thêm `findMeWithRelations(userID)` dùng `findOne({ relations: ['profile', 'nutritionGoal'] })`

**Files tạo mới:**
- `src/modules/users/dto/response/me-response.dto.ts` — nested `@Type(() => ProfileDTO)` + `@Type(() => GoalDTO)`

---

## Phase 7 — Daily Log + Meal Tracking (core feature)

**Học được:** Nested resource design, complex joins, aggregate nutrition calculation, transaction, entity graph

**Entity graph:**
```
DailyLog → Meal[] → MealEntry[] → FoodItem? + ServingSize? + CustomMealEntry?
```

### Phase 7A — Daily Log + Meals
**Endpoints:**
- `GET /logs/:date` — get-or-create DailyLog với meals + entries + nutrition totals
- `GET /logs?from=&to=` — list logs summary
- `POST /logs/:date/meals` — thêm meal
- `PATCH /logs/:date/meals/:mealUUID` — rename/reorder
- `DELETE /logs/:date/meals/:mealUUID` — xoá meal (cascade entries)

### Phase 7B — Meal Entries
**Endpoints:**
- `POST /logs/:date/meals/:mealUUID/entries` — thêm food vào meal
- `PATCH /logs/:date/meals/:mealUUID/entries/:id` — cập nhật quantity
- `DELETE /logs/:date/meals/:mealUUID/entries/:id` — xoá entry

**Nutrition totals:** Tính từ FoodItemNutrient (kcal/100g × quantityGrams/100) hoặc CustomMealEntry (giá trị trực tiếp). Sum per meal, sum per day.

**Files tạo mới:**
- `src/modules/logs/logs.module.ts`
- `src/modules/logs/logs.controller.ts`
- `src/modules/logs/logs.service.ts`
- DTOs: `create-meal.dto.ts`, `add-entry.dto.ts`, `update-entry.dto.ts`, response DTOs

---

## Phase 8 — Google OAuth

**Học được:** OAuth 2.0, verify idToken, find-or-create user, link UserAuthProvider

**Install:** `yarn add google-auth-library`

**Endpoint:** `POST /auth/google` — `@Public()`, body `{ id_token }`, verify → find/create user → return tokens

---

## Phase 9 — Apple Sign-In

Tương tự Phase 8 nhưng dùng `apple-signin-auth` package.

---

## Phase 10 — Advanced (Future)

- Barcode scan: `GET /food/barcode/:code`
- AI photo: external vision API → CustomMealEntry
- Push notification: Firebase Admin SDK + DeviceToken entity
- Avatar upload: `@aws-sdk/client-s3` presigned URLs

---

## Checklist

```
[ ] Phase 1  — Email verification (AWS SES)
[ ] Phase 2  — User profile CRUD
[ ] Phase 3  — Weight log CRUD
[ ] Phase 4  — Nutrition goal + auto-calculation
[ ] Phase 5  — Food search API
[ ] Phase 6  — GET /users/me aggregate
[ ] Phase 7A — Daily log + meals
[ ] Phase 7B — Meal entries + nutrition totals
[ ] Phase 8  — Google OAuth
[ ] Phase 9  — Apple Sign-In
[ ] Phase 10 — Advanced features
```

## Verification

Sau mỗi phase:
1. `yarn lint` — không có errors
2. `yarn build` — compile thành công
3. Test bằng Postman/Insomnia hoặc `curl` mỗi endpoint
4. `yarn migration:run` nếu có entity changes
5. Review code với `/superpowers:requesting-code-review`
