# Plan: OTP-based Forgot/Reset Password (Redis)

## Context

EatinPal cần tính năng **quên mật khẩu** cho app Flutter. Luồng:
user nhập email → backend bắn OTP qua email → user nhập OTP → màn đặt mật khẩu mới
(nhập 2 lần) → backend đổi mật khẩu → client redirect về login.

**Quyết định đã chốt:**
1. Luồng **FORGOT-PASSWORD** (user không nhớ mật khẩu) → **KHÔNG yêu cầu old password**.
   Chỉ nhập new password (client tự kiểm tra 2 lần khớp).
2. **OTP + cờ verified lưu trong REDIS** (không lưu DB). Ràng buộc bằng **cờ verified
   trong Redis** (không dùng JWT reset token).
3. **RedisModule global bọc `ioredis`**, inject qua DI.

**Vì sao cần verify:** backend không tin frontend. Việc "chuyển sang màn reset" chỉ
xảy ra phía client; hacker gọi thẳng API. Nếu endpoint reset không đòi bằng chứng đã
nhập OTP thì ai biết email nạn nhân cũng đổi được mật khẩu. Cờ `reset:allowed:<email>`
(chỉ set sau khi OTP đúng) chính là bằng chứng đó.

## Luồng 3 endpoint

```
1. POST /auth/forgot-password { email }
   → gen OTP, lưu SHA256(otp) vào Redis (TTL ~5'), gửi OTP qua email
   → LUÔN trả message generic (không lộ email tồn tại hay không)

2. POST /auth/verify-otp { email, otp }
   → so SHA256(otp) (timing-safe). Đếm sai bằng INCR, quá ngưỡng → khoá
   → đúng: xoá OTP key, set cờ reset:allowed:<email> (TTL ~10')

3. POST /auth/reset-password { email, new_password }
   → check cờ reset:allowed:<email>. Có → hash + update password, xoá cờ,
     revoke toàn bộ refresh token. Client redirect login.
```

## Redis key scheme

| Mục đích | Key | Value | TTL |
|---|---|---|---|
| OTP | `otp:reset:<email>` | SHA256(otp) | `OTP_EXPIRATION` (300s) |
| Đếm sai | `otp:attempts:<email>` | int | `OTP_EXPIRATION` (xoá cùng OTP) |
| Cờ verified | `reset:allowed:<email>` | `'1'` | `RESET_WINDOW` (600s) |

Email luôn `.toLowerCase().trim()` trước khi tạo key.

---

# PHẦN 1 — HẠ TẦNG REDIS

## 1.1. Cài dependency

```bash
pnpm add ioredis    # ioredis có sẵn types, không cần @types
```

## 1.2. `docker-compose.yml` (SỬA — thêm service redis + volume)

```yaml
services:
  postgres:
    image: postgres:18-alpine
    ports:
      - '5432:5432'
    environment:
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redisdata:/data

volumes:
  pgdata:
  redisdata:
```

## 1.3. `.env.example` (SỬA — thêm 2 block cuối file)

```env
# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# OTP
OTP_EXPIRATION=300
OTP_MAX_ATTEMPTS=5
RESET_WINDOW=600
```

## 1.4. `src/config/redis.config.ts` (TẠO MỚI)

Khớp pattern `jwt.config.ts` / `aws.config.ts`. Coerce số + fallback.

```ts
export default () => ({
  redisHost: process.env.REDIS_HOST,
  redisPort: Number(process.env.REDIS_PORT) || 6379,
  redisPassword: process.env.REDIS_PASSWORD,
  otpExpiration: Number(process.env.OTP_EXPIRATION) || 300,
  otpMaxAttempts: Number(process.env.OTP_MAX_ATTEMPTS) || 5,
  resetWindow: Number(process.env.RESET_WINDOW) || 600,
});
```

## 1.5. `src/modules/redis/redis.module.ts` (TẠO MỚI)

`@Global()` → RedisService dùng được mọi nơi không cần import lại.

```ts
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { RedisService } from './redis.service';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        new Redis({
          host: configService.getOrThrow<string>('redisHost'),
          port: configService.getOrThrow<number>('redisPort'),
          password: configService.get<string>('redisPassword') || undefined,
        }),
    },
    RedisService,
  ],
  exports: [RedisService],
})
export class RedisModule {}
```

## 1.6. `src/modules/redis/redis.service.ts` (TẠO MỚI)

Wrapper mỏng, không chứa business logic. `incrWithTTL` atomic, dùng `EXPIRE ... NX`
để window không bị reset mỗi lần sai (cần redis >= 7 — đã chọn `redis:7-alpine`).

