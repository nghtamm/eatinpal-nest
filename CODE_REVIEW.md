# Code Review — EatinPal NestJS Backend

> **Ngày review:** 2026-06-10
> **Branch:** `feature/reset-pwd`
> **Phạm vi:** Toàn bộ `src/` (54 file `.ts`), migration, config, Docker, test
> **Tiêu chí:** Convention · Kiến trúc & cấu trúc thư mục · Chất lượng code/hiệu năng/edge-case · Bảo mật · Khả năng scale & chịu tải

---

## Tổng quan

Codebase **chất lượng khá tốt** cho giai đoạn đầu: pipeline global (guard/interceptor/filter) thiết kế sạch, entity model chuẩn hóa tốt, flow reset password bằng OTP làm cẩn thận (timing-safe compare, chống user-enumeration, revoke-all-sessions sau khi đổi mật khẩu).

Tuy nhiên còn **một vài bug thật sẽ cắn khi deploy / khi build tiếp tracking features**, và một số lỗ hổng bảo mật/vận hành cần xử lý trước khi lên production.

---

## TL;DR — Ưu tiên xử lý

| # | Mức độ | Vấn đề | Vị trí | Trạng thái |
|---|--------|--------|--------|------------|
| 1 | 🔴 Cao | `start:prod` chạy `node dist/main` nhưng build ra `dist/src/main.js` → prod không khởi động được | `package.json` | ✅ Đã sửa (`node dist/src/main`) |
| 2 | 🔴 Cao | Email **không normalize** ở register/login nhưng **có** ở forgot-password → reset/login **fail âm thầm** với email viết hoa | `auth.service.ts:48` vs `:279` | ⬜ Chưa sửa |
| 3 | 🔴 Cao | `new_password`, `otp`, `token` (query) **bị log plaintext** — redact thiếu field | `logger.config.ts:10-16` | ⬜ Chưa sửa |
| 4 | 🟠 TB-Cao | Thiếu `app.enableShutdownHooks()` → `RedisService.onModuleDestroy` không chạy, không graceful shutdown | `main.ts`, `redis.service.ts:29` | ⬜ Chưa sửa |
| 5 | 🟠 TB-Cao | Throttler **in-memory** + không `trust proxy` → rate limit sai/vô hiệu sau proxy hoặc multi-instance | `app.module.ts:34`, `main.ts` | ⬜ Chưa sửa |
| 6 | 🟠 TB | `ResponseInterceptor` **làm hỏng response khi handler trả mảng** — bug tiềm ẩn cho endpoint food/meal sắp build | `response.interceptor.ts:18` | ⬜ Chưa sửa |

---

## 1. Convention

Nhìn chung **nhất quán, theo chuẩn NestJS tốt**: kebab-case file, hậu tố `*.entity.ts`/`*.dto.ts`/`*.strategy.ts`, message theo đúng rule trong `CLAUDE.md` (không dấu cuối, viết hoa chữ đầu), snake_case ở DB + response, có ESLint + Prettier.

**Cần chỉnh:**

- **Lạm dụng `Promise<any>` và `payload: any`** — hầu hết method trong `auth.service.ts` (`register`, `login`, `refresh`, `verify`, `magicLink`…) khai báo `Promise<any>`; `payload: any` ở `verify`/`magicLink` (`auth.service.ts:209`, `:236`). Mất type-safety đúng chỗ dễ sinh bug nhất (vd `payload.purpose` không được check kiểu). → Định nghĩa interface `JwtEmailPayload`, `TokensResponse`… và trả type cụ thể.
- **`CreateUserDTO` là `interface`** trong thư mục `dto/` (`create-user.dto.ts:1`), trong khi DTO khác là class có decorator. → Đổi tên `*.type.ts`/`*.input.ts` hoặc chuyển thành class.
- **Comment lẫn Việt/Anh** trong `auth.service.ts` (`:28`, `:277`). → Thống nhất 1 ngôn ngữ.
- **Hằng số hardcode** `OTP_EXPIRATION`/`OTP_MAX_ATTEMPTS`/`RESET_WINDOW` (`auth.service.ts:29-31`) trong khi phần còn lại dùng `ConfigService`. → Đưa vào config.
- **Tên class lồng `User`/`Tokens`** trong `auth-response.dto.ts:3,29` trùng tên với entity `User` thật → dễ nhầm khi đọc. → Đặt `AuthUserDTO`/`AuthTokensDTO`.

## 2. Kiến trúc & cấu trúc thư mục

**Điểm mạnh:** Tách module rõ ràng (`auth`/`users`/`email`/`redis`/`database`), `common/` gom decorator-guard-interceptor-filter-util hợp lý, pipeline global khai báo tập trung ở `app.module.ts` dễ đọc. Pattern dual-ID (uuid công khai + int nội bộ) và `SnakeNamingStrategy` là lựa chọn tốt.

**Cần lưu ý:**

- **Entity layout "lai" gây phụ thuộc chéo** — `User` (`modules/users`) `@OneToMany` tới `DailyLog` (`database/entities`) và ngược lại. Khi domain tracking lớn lên, ranh giới module sẽ mờ. → Cân nhắc gom toàn bộ entity về một chỗ, hoặc tách hẳn theo domain module — đừng nửa nọ nửa kia.
- **`UsersController` rỗng** (`users.controller.ts`) nhưng vẫn register → dead code; xóa hoặc implement.
- **Thiếu versioning / global prefix** — không có `setGlobalPrefix('api')` hay URI versioning. Mobile app rất khó migrate khi đổi contract; thêm về sau là breaking change. → Thêm `enableVersioning()` ngay từ giờ.
- **`ResponseInterceptor` ép convention "luôn trả object" nhưng không document & không enforce** → xem mục 3 (bug mảng).
- **Không có health-check endpoint** (`/health`, `@nestjs/terminus`) — cần cho load balancer / k8s readiness & liveness.

## 3. Chất lượng code, hiệu năng & edge-case