```ts
import {
  Inject,
  Injectable,
  OnModuleDestroy,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.module';

@Injectable()
export class RedisService implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  async setWithTTL(key: string, value: string, ttl: number): Promise<void> {
    await this.client.set(key, value, 'EX', ttl);
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  /** Tăng counter + đặt TTL 1 lần (NX), trả về giá trị mới. */
  async incrWithTTL(key: string, ttl: number): Promise<number> {
    const results = await this.client
      .multi()
      .incr(key)
      .expire(key, ttl, 'NX')
      .exec();
    return (results?.[0]?.[1] as number) ?? 0;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
```

## 1.7. `src/app.module.ts` (SỬA — đăng ký config + module)

Thêm import + đưa `RedisConfig` vào `load`, `RedisModule` vào `imports`:

```ts
// thêm cạnh các import config khác (dòng ~13-15)
import RedisConfig from './config/redis.config';
// thêm cạnh import module khác
import { RedisModule } from './modules/redis/redis.module';
```

```ts
    ConfigModule.forRoot({
      isGlobal: true,
      load: [JwtConfig, AwsConfig, RedisConfig],   // + RedisConfig
    }),
```

```ts
    DatabaseModule,
    AuthModule,
    UsersModule,
    EmailModule,
    RedisModule,    // + thêm dòng này
```

---

# PHẦN 2 — TIỆN ÍCH & DTO

## 2.1. `src/common/utils/cryptography.util.ts` (SỬA — thêm hàm cuối file)

`crypto.randomInt` là crypto-secure, không bias.

```ts
export function GenerateNumericOTP(length = 6): string {
  const max = 10 ** length;
  return crypto.randomInt(0, max).toString().padStart(length, '0');
}
```

## 2.2. `src/modules/auth/dto/forgot-password.dto.ts` (TẠO MỚI)

```ts
import { IsEmail, IsNotEmpty } from 'class-validator';

export class ForgotPasswordDTO {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
```

## 2.3. `src/modules/auth/dto/verify-otp.dto.ts` (TẠO MỚI)

```ts
import { IsEmail, IsNotEmpty, IsString, Matches } from 'class-validator';

export class VerifyOtpDTO {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, { message: 'OTP must be 6 digits' })
  otp: string;
}
```

## 2.4. `src/modules/auth/dto/reset-password.dto.ts` (TẠO MỚI)

Field wire-level snake_case (`new_password`, `confirm_password`) khớp convention.
Regex strength **copy nguyên từ RegisterDTO**. `confirm_password` PHẢI khai báo (optional)
vì global ValidationPipe bật `forbidNonWhitelisted: true` — client gửi field lạ → 400.

```ts
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ResetPasswordDTO {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(32)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).+$/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  new_password: string;

  // Client tự so khớp 2 lần nhập; field này chỉ để qua được forbidNonWhitelisted.
  @IsOptional()
  @IsString()
  confirm_password?: string;
}
```

---

# PHẦN 3 — USERS & EMAIL

## 3.1. `src/modules/users/users.service.ts` (SỬA — thêm method, mirror `updateEmailVerifiedByID`)

```ts
  async updatePasswordByID(id: number, passwordHash: string): Promise<void> {
    await this.userRepository.update(id, { passwordHash });
    return;
  }
```

## 3.2. `src/modules/email/email.service.ts` (SỬA — thêm method, inline HTML giống `sendVerificationEmail`)

```ts
  async sendPasswordResetOTP(to: string, otp: string): Promise<void> {
    await this.sesClient.send(
      new SendEmailCommand({
        FromEmailAddress: this.email,
        Destination: { ToAddresses: [to] },
        Content: {
          Simple: {
            Subject: { Data: 'Reset your EatinPal password' },
            Body: {
              Html: {
                Data: `
                  <p>Use the code below to reset your password:</p>
                  <h2 style="letter-spacing:4px;">${otp}</h2>
                  <p>This code expires in 5 minutes. If you didn't request this, ignore this email.</p>
                `,
              },
            },
          },
        },
      }),
    );
  }
```

---

# PHẦN 4 — PASSWORD RESET SERVICE

## 4.1. `src/modules/auth/password-reset.service.ts` (TẠO MỚI)

Service riêng (AuthService đã lớn). Inject `AuthService` chỉ để gọi `logout(userID)`
revoke toàn bộ token — không circular vì AuthService không phụ thuộc ngược.

```ts
import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import {
  BcryptHash,
  GenerateNumericOTP,
  SHA256,
} from '../../common/utils/cryptography.util';
import { EmailService } from '../email/email.service';
import { RedisService } from '../redis/redis.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { ForgotPasswordDTO } from './dto/forgot-password.dto';
import { ResetPasswordDTO } from './dto/reset-password.dto';
import { VerifyOtpDTO } from './dto/verify-otp.dto';

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly usersService: UsersService,
    private readonly emailService: EmailService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {}

  private normalize(email: string): string {
    return email.toLowerCase().trim();
  }

  private otpKey(email: string): string {
    return `otp:reset:${email}`;
  }

  private attemptsKey(email: string): string {
    return `otp:attempts:${email}`;
  }

  private allowedKey(email: string): string {
    return `reset:allowed:${email}`;
  }

  // 1) Gửi OTP. LUÔN trả cùng message generic (chống user-enumeration).
  async requestReset(dto: ForgotPasswordDTO): Promise<any> {
    const email = this.normalize(dto.email);
    const otpExpiration =
      this.configService.getOrThrow<number>('otpExpiration');

    const user = await this.usersService.findOneByEmail(email);

    // Chỉ gửi cho tài khoản local (có passwordHash) và đang active.
    if (user && user.passwordHash && user.isActive) {
      const otp = GenerateNumericOTP(6);
      await this.redisService.setWithTTL(
        this.otpKey(email),
        SHA256(otp),
        otpExpiration,
      );
      await this.redisService.del(this.attemptsKey(email));
      await this.emailService.sendPasswordResetOTP(user.email, otp);
    }

    return { message: 'If an account exists for that email, an OTP has been sent' };
  }

  // 2) Verify OTP → set cờ allowed.
  async verifyOtp(dto: VerifyOtpDTO): Promise<any> {
    const email = this.normalize(dto.email);
    const otpExpiration =
      this.configService.getOrThrow<number>('otpExpiration');
    const maxAttempts =
      this.configService.getOrThrow<number>('otpMaxAttempts');
    const resetWindow = this.configService.getOrThrow<number>('resetWindow');

    const attemptsRaw = await this.redisService.get(this.attemptsKey(email));
    if (attemptsRaw && Number(attemptsRaw) >= maxAttempts) {
      throw new ForbiddenException('Too many attempts, please request a new code');
    }

    const stored = await this.redisService.get(this.otpKey(email));
    if (!stored) {
      throw new UnauthorizedException('Invalid or expired code');
    }

    const provided = SHA256(dto.otp);
    const match = crypto.timingSafeEqual(
      Buffer.from(provided),
      Buffer.from(stored),
    );
    if (!match) {
      await this.redisService.incrWithTTL(
        this.attemptsKey(email),
        otpExpiration,
      );
      throw new UnauthorizedException('Invalid or expired code');
    }

    await this.redisService.del(this.otpKey(email));
    await this.redisService.del(this.attemptsKey(email));
    await this.redisService.setWithTTL(this.allowedKey(email), '1', resetWindow);

    return { message: 'Code verified' };
  }

  // 3) Reset password (đòi cờ allowed).
  async resetPassword(dto: ResetPasswordDTO): Promise<any> {
    const email = this.normalize(dto.email);

    const allowed = await this.redisService.get(this.allowedKey(email));
    if (!allowed) {
      throw new ForbiddenException('Reset session expired, please verify again');
    }

    const user = await this.usersService.findOneByEmail(email);
    if (!user) {
      await this.redisService.del(this.allowedKey(email));
      throw new UnauthorizedException('Invalid or expired code');
    }

    const hash = await BcryptHash(dto.new_password);
    await this.usersService.updatePasswordByID(user.id, hash);
    await this.redisService.del(this.allowedKey(email));

    // Revoke toàn bộ refresh token (logout mọi thiết bị).
    await this.authService.logout(user.id);

    return { message: 'Password has been reset' };
  }
}
```

## 4.2. `src/modules/auth/auth.module.ts` (SỬA — thêm provider)

RedisService inject được nhờ `@Global`; UsersModule/EmailModule đã import sẵn.

```ts
import { PasswordResetService } from './password-reset.service';
```

```ts
  providers: [
    AuthService,
    PasswordResetService,   // + thêm
    LocalStrategy,
    JwtStrategy,
    JwtRefreshStrategy,
  ],
```

## 4.3. `src/modules/auth/auth.controller.ts` (SỬA — inject + 3 endpoint)

Thêm import:

```ts
import { Throttle } from '@nestjs/throttler';
import { ForgotPasswordDTO } from './dto/forgot-password.dto';
import { ResetPasswordDTO } from './dto/reset-password.dto';
import { VerifyOtpDTO } from './dto/verify-otp.dto';
import { PasswordResetService } from './password-reset.service';
```

Đổi constructor (inject thêm service):

```ts
  constructor(
    private authService: AuthService,
    private passwordResetService: PasswordResetService,
  ) {}
```

Thêm 3 endpoint (đặt cạnh `resend`). Tất cả `@Public()` + `@HttpCode(200)`.
`@Throttle` override throttler có tên ('short'/'medium') chỉ trên route này:

```ts
  @Public()
  @Throttle({ short: { limit: 1, ttl: 1000 }, medium: { limit: 3, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDTO) {
    return this.passwordResetService.requestReset(dto);
  }

  @Public()
  @Throttle({ medium: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @Post('verify-otp')
  verifyOtp(@Body() dto: VerifyOtpDTO) {
    return this.passwordResetService.verifyOtp(dto);
  }

  @Public()
  @Throttle({ medium: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDTO) {
    return this.passwordResetService.resetPassword(dto);
  }
```

---

# PHẦN 5 — BẢO MẬT (đã nhúng trong code trên)

- OTP lưu **SHA256, không lưu raw**; so sánh **`crypto.timingSafeEqual`**.
- Brute-force: counter Redis (`OTP_MAX_ATTEMPTS`) + `@Throttle` per-route.
- Chống enumeration: `forgot-password` luôn trả 1 message; `verify-otp` 1 message cho mọi case sai/hết hạn.
- One-time: xoá OTP khi đúng, xoá cờ sau reset, TTL ngắn.
- Reset xong revoke toàn bộ refresh token.
- OAuth-only (passwordHash null) / inactive → bỏ qua im lặng ở bước request.
- KHÔNG gate theo `emailVerified` (user có thể cần reset trước khi verify).

---

# PHẦN 6 — KIỂM THỬ

## 6.1. Manual (curl)

```bash
pnpm install
docker compose up -d            # postgres + redis
# set REDIS_*, OTP_* trong .env
pnpm start:dev

# 1) request OTP — luôn 200 generic
curl -X POST localhost:3000/auth/forgot-password \
  -H 'Content-Type: application/json' -d '{"email":"u@x.com"}'

# soi Redis
docker compose exec redis redis-cli -a "$REDIS_PASSWORD" KEYS 'otp:*'
docker compose exec redis redis-cli -a "$REDIS_PASSWORD" TTL 'otp:reset:u@x.com'   # ~300

# 2) verify sai → 401, counter tăng; đạt max → 403
curl -X POST localhost:3000/auth/verify-otp \
  -H 'Content-Type: application/json' -d '{"email":"u@x.com","otp":"000000"}'

# 2b) verify đúng (lấy OTP từ email) → 200; otp:reset:* mất, reset:allowed:* xuất hiện ~600
curl -X POST localhost:3000/auth/verify-otp \
  -H 'Content-Type: application/json' -d '{"email":"u@x.com","otp":"<MÃ THẬT>"}'

# 3) reset → 200; cờ bị xoá, login mật khẩu mới OK, refresh token cũ fail
curl -X POST localhost:3000/auth/reset-password \
  -H 'Content-Type: application/json' \
  -d '{"email":"u@x.com","new_password":"NewP@ss1","confirm_password":"NewP@ss1"}'
```

Negative: reset khi chưa verify → 403; chờ quá `RESET_WINDOW` → 403.

## 6.2. Unit test — `src/modules/auth/password-reset.service.spec.ts` (TẠO MỚI, tuỳ chọn)

Mock `RedisService`, `UsersService`, `EmailService`, `AuthService`, `ConfigService`. Cover:
- email lạ → message generic giống hệt, **không** gọi `sendPasswordResetOTP`.
- OTP sai → `incrWithTTL` được gọi, throw `UnauthorizedException`.
- counter >= max → throw `ForbiddenException`, không đọc OTP.
- verify đúng → `del(otp)` + `del(attempts)` + `setWithTTL(allowed)`.
- reset không có cờ → throw `ForbiddenException`.
- reset thành công → `updatePasswordByID` + `authService.logout(id)` + `del(allowed)`.

Chạy: `pnpm test`.

---

## Ghi chú ngoài scope
- Script `test:e2e` trỏ `./test/jest-e2e.json` nhưng config thực ở `test/e2e/jest-e2e.json` — lệch path, báo team, không sửa trong feature này.