- 🟠 **Bug tiềm ẩn: `ResponseInterceptor` hỏng khi handler trả mảng** (`response.interceptor.ts:18`). `const { message, metadata, ...rest } = data ?? {}` — nếu `data` là `Food[]`, `rest` thành object `{0:…,1:…}` và client nhận `{"0":{…},"1":{…}}` thay vì mảng. Chưa lộ vì chưa có endpoint trả mảng, nhưng **tracking/food-search là việc kế tiếp** → sẽ dính ngay. → Xử lý nhánh `Array.isArray(data)` rõ ràng.
- 🟠 **Decimal trả về string** — pg/TypeORM map `numeric` → `string`. Mọi field `decimal` (`nutrition_goals.protein`, `food_item_nutrients.value`, `weightKg`…) ra string trong JSON, client phải parse → dễ sinh bug tính toán. → Thêm `ColumnNumericTransformer` (parseFloat) hoặc convert ở serialize layer.
- **Edge-case `createOne` race** (`users.service.ts:35`) — check `exists` rồi mới insert. Hai request đăng ký song song cùng email có thể cùng qua check → request thua ăn lỗi DB unique constraint dạng **500 thay vì 409**. → Bắt lỗi unique-violation (`23505`) và ném `ConflictException`.
- **`refresh` rotation có race & không phát hiện reuse** (`auth.service.ts:88-113`) — hai request dùng cùng refresh token có thể cùng qua `findOne` trước khi token bị revoke → cả hai thành công. Khi refresh token **đã revoke** được trình lại (dấu hiệu bị đánh cắp), code chỉ trả 401 chứ không revoke cả "family". Rủi ro thấp với mobile, nhưng nên ghi nhận.
- **`resend`/`@Body('email')`/`@Body('refresh_token')` bỏ qua validation DTO** (`auth.controller.ts:71`, `:54`, `:63`) — nhận raw, không `@IsEmail`. → Thêm DTO cho `resend`.
- **Email gửi đồng bộ trong request** (`register`/`resend`/`requestReset`) — `await sesClient.send(...)` nằm trong luồng response → latency SES cộng thẳng vào response time, có thể chạm `TimeoutInterceptor` 10s. → Đẩy gửi mail sang queue / `@nestjs/event-emitter`.
- **Cột chết** — `RefreshToken.deviceName` & `ipAddress` (`refresh-token.entity.ts:29,32`) khai báo nhưng `storeRefreshToken` (`auth.service.ts:115`) không set. → Dùng hoặc bỏ.
- **`passwordHash` không `select: false`** (`user.entity.ts:29`) — mọi `findOneBy` kéo hash vào memory và gắn vào `request.user`. Response đã được DTO whitelist che, nhưng `select:false` an toàn hơn (defense-in-depth).
- **Hiệu năng pipeline** — mỗi response qua cả `SerializeInterceptor` (plainToInstance) **rồi** `ResponseInterceptor` (`ObjectKeysToSnake` đệ quy tạo object mới) → 2 lần duyệt + clone toàn bộ với list lớn. Để ý khi food-search trả vài trăm item.

## 4. Bảo mật

Làm tốt ở những chỗ khó: OTP timing-safe compare (`auth.service.ts:316`), chống user-enumeration (`:294`), bcrypt 12 rounds, SHA-256 refresh token, password policy mạnh, `crypto.randomInt` (CSPRNG) cho OTP. Còn các lỗ sau:

- 🔴 **Email/OTP/secret bị ghi log plaintext** (`logger.config.ts:10-16`). Redact chỉ có `body.password`, `body.refresh_token`. Đã **verify bằng repro**: `new_password` và `otp` **lộ nguyên trong log**. Ngoài ra `LoggingInterceptor` log cả `query` (`logging.interceptor.ts:39`) → token verify ở `GET /auth/verify?token=…` (một JWT đổi được ra login qua magic-link) **bị log nguyên**. → Bổ sung redact: `body.new_password`, `body.otp`, `req.query.token`, cân nhắc `body.email`.
- 🟠 **Brute-force login** — `POST /login`, `/register`, `/refresh` **không** override throttle → dùng global 60 req/phút. (Forgot-password/verify-otp/reset đã siết riêng — tốt.) → Login nên ~5–10/phút/IP.
- 🟠 **Rate limit không đáng tin sau proxy** — `main.ts` không `app.set('trust proxy', …)` → `req.ip` có thể là IP proxy/ALB → throttle gộp chung mọi user (hoặc XFF không tin → sai). Kèm **ThrottlerStorage in-memory** (không gắn Redis dù đã có sẵn) → multi-instance mỗi node đếm riêng, attacker xoay vòng instance là bypass. → Dùng `@nest-lab/throttler-storage-redis` + set trust proxy.
- 🟠 **Email bombing / abuse** — `forgot-password` (3/phút) và `resend`/`register` (chỉ global 60/phút) đều gửi mail tới địa chỉ do client nhập, **không có cooldown theo recipient** → spam inbox nạn nhân, đốt quota SES. → Thêm khóa Redis `email:cooldown:<addr>` (vd 60s/lần) trước khi gửi.
- 🟡 **Thiếu security headers & CORS chưa cấu hình** (`main.ts`) — không `helmet`, không `enableCors`. App chỉ mobile thì CORS ít quan trọng, nhưng `GET /auth/verify` trả **HTML chạy script** (`verify-page.html.ts`) → nên có header bảo vệ tối thiểu (CSP/nosniff).
- 🟡 **Magic-link dùng verification token làm credential đăng nhập** (`auth.controller.ts:137`, `auth.service.ts:235`) — token `purpose:'verification'` (sống 1h theo `.env.example`) đổi ra access+refresh nhiều lần đến khi hết hạn. Là tính năng cố ý, nhưng nên cân nhắc one-time-use (đánh dấu đã dùng trong Redis).
- 🟡 **Không validate biến môi trường** (`configuration.ts`) — không có schema (Joi/zod). `getOrThrow` chỉ ném lỗi khi truy cập → cấu hình thiếu (vd `JWT_SECRET` rỗng) có thể lọt tới request đầu tiên thay vì fail khi boot.

## 5. Khả năng scale & chịu tải

- 🟠 **Refresh tokens phình vô hạn** — mỗi login/refresh insert 1 row, không có job dọn token hết hạn/đã revoke (`refresh_tokens`). → Cron cleanup (`DELETE WHERE expires_at < now() OR revoked_at < now() - interval '30d'`).
- 🟠 **Stateful in-memory ở Throttler** (đã nêu) là rào cản scale ngang lớn nhất hiện tại → chuyển sang Redis là bắt buộc nếu chạy >1 instance.
- 🟡 **Graceful shutdown chưa có** (thiếu `enableShutdownHooks`) → khi scale-in/deploy rolling, connection Redis/PG/in-flight request không đóng sạch → có thể rớt request lúc deploy.
- 🟢 **DB index hợp lý** — FK đều có index, unique đúng chỗ, GIN `pg_trgm` trên `name_vi`/`name_en` cho food search là chuẩn bị tốt. `uuidv7()` (sequential UUID) tốt cho index locality hơn uuidv4 — lựa chọn đẹp.
- 🟡 **N+1 tiềm ẩn** khi build tracking — quan hệ `DailyLog→Meal→MealEntry` chưa có service, nhớ dùng `QueryBuilder`/`relations` có chủ đích, tránh lazy-load vòng lặp.

## 6. Kiểm thử & CI

- **0 unit test** (`*.spec.ts` không có file nào) và **e2e test đã hỏng/lỗi thời**: `test/e2e/app.e2e-spec.ts:19` expect `GET /` trả `"Hello World!"` nhưng **không có `AppController`** nào tồn tại; lại cần Postgres thật để `AppModule` init → chắc chắn fail. → Xóa test stub, viết test thật cho `AuthService` (logic OTP/reset là nơi đáng test nhất).
- **Không có CI** (`.github/workflows` trống). Với auth/security nhạy cảm → nên có pipeline `lint` + `build` + `test` mỗi PR.

---

## Điểm tốt đáng giữ

- Pipeline global tách bạch sạch sẽ (guard → interceptor → filter).
- Reset-password flow bài bản: OTP hash + timing-safe compare + chống enumeration + revoke-all-sessions sau khi đổi mật khẩu (`auth.service.ts:361`).
- Entity model chuẩn hóa, bilingual (`nameVI`/`nameEN`), dual-ID nhất quán.
- Migration viết tay đầy đủ FK/index, `synchronize: false`.
- Password policy mạnh; `crypto.randomInt` cho OTP đúng chuẩn CSPRNG.

---

## Đề xuất thứ tự ưu tiên

1. **Sửa ngay (bug deploy/chức năng):**
   - ✅ ~~Đường dẫn `start:prod`~~ (đã sửa)
   - ⬜ Normalize email tập trung ở register/login (#2)
   - ⬜ Bổ sung redact log (#3)
2. **Trước khi lên production:** `enableShutdownHooks` + graceful shutdown · throttler Redis + `trust proxy` · siết throttle login · cooldown chống email-bomb · env validation schema.
3. **Trước khi build tracking:** xử lý bug mảng ở `ResponseInterceptor` · transformer cho decimal · thống nhất layout entity · thêm versioning + health-check · cron dọn refresh token.
4. **Nợ kỹ thuật:** bỏ `Promise<any>` · viết test cho `AuthService` · dựng CI · xóa e2e stub.

---

# Phụ lục — Hướng dẫn sửa chi tiết

> Mỗi mục dưới đây kèm code cụ thể. Vấn đề nào có nhiều hướng sửa thì liệt kê **tất cả** kèm đánh đổi để bạn chọn. Code minh họa theo NestJS 11 / TypeORM 0.3 / ioredis — copy về cần chỉnh path import cho khớp.

**Mục lục:**
[A. Email normalization](#a-email-normalization-2) ·
[B. Redact log secrets](#b-redact-secrets-trong-log-3) ·
[C. Graceful shutdown](#c-graceful-shutdown-4) ·
[D. Rate limiting đúng & bền](#d-rate-limiting-đúng--bền-5) ·
[E. ResponseInterceptor & mảng](#e-responseinterceptor-an-toàn-với-mảng-6) ·
[F. Email bombing cooldown](#f-chống-email-bombing) ·
[G. Env validation](#g-validate-biến-môi-trường) ·
[H. Refresh token race/reuse/cleanup](#h-refresh-token-racereusecleanup) ·
[I. Decimal → number](#i-decimal-trả-về-string) ·
[J. createOne 409](#j-createone-trả-409-thay-vì-500) ·
[K. passwordHash select:false](#k-passwordhash-selectfalse) ·
[L. DTO cho resend/refresh/magic-link](#l-dto-cho-các-endpoint-nhận-raw-body) ·
[M. Gửi email bất đồng bộ](#m-gửi-email-bất-đồng-bộ) ·
[N. Versioning + prefix](#n-versioning--global-prefix) ·
[O. Health check](#o-health-check) ·
[P. Helmet + CORS](#p-helmet--cors) ·
[Q. Test + CI](#q-test--ci) ·
[R. Bỏ Promise&lt;any&gt;](#r-bỏ-promiseany)

---

## A. Email normalization (#2)

**Gốc rễ:** `requestReset`/`verifyOtp`/`resetPassword` normalize email (lowercase + trim), nhưng `register` (`auth.service.ts:48`) và `validateLocal` (`:147`) dùng raw. Cột `email` là `varchar` → Postgres so khớp **phân biệt hoa thường**. Đăng ký `Foo@bar.com`, quên mật khẩu gõ `foo@bar.com` → không tìm thấy → fail âm thầm.

> ⚠️ Login đi qua `LocalAuthGuard` → `LocalStrategy.validate(email, password)`, **không qua DTO**, nên chỉ fix ở DTO là chưa đủ — phải xử lý cả login.

### Cách 1 — Normalize ở DTO bằng `@Transform` (khuyến nghị, chặn ngay biên)

Thêm vào **mọi** DTO có field email (`register.dto.ts`, `forgot-password.dto.ts`, `verify-otp.dto.ts`, `reset-password.dto.ts`):

```ts
import { Transform } from 'class-transformer';

export class RegisterDTO {
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  @IsEmail()
  @IsNotEmpty()
  email: string;
  // ...
}
```

Vì login không có DTO, bổ sung normalize trong `validateLocal` (và bỏ normalize trùng trong service nếu muốn gom về DTO):

```ts
async validateLocal(email: string, password: string): Promise<User> {
  const user = await this.usersService.findOneByEmail(email.toLowerCase().trim());
  // ...
}
```

Và normalize ở `register` trước khi tạo user:

```ts
async register(dto: RegisterDTO): Promise<any> {
  const email = dto.email.toLowerCase().trim(); // nếu chưa dùng @Transform
  const hash = await BcryptHash(dto.password);
  const user = await this.usersService.createOne({ email, passwordHash: hash, name: dto.name }, AuthProvider.LOCAL);
  // ...
}
```

### Cách 2 — Normalize tập trung trong service

Đưa `normalizeEmail()` (đang là private ở `auth.service.ts:261`) thành điểm chuẩn hóa duy nhất, gọi ở **mọi** entry point: `register`, `validateLocal`, `resend`, và 3 hàm reset (đã có). Đơn giản, không đụng DTO, nhưng phải nhớ thêm cho mọi flow mới (Google/Apple OAuth sau này).

### Cách 3 — DB-level bằng `citext` (bền nhất)

Dùng kiểu `citext` (case-insensitive text) cho cột email → uniqueness và mọi lookup tự động không phân biệt hoa thường, **bất kể** app quên normalize. Tạo migration:

```ts
await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS citext`);
await queryRunner.query(`ALTER TABLE users ALTER COLUMN email TYPE citext`);
```

Đổi entity: `@Column({ type: 'citext', unique: true })`. **Vẫn nên** `.trim()` ở app vì citext chỉ lo hoa/thường, không lo khoảng trắng. Đánh đổi: thêm extension, type ngoài chuẩn.

> **Khuyến nghị:** Cách 1 (chặn biên) cho v1; cân nhắc Cách 3 nếu muốn bền tuyệt đối ở DB. Có thể kết hợp 1 + 3.

---

## B. Redact secrets trong log (#3)

**Gốc rễ:** `logger.config.ts:11-16` chỉ redact `body.password`, `body.refresh_token`. `LoggingInterceptor` (`logging.interceptor.ts:39-40`) log nguyên `body` và `query` → `new_password`, `otp`, và `token` ở query string của `GET /auth/verify` lộ plaintext (đã verify bằng repro).

### Cách 1 — Mở rộng redact paths với wildcard (khuyến nghị, gọn)

Pino hỗ trợ wildcard `*` cho 1 cấp key → phủ cả `body`, `query`, `params` một lần:

```ts
redact: {
  paths: [
    'req.headers.authorization',
    'req.headers.cookie',
    '*.password',
    '*.new_password',
    '*.otp',
    '*.refresh_token',
    '*.token',
  ],
  censor: '[REDACTED]',
},
```

### Cách 2 — Allowlist thay vì denylist (an toàn theo mặc định)

Thay vì liệt kê field cấm, chỉ log field cho phép → field nhạy cảm mới thêm về sau **không tự lộ**. Sửa `LoggingInterceptor` để chỉ log key an toàn:

```ts
const SAFE_BODY_KEYS = ['email', 'name'];
const safeBody = body
  ? Object.fromEntries(Object.entries(body).filter(([k]) => SAFE_BODY_KEYS.includes(k)))
  : undefined;
// ...log safeBody thay cho body
```

### Cách 3 — Sanitizer/serializer riêng cho `body`

Giữ log đầy đủ nhưng dùng custom serializer strip key nhạy cảm tập trung:

```ts
const SENSITIVE = new Set(['password', 'new_password', 'otp', 'refresh_token', 'token']);
const sanitize = (o: Record<string, unknown> = {}) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, SENSITIVE.has(k) ? '[REDACTED]' : v]));
```

> **Khuyến nghị:** Cách 1 ngay bây giờ (1 phút), hướng dần sang Cách 2 khi API lớn. **Nhớ** cũng đừng đưa `token` query vào response/redirect log.

---

## C. Graceful shutdown (#4)

**Gốc rễ:** `main.ts` không gọi `enableShutdownHooks()` → `RedisService.onModuleDestroy` (`redis.service.ts:29`) không chạy khi nhận SIGTERM; kết nối PG/Redis không đóng sạch khi deploy rolling.

```ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks(); // <-- thêm dòng này
  await app.listen(process.env.PORT ?? 3000);
}
```

> Chỉ 1 cách. Lưu ý: hook chỉ kích hoạt khi process nhận tín hiệu (SIGTERM/SIGINT) — trong Docker/k8s mặc định đã gửi SIGTERM. Nếu chạy sau `tini`/PID 1 nhớ forward signal. Có thể thêm `terminationGracePeriodSeconds` ở k8s để in-flight request kịp xong.

---

## D. Rate limiting đúng & bền (#5)

Gồm 3 việc: (D1) tin proxy để lấy đúng IP, (D2) dùng Redis storage để đếm chung khi multi-instance, (D3) siết throttle cho login/register/refresh.

### D1 — `trust proxy`

```ts
import { NestExpressApplication } from '@nestjs/platform-express';

const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
app.set('trust proxy', 1); // tin 1 lớp proxy (nginx/ALB) đứng trước
```

- `1` = tin đúng 1 hop (phổ biến nhất, an toàn).
- Hoặc chỉ định subnet proxy: `app.set('trust proxy', '10.0.0.0/8')`.
- **Tránh** `true` (tin mọi XFF → attacker giả IP để né throttle).

> Cách khác (không cần đổi app type): `app.getHttpAdapter().getInstance().set('trust proxy', 1);`. Hoặc override `getTracker()` trong custom `ThrottlerGuard` để tự đọc `X-Forwarded-For`.

### D2 — Redis storage cho Throttler

```bash
pnpm add @nest-lab/throttler-storage-redis
```

Đổi `ThrottlerModule.forRoot(...)` ở `app.module.ts` sang async để dùng lại client Redis (`RedisModule` đã `@Global` và cung cấp token `'REDIS'`):

```ts
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import Redis from 'ioredis/built/Redis';

ThrottlerModule.forRootAsync({
  inject: ['REDIS'],
  useFactory: (redis: Redis) => ({
    throttlers: [
      { name: 'short', ttl: 1000, limit: 3 },
      { name: 'medium', ttl: 10000, limit: 20 },
      { name: 'long', ttl: 60000, limit: 60 },
    ],
    storage: new ThrottlerStorageRedisService(redis),
  }),
}),
```

> Nếu chỉ chạy **1 instance** thì in-memory vẫn ổn — D2 chỉ bắt buộc khi scale ngang.

### D3 — Siết brute-force login/register/refresh

Thêm `@Throttle` cho các route auth nhạy cảm trong `auth.controller.ts` (đang dùng global 60/phút):

```ts
@Public()
@Throttle({ short: { limit: 1, ttl: 1000 }, medium: { limit: 5, ttl: 60000 } }) // 5 lần/phút/IP
@UseGuards(LocalAuthGuard)
@HttpCode(HttpStatus.OK)
@Post('login')
login(@GetUser() user: User) { /* ... */ }
```

Áp tương tự cho `register` (vd 3/phút) và `refresh` (vd 10/phút). Muốn chặt theo **email** thay vì IP: override `getTracker()` đọc `req.body.email`.

---

## E. ResponseInterceptor an toàn với mảng (#6)

**Gốc rễ:** `response.interceptor.ts:18` destructure `{ message, metadata, ...rest }` từ mọi payload. Nếu handler trả `Food[]`, `rest` thành `{0:…,1:…}` → client nhận object thay vì mảng.

### Cách 1 — Xử lý đủ các shape (khuyến nghị)

```ts
intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
  const status = ctx.switchToHttp().getResponse().statusCode;

  return next.handle().pipe(
    map((payload) => {
      // null / undefined / primitive / mảng → đưa thẳng vào data
      if (payload == null || typeof payload !== 'object' || Array.isArray(payload)) {
        return {
          status_code: status,
          message: 'Success',
          data: payload == null ? null : ObjectKeysToSnake(payload),
        };
      }

      const { message, metadata, data: explicitData, ...rest } = payload as Record<string, any>;
      const body =
        explicitData !== undefined
          ? explicitData
          : Object.keys(rest).length > 0
            ? rest
            : null;

      return {
        status_code: status,
        message: message ?? 'Success',
        data: body == null ? null : ObjectKeysToSnake(body),
        ...(metadata && { metadata: ObjectKeysToSnake(metadata) }),
      };
    }),
  );
}
```

Sau đó các endpoint list trả được cả 2 dạng:
- `return foods;` → `data` là mảng.
- `return { data: foods, metadata: { total, page } };` → có cả metadata.

### Cách 2 — Contract envelope tường minh bằng class

Định nghĩa wrapper, interceptor chỉ unwrap shape đã biết:

```ts
export class ApiList<T> { constructor(public data: T[], public metadata?: object, public message?: string) {} }
// handler: return new ApiList(foods, { total }, 'Fetched foods');
```

Rõ ràng, dễ type, nhưng phải sửa mọi handler dùng nó.

> **Khuyến nghị:** Cách 1 — tương thích ngược với code hiện tại và tự xử lý mảng. Làm **trước khi** build endpoint food-search.

---

## F. Chống email bombing

**Gốc rễ:** `forgot-password`/`resend`/`register` gửi mail tới địa chỉ client nhập, không cooldown theo người nhận → spam inbox + đốt quota SES.

### Cách 1 — Khóa cooldown trong Redis (khuyến nghị, dùng hạ tầng sẵn có)

Thêm helper vào `RedisService`:

```ts
async setIfNotExists(key: string, value: string, ttl: number): Promise<boolean> {
  const res = await this.redisClient.set(key, value, 'EX', ttl, 'NX');
  return res === 'OK';
}
```

Trong `AuthService`, bọc trước mỗi lần gửi:

```ts
private emailCooldownKey(email: string) { return `email:cooldown:${email}`; }

private async sendVerificationEmail(user: User, token: string): Promise<void> {
  const fresh = await this.redisService.setIfNotExists(this.emailCooldownKey(user.email), '1', 60);
  if (!fresh) return; // còn cooldown → bỏ qua, vẫn trả message generic ở caller
  await this.emailService.sendVerificationEmail(user.email, token);
}
```

Với `requestReset`: **vẫn** trả message generic dù bị chặn (giữ chống enumeration).

### Cách 2 — Cột `last_email_sent_at` trên DB

Lưu mốc gửi gần nhất, so sánh khoảng cách. Bền qua việc Redis bị flush, nhưng thêm cột + write mỗi lần gửi.

### Cách 3 — Queue có debounce (BullMQ)

Đẩy email vào queue, dedup theo `jobId = email:purpose` trong cửa sổ thời gian. Mạnh nhất (retry + rate limit nhà cung cấp) nhưng nặng — xem mục M.

> **Khuyến nghị:** Cách 1 cho v1.

---

## G. Validate biến môi trường

**Gốc rễ:** `configuration.ts` không có schema; thiếu biến (vd `JWT_SECRET` rỗng) chỉ vỡ khi `getOrThrow` chạy lần đầu, không fail lúc boot.

### Cách 1 — class-validator (khuyến nghị, không thêm dependency)

`class-validator`/`class-transformer` đã có sẵn. Tạo `src/config/env.validation.ts`:

```ts
import { plainToInstance } from 'class-transformer';
import { IsIn, IsNotEmpty, IsOptional, IsString, validateSync } from 'class-validator';

class EnvVars {
  @IsString() @IsNotEmpty() DB_HOST: string;
  @IsString() @IsNotEmpty() DB_NAME: string;
  @IsString() @IsNotEmpty() JWT_SECRET: string;
  @IsString() @IsNotEmpty() JWT_REFRESH_SECRET: string;
  @IsString() @IsNotEmpty() JWT_EMAIL_SECRET: string;
  @IsString() @IsNotEmpty() AWS_REGION: string;
  @IsString() @IsNotEmpty() SES_FROM_EMAIL: string;
  @IsOptional() @IsIn(['development', 'production', 'test']) NODE_ENV?: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvVars, config, { enableImplicitConversion: true });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length) throw new Error(`Invalid environment:\n${errors.toString()}`);
  return validated;
}
```

```ts
// app.module.ts
ConfigModule.forRoot({ isGlobal: true, load: [Configuration], validate: validateEnv }),
```

### Cách 2 — Joi schema

```bash
pnpm add joi
```

```ts
import * as Joi from 'joi';

ConfigModule.forRoot({
  isGlobal: true,
  load: [Configuration],
  validationSchema: Joi.object({
    JWT_SECRET: Joi.string().required(),
    JWT_REFRESH_SECRET: Joi.string().required(),
    DB_HOST: Joi.string().required(),
    NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
    // ...
  }),
}),
```

> **Khuyến nghị:** Cách 1 (tái dùng dep sẵn có). Joi nếu thích cú pháp schema gọn.

---

## H. Refresh token: race/reuse/cleanup

### H1 — Rotation chống race + nhận diện reuse

**Gốc rễ:** `refresh()` (`auth.service.ts:88`) làm `findOne` rồi mới `update` → 2 request song song cùng qua được. Và token đã revoke trình lại chỉ bị 401, không revoke "family".

**Cách 1 — Revoke nguyên tử bằng `update().affected` (khuyến nghị):**

```ts
import { IsNull, MoreThan } from 'typeorm';

async refresh(userID: number, refreshToken: string): Promise<any> {
  const user = await this.usersService.findOneByID(userID);
  if (!user) throw new UnauthorizedException('Invalid or expired token');

  // revoke có điều kiện trong 1 câu UPDATE — chỉ 1 request thắng
  const res = await this.refreshTokenRepository.update(
    { userID: user.id, tokenHash: SHA256(refreshToken), revokedAt: IsNull(), expiresAt: MoreThan(new Date()) },
    { revokedAt: new Date() },
  );

  if (res.affected === 0) {
    // token sai / hết hạn / đã dùng — dấu hiệu reuse → revoke toàn bộ để an toàn
    await this.logout(user.id);
    throw new UnauthorizedException('Invalid or expired token');
  }

  const tokens = await this.generateCredentialsToken(user);
  await this.storeRefreshToken(user.id, tokens.refreshToken);
  return tokens;
}
```

**Cách 2 — Token family đầy đủ:** thêm cột `family_id` (uuid) và `replaced_by`. Khi rotate, token mới cùng `family_id`. Khi gặp token đã revoke → revoke cả family theo `family_id` (chính xác hơn là revoke toàn user). Bảo mật cao hơn, cần migration + logic.

**Cách 3 — Khóa bi quan:** bọc trong transaction + `SELECT … FOR UPDATE` trên dòng token. Đúng nhưng nặng hơn Cách 1.

> **Khuyến nghị:** Cách 1 — sửa cả race lẫn reuse cơ bản, chỉ đổi vài dòng.

### H2 — Dọn token rác

**Cách 1 — Cron trong app (khuyến nghị):**

```bash
pnpm add @nestjs/schedule
```

```ts
// app.module.ts: imports thêm ScheduleModule.forRoot()

@Injectable()
export class TokenCleanupService {
  constructor(@InjectRepository(RefreshToken) private readonly repo: Repository<RefreshToken>) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanup(): Promise<void> {
    const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    await this.repo
      .createQueryBuilder()
      .delete()
      .where('expires_at < :now', { now: new Date() })
      .orWhere('revoked_at < :cutoff', { cutoff })
      .execute();
  }
}
```

**Cách 2 — `pg_cron`:** lập lịch `DELETE` ngay trong Postgres, không cần app. Cần extension + quyền.

**Cách 3 — Lười (no-dep):** mỗi lần login/refresh, xóa luôn token hết hạn của chính user đó. Đơn giản nhưng dọn không đều.

**Cách 4 — Chuyển refresh token sang Redis có TTL:** lưu hash token trong Redis key `rt:<userId>:<hash>` TTL = hạn token → tự hết hạn, khỏi cron. Đổi đáng kể kiến trúc, mất audit trail trong DB.

> **Khuyến nghị:** Cách 1.

---

## I. Decimal trả về string

**Gốc rễ:** pg map `numeric` → `string`. Mọi cột `decimal` (nutrition, weight, food nutrient…) ra string trong JSON.

### Cách 1 — Transformer theo cột (khuyến nghị, an toàn precision)

`src/common/utils/numeric.transformer.ts`:

```ts
export class ColumnNumericTransformer {
  to(value: number | null): number | null { return value; }
  from(value: string | null): number | null { return value === null ? null : parseFloat(value); }
}
```

Áp cho từng cột decimal:

```ts
import { ColumnNumericTransformer } from '../../../common/utils/numeric.transformer';

@Column({ type: 'decimal', precision: 5, scale: 1, nullable: true, transformer: new ColumnNumericTransformer() })
protein: number;
```

### Cách 2 — Đổi parser toàn cục cho pg (1 chỗ)

Trong `data-source.ts`:

```ts
import { types } from 'pg';
types.setTypeParser(1700, (val) => (val === null ? null : parseFloat(val))); // OID 1700 = numeric
```

Gọn nhất nhưng áp cho **mọi** numeric toàn hệ thống và `parseFloat` mất precision với số rất lớn (không thành vấn đề với dữ liệu dinh dưỡng).

### Cách 3 — Convert ở DTO serialize

`@Transform(({ value }) => (value == null ? value : Number(value)))` trên field DTO. Chỉ tác dụng nơi có DTO.

> **Khuyến nghị:** Cách 1 (kiểm soát từng cột) hoặc Cách 2 (chấp nhận đánh đổi precision để gọn).

---

## J. createOne trả 409 thay vì 500

**Gốc rễ:** `users.service.ts:35` check `exists` rồi insert → 2 request song song lọt qua check, request thua ăn lỗi unique constraint dạng 500.

### Cách 1 — Bắt lỗi unique-violation tại chỗ (khuyến nghị)

```ts
import { QueryFailedError } from 'typeorm';

return this.dataSource.transaction(async (manager) => {
  const user = manager.create(User, dto);
  try {
    const saved = await manager.save(user);
    await manager.save(manager.create(UserAuthProvider, { user: saved, provider: authProvider }));
    return saved;
  } catch (e) {
    if (e instanceof QueryFailedError && (e as any).code === '23505') {
      throw new ConflictException('This email is already in use');
    }
    throw e;
  }
});
```

(Có thể bỏ luôn bước `manager.exists` vì unique constraint đã là nguồn chân lý — tiết kiệm 1 query.)

### Cách 2 — Exception filter map lỗi Postgres toàn cục

Tạo `@Catch(QueryFailedError)` filter map `23505` → `ConflictException` cho toàn app. Tránh lặp try/catch, nhưng message ít ngữ cảnh hơn.

> **Khuyến nghị:** Cách 1 cho message rõ ràng; cân nhắc Cách 2 khi nhiều bảng cần.

---

## K. passwordHash select:false

**Gốc rễ:** `user.entity.ts:29` không có `select:false` → mọi truy vấn kéo hash vào memory và gắn vào `request.user`.

```ts
@Column({ type: 'varchar', length: 255, nullable: true, select: false })
passwordHash: string;
```

Khi đó **login phải chủ động** lấy hash. Thêm method trong `UsersService`:

```ts
async findOneByEmailWithPassword(email: string): Promise<User | null> {
  return this.userRepository
    .createQueryBuilder('u')
    .addSelect('u.passwordHash')
    .where('u.email = :email', { email })
    .getOne();
}
```

`validateLocal` dùng method này thay cho `findOneByEmail`. Các flow khác (`findOneByID`, `validateJWT`) tự động **không** còn hash nữa — an toàn hơn.

> Đánh đổi: phải nhớ `addSelect` ở mọi chỗ thực sự cần hash (chỉ login & verify password). 1 hướng chính.

---

## L. DTO cho các endpoint nhận raw body

**Gốc rễ:** `resend` (`@Body('email')`), `refresh`/`logout` (`@Body('refresh_token')`), `magic-link` (`@Body('verification_token')`) nhận raw, không validate.

```ts
// resend.dto.ts
export class ResendDTO {
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  @IsEmail() @IsNotEmpty()
  email: string;
}

// refresh.dto.ts
export class RefreshDTO {
  @IsString() @IsNotEmpty()
  refresh_token: string;
}
```

```ts
@Post('resend')
resend(@Body() dto: ResendDTO) { return this.authService.resend(dto.email); }
```

> 1 hướng. Lợi: `whitelist`/`forbidNonWhitelisted` của global pipe chặn field rác, ép kiểu chuẩn.

---

## M. Gửi email bất đồng bộ

**Gốc rễ:** `await sesClient.send()` nằm trong luồng request → cộng latency, có thể chạm timeout 10s.

### Cách 1 — Event emitter (khuyến nghị mức vừa)

```bash
pnpm add @nestjs/event-emitter
```

```ts
// app.module.ts: EventEmitterModule.forRoot()
// auth.service.ts:
this.eventEmitter.emit('user.registered', { email: user.email, token });

// email listener:
@OnEvent('user.registered', { async: true })
async handle(p: { email: string; token: string }) { await this.emailService.sendVerificationEmail(p.email, p.token); }
```

Decouple, không block response. Đánh đổi: in-process — app crash giữa chừng thì mất event.

### Cách 2 — Queue BullMQ (khuyến nghị production)

```bash
pnpm add @nestjs/bullmq bullmq
```

Dùng lại Redis sẵn có; job email có **retry + backoff**, bền khi restart. Nặng hơn nhưng chuẩn cho gửi mail/đẩy notification (hợp với roadmap push notification).

### Cách 3 — Fire-and-forget (tạm thời)

```ts
void this.emailService.sendVerificationEmail(user.email, token).catch((e) => this.logger.error(e));
```

Nhanh nhất nhưng mất đảm bảo gửi và là floating promise — chỉ dùng như giải pháp chữa cháy.

> **Khuyến nghị:** Cách 1 ngắn hạn, Cách 2 khi lên production.

---

## N. Versioning + global prefix

**Gốc rễ:** Không có prefix/versioning → khó migrate API cho mobile.

```ts
import { VersioningType } from '@nestjs/common';

app.setGlobalPrefix('api', { exclude: ['auth/verify'] }); // giữ link email & file tĩnh ngoài prefix
app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' }); // /api/v1/...
```

> ⚠️ **Caveat quan trọng:** nếu thêm prefix, URL trong email verify (`email.service.ts:30`: `${appURL}/auth/verify`) và file deep-link tĩnh phải nhất quán. Vì vậy `exclude` route `auth/verify` (đang trả HTML cho browser) để link cũ không vỡ. Cập nhật `APP_URL`/đường dẫn tương ứng khi đổi.

Cách thay thế: chỉ `setGlobalPrefix('api')` chưa cần versioning, nhưng thêm versioning sau là breaking change — nên bật sớm.

---

## O. Health check

**Gốc rễ:** Không có endpoint cho load balancer/k8s. Nhớ `@Public()` để qua `JwtAuthGuard` global.

### Cách 1 — Đơn giản (no-dep)

```ts
@Public()
@Get('health')
health() { return { status: 'ok' }; }
```

### Cách 2 — Terminus (kiểm tra DB + Redis)

```bash
pnpm add @nestjs/terminus
```

```ts
@Controller('health')
export class HealthController {
  constructor(private health: HealthCheckService, private db: TypeOrmHealthIndicator) {}

  @Public() @Get() @HealthCheck()
  check() { return this.health.check([() => this.db.pingCheck('database')]); }
}
```

Có thể thêm indicator Redis (custom hoặc `ping`). Phân biệt **liveness** (`/health`) vs **readiness** (`/health/ready` có check DB) cho k8s.

> **Khuyến nghị:** Cách 2 nếu deploy k8s; Cách 1 nếu chỉ cần ping cơ bản.

---

## P. Helmet + CORS

**Gốc rễ:** `main.ts` không có security header; `GET /auth/verify` trả HTML chạy script.

```bash
pnpm add helmet
```

```ts
import helmet from 'helmet';

app.use(helmet());
// Mobile-only thường KHÔNG cần CORS; nếu có web/admin thì bật có kiểm soát:
app.enableCors({ origin: ['https://admin.eatinpal.com'], credentials: true });
```

> ⚠️ **Caveat:** `verify-page.html.ts` dùng **inline `<script>`**. Helmet bật CSP mặc định (`script-src 'self'`) sẽ **chặn** script này → trang verify hỏng. Ba hướng:
> 1. Tách script ra file tĩnh phục vụ qua `ServeStatic` (`script-src 'self'`) — sạch nhất.
> 2. Dùng **nonce**: gắn `nonce` vào thẻ script và header CSP cho riêng route đó.
> 3. Tắt CSP toàn cục `helmet({ contentSecurityPolicy: false })` — nhanh nhưng yếu nhất, không khuyến khích.
>
> Khuyến nghị hướng 1.

---

## Q. Test + CI

### Q1 — Xóa/sửa e2e stub hỏng

`test/e2e/app.e2e-spec.ts` test `GET /` trả `"Hello World!"` nhưng không có `AppController` → luôn fail và cần DB. Xóa, hoặc thay bằng e2e thật cho auth (cần Postgres+Redis test, vd qua Testcontainers).

### Q2 — Unit test cho AuthService (nơi logic phức tạp nhất)

```ts
describe('AuthService', () => {
  let service: AuthService;
  const users = { findOneByEmail: jest.fn(), findOneByID: jest.fn(), updatePasswordByID: jest.fn() };
  const redis = { get: jest.fn(), del: jest.fn(), setWithTTL: jest.fn(), increaseWithTTL: jest.fn() };
  // ... mock emailService, jwtService, configService, refreshTokenRepository

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: users },
        { provide: RedisService, useValue: redis },
        // ...
      ],
    }).compile();
    service = module.get(AuthService);
  });

  it('requestReset luôn trả message generic kể cả email không tồn tại', async () => {
    users.findOneByEmail.mockResolvedValue(null);
    const r = await service.requestReset({ email: 'x@y.com' });
    expect(r.message).toContain('If an account exists');
    expect(redis.setWithTTL).not.toHaveBeenCalled();
  });

  it('verifyOtp khóa sau MAX attempts', async () => {
    redis.get.mockResolvedValueOnce('5'); // attempts
    await expect(service.verifyOtp({ email: 'x@y.com', otp: '000000' }))
      .rejects.toThrow('Too many attempts');
  });
});
```

Ưu tiên cover: OTP sai → tăng attempt, hết hạn, reset thành công revoke hết session, refresh rotation.

### Q3 — GitHub Actions

`.github/workflows/ci.yml`:

```yaml
name: CI
on: [push, pull_request]
jobs:
  build-test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:18-alpine
        env: { POSTGRES_DB: eatinpal, POSTGRES_USER: eatinpal, POSTGRES_PASSWORD: test }
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready --health-interval 10s --health-timeout 5s --health-retries 5
      redis:
        image: redis:8.8.0-alpine
        ports: ['6379:6379']
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm build
      - run: pnpm test
        env:
          DB_HOST: localhost
          JWT_SECRET: test
          JWT_REFRESH_SECRET: test
          JWT_EMAIL_SECRET: test
          # ... các biến tối thiểu để boot
```

> Lưu ý: nếu giữ private package `eatinpal-crawler` (github:), CI cần token truy cập repo đó.

---

## R. Bỏ Promise&lt;any&gt;

**Gốc rễ:** `auth.service.ts` dùng `Promise<any>` và `payload: any` khắp nơi → mất type-safety đúng chỗ nhạy cảm.

Định nghĩa type dùng chung, vd `src/modules/auth/auth.types.ts`:

```ts
export interface JwtAccessPayload { sub: number; email: string; }
export interface JwtEmailPayload { sub: number; email: string; purpose: 'verification'; }
export interface AuthTokens { accessToken: string; refreshToken: string; }
export interface MessageResponse { message: string; }
export interface LoginResult { user: User; tokens: AuthTokens; }
```

Áp vào chữ ký hàm + verify token có kiểu:

```ts
async verify(token: string): Promise<MessageResponse> {
  let payload: JwtEmailPayload;
  try {
    payload = await this.jwtService.verifyAsync<JwtEmailPayload>(token, {
      secret: this.configService.getOrThrow<string>('cfg.jwt.EMAIL_SECRET'),
    });
  } catch {
    throw new UnauthorizedException('Invalid or expired token');
  }
  if (payload.purpose !== 'verification') throw new UnauthorizedException('Invalid or expired token');
  // ...
}
```

> 1 hướng. ESLint đang để `no-explicit-any: 'off'` — sau khi gắn type, cân nhắc bật lại `warn` để chặn `any` mới.
