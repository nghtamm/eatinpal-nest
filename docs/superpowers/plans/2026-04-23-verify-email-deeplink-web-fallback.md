# Verify-email deeplink + web/mobile fallback — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change `GET /auth/verify` to serve a platform-aware HTML page for browsers while keeping JSON for API clients; chain `verify → verified-login` on the Flutter side so same-device deeplink flow works; add a `HOME` route for the post-login destination.

**Architecture:** Nest `auth.controller` branches on the `Accept` header — `application/json` returns the existing JSON shape (Flutter consumes this); anything else returns HTML that runs JS detecting the user agent (mobile → redirect to store homepage; desktop → `alert(message)` then `window.close()`). The Flutter `AuthBloc._onVerifiedLogin` handler now calls `verify` before `verified-login` so the same-device App Links / Universal Links flow (OS intercepts before backend is ever hit) marks the user verified before logging in.

**Tech Stack:** NestJS 11, Express, TypeORM, Flutter 3.41+, `flutter_bloc`, `go_router`, `fpdart`, `get_it`, `dio`.

**Reference:** Spec at `docs/superpowers/specs/2026-04-23-verify-email-deeplink-web-fallback-design.md`.

**Commits:** The user commits their own changes. Do not run `git commit` or stage files with the intent to commit at any step in this plan.

**Note on deviation from spec:** Spec proposed a new `AuthVerifyRequested` event chained by the page; this plan instead extends the existing `AuthVerifiedLoginRequested` handler inside `AuthBloc` to do verify-then-login internally. This is simpler (no new event, no changes to the two dispatch sites in `verify_email_page` and `verification_success_page`), preserves the endpoint separation decision, and does not change observable behavior.

---

## File map

### Nest
| File | Action |
|---|---|
| `eatinpal-nest/src/modules/auth/utils/verify-page.html.ts` | create — HTML template function |
| `eatinpal-nest/src/modules/auth/auth.controller.ts` | modify `verify` handler — Accept-based branch |
| `eatinpal-nest/src/modules/auth/auth.controller.spec.ts` | create — unit test both branches |

### Flutter
| File | Action |
|---|---|
| `eatinpal-flutter/lib/modules/auth/presentation/pages/homepage.dart` | create — scaffold placeholder |
| `eatinpal-flutter/lib/app/router/route_names.dart` | add `HOME` |
| `eatinpal-flutter/lib/app/router/app_router.dart` | add `HOME` route; enable signed-user guard |
| `eatinpal-flutter/lib/modules/auth/auth.dart` | export new files |
| `eatinpal-flutter/lib/core/network/api_endpoints.dart` | add `VERIFY` |
| `eatinpal-flutter/lib/modules/auth/domain/entities/verify_result_entity.dart` | create |
| `eatinpal-flutter/lib/modules/auth/data/models/verify_result_model.dart` | create (freezed) |
| `eatinpal-flutter/lib/modules/auth/data/services/auth_service.dart` | add `verify(...)` |
| `eatinpal-flutter/lib/modules/auth/domain/repository/auth_repository.dart` | add abstract `verify()` |
| `eatinpal-flutter/lib/modules/auth/data/repository/auth_repository_impl.dart` | add `verify()` impl |
| `eatinpal-flutter/lib/modules/auth/domain/usecases/verify_usecase.dart` | create |
| `eatinpal-flutter/lib/core/di/service_locator.dart` | register `VerifyUseCase`; inject into `AuthBloc` |
| `eatinpal-flutter/lib/modules/auth/presentation/bloc/auth_bloc.dart` | inject `VerifyUseCase`; extend `_onVerifiedLogin` to chain |
| `eatinpal-flutter/lib/modules/auth/presentation/pages/verification_success_page.dart` | nav target `WELCOME` → `HOME` |

---

## Tasks

### Task 1: Nest — HTML template helper

**Files:**
- Create: `eatinpal-nest/src/modules/auth/utils/verify-page.html.ts`

- [ ] **Step 1.1: Create the helper file**

```ts
// eatinpal-nest/src/modules/auth/utils/verify-page.html.ts

const PLAY_STORE_URL = 'https://play.google.com/store';
const APP_STORE_URL = 'https://apps.apple.com';

export function renderVerifyPage(message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>EatinPal</title>
</head>
<body>
<script>
(function () {
  var msg = ${JSON.stringify(message)};
  var playStore = ${JSON.stringify(PLAY_STORE_URL)};
  var appStore = ${JSON.stringify(APP_STORE_URL)};
  var ua = navigator.userAgent || '';
  if (/Android/i.test(ua))          { window.location.replace(playStore); return; }
  if (/iPhone|iPad|iPod/i.test(ua)) { window.location.replace(appStore); return; }
  alert(msg);
  window.close();
})();
</script>
</body>
</html>`;
}
```

- [ ] **Step 1.2: Sanity-check**

Run: `cd eatinpal-nest && pnpm lint`
Expected: no new lint errors.

---

### Task 2: Nest — Controller content negotiation

**Files:**
- Modify: `eatinpal-nest/src/modules/auth/auth.controller.ts:68-76`

- [ ] **Step 2.1: Replace the `verify` handler**

Replace the entire existing handler block (lines 68-76) with the version below. Also ensure imports include `Response` from `express`, `UnauthorizedException` from `@nestjs/common`, and `renderVerifyPage`:

At the top of the file, ensure imports:

```ts
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { Serialize } from '../../common/decorators/serialize.decorator';
import { User } from '../users/entities/user.entity';
import { AuthService } from './auth.service';
import { GetUser } from './decorators/user.decorator';
import { RegisterDTO } from './dto/register.dto';
import { AuthResponseDTO } from './dto/response/auth-response.dto';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { LocalAuthGuard } from './guards/local.guard';
import { renderVerifyPage } from './utils/verify-page.html';
```

Replace the `verify` handler with:

```ts
@Public()
@Get('verify')
async verify(
  @Query('token') verificationToken: string,
  @Headers('accept') accept: string,
  @Res() res: Response,
) {
  const wantsJson = (accept || '').includes('application/json');

  let message: string;
  let statusCode = HttpStatus.OK;

  try {
    const result = await this.authService.verify(verificationToken);
    message = result.message;

    if (wantsJson) {
      return res.status(statusCode).json({
        status_code: statusCode,
        message,
        data: { verified: result.verified },
      });
    }
  } catch (err) {
    if (wantsJson) {
      // Re-throw so HttpExceptionFilter formats the JSON error envelope
      throw err;
    }
    message =
      err instanceof UnauthorizedException
        ? 'Invalid or expired verification link'
        : 'Something went wrong verifying your email';
  }

  return res
    .status(HttpStatus.OK)
    .type('text/html')
    .send(renderVerifyPage(message));
}
```

Notes:
- The handler uses `@Res()` which bypasses the global `ResponseInterceptor`. For the JSON branch we reconstruct the `{status_code, message, data}` envelope manually to stay consistent with other endpoints.
- HTML branch always returns HTTP 200; error messaging is embedded in the alert text (the user-facing surface is the alert, not the status code).
- The old signature already had `@Headers('user-agent')` — remove that; it is no longer needed.

- [ ] **Step 2.2: Build check**

Run: `cd eatinpal-nest && pnpm lint && pnpm build`
Expected: no lint errors, build succeeds.

- [ ] **Step 2.3: Manual smoke test (optional)**

Start the dev server in a side terminal: `cd eatinpal-nest && pnpm start:dev`

Generate a valid verification token (e.g. register a new user via `POST /auth/register`, grab `verification_token` from the response), then:

```bash
# HTML branch
curl -i 'http://localhost:3000/auth/verify?token=<VALID_TOKEN>'
# Expect: 200, Content-Type: text/html, body contains "Verification successful" and the two store URLs

# JSON branch
curl -i -H 'Accept: application/json' 'http://localhost:3000/auth/verify?token=<VALID_TOKEN>'
# Expect: 200, JSON envelope { status_code: 200, message: "...", data: { verified: true|false } }

# JSON error branch
curl -i -H 'Accept: application/json' 'http://localhost:3000/auth/verify?token=INVALID'
# Expect: 401, JSON envelope { status_code: 401, message: "Invalid or expired token" }

# HTML error branch
curl -i 'http://localhost:3000/auth/verify?token=INVALID'
# Expect: 200, HTML body contains "Invalid or expired verification link"
```

Skip this step if running the server locally isn't available; Task 3 covers the same cases with unit tests.

---

### Task 3: Nest — Controller unit test

**Files:**
- Create: `eatinpal-nest/src/modules/auth/auth.controller.spec.ts`

- [ ] **Step 3.1: Write the failing test**

This is the first `*.spec.ts` in the repo. The test mocks `AuthService.verify` and builds the controller directly (no TestingModule/DI scan needed) to keep the spec tight.

```ts
// eatinpal-nest/src/modules/auth/auth.controller.spec.ts

import { HttpStatus, UnauthorizedException } from '@nestjs/common';
import { Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

function mockResponse(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.type = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res as Response;
}

describe('AuthController#verify', () => {
  let controller: AuthController;
  let authService: jest.Mocked<Pick<AuthService, 'verify'>>;

  beforeEach(() => {
    authService = { verify: jest.fn() };
    controller = new AuthController(authService as unknown as AuthService);
  });

  describe('Accept: application/json', () => {
    it('returns JSON envelope on success', async () => {
      authService.verify.mockResolvedValue({
        message: 'Verification successful',
        verified: false,
      });
      const res = mockResponse();

      await controller.verify('TOKEN', 'application/json', res);

      expect(authService.verify).toHaveBeenCalledWith('TOKEN');
      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(res.json).toHaveBeenCalledWith({
        status_code: HttpStatus.OK,
        message: 'Verification successful',
        data: { verified: false },
      });
      expect(res.send).not.toHaveBeenCalled();
    });

    it('re-throws UnauthorizedException so the exception filter formats it', async () => {
      authService.verify.mockRejectedValue(
        new UnauthorizedException('Invalid or expired token'),
      );
      const res = mockResponse();

      await expect(
        controller.verify('BAD', 'application/json', res),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('Accept: text/html (or missing)', () => {
    it('renders HTML with the service message on success', async () => {
      authService.verify.mockResolvedValue({
        message: 'Email is already verified',
        verified: true,
      });
      const res = mockResponse();

      await controller.verify('TOKEN', 'text/html', res);

      expect(res.type).toHaveBeenCalledWith('text/html');
      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
      const html = (res.send as jest.Mock).mock.calls[0][0] as string;
      expect(html).toContain(JSON.stringify('Email is already verified'));
      expect(html).toContain(JSON.stringify('https://play.google.com/store'));
      expect(html).toContain(JSON.stringify('https://apps.apple.com'));
    });

    it('renders HTML with a friendly message on UnauthorizedException', async () => {
      authService.verify.mockRejectedValue(
        new UnauthorizedException('Invalid or expired token'),
      );
      const res = mockResponse();

      await controller.verify('BAD', 'text/html', res);

      expect(res.type).toHaveBeenCalledWith('text/html');
      const html = (res.send as jest.Mock).mock.calls[0][0] as string;
      expect(html).toContain(
        JSON.stringify('Invalid or expired verification link'),
      );
    });

    it('treats missing Accept header as HTML', async () => {
      authService.verify.mockResolvedValue({
        message: 'Verification successful',
        verified: false,
      });
      const res = mockResponse();

      await controller.verify('TOKEN', '', res);

      expect(res.type).toHaveBeenCalledWith('text/html');
      expect(res.json).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 3.2: Run tests — expect FAIL before Task 2 is applied; PASS if Task 2 is already applied**

Run: `cd eatinpal-nest && pnpm test --testPathPattern auth.controller`

If Task 2 hasn't been applied yet: FAIL (handler signature doesn't accept those args / doesn't return HTML).

After Task 2 is applied: expect all 5 tests to PASS.

---

### Task 4: Flutter — `HomePage` scaffold

**Files:**
- Create: `eatinpal-flutter/lib/modules/auth/presentation/pages/homepage.dart`
- Modify: `eatinpal-flutter/lib/modules/auth/auth.dart`

- [ ] **Step 4.1: Create the page**

```dart
// eatinpal-flutter/lib/modules/auth/presentation/pages/homepage.dart

import 'package:flutter/material.dart';
import 'package:eatinpal/core/constants/app_colors.dart';
import 'package:eatinpal/core/constants/app_typography.dart';

class HomePage extends StatelessWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.NEUTRAL_95,
      appBar: AppBar(
        backgroundColor: AppColors.NEUTRAL_95,
        title: Text('Home', style: AppTypography.BODY_LARGE),
      ),
      body: Center(
        child: Text(
          'Welcome to EatinPal',
          style: AppTypography.DISPLAY_LARGE.copyWith(fontSize: 32),
        ),
      ),
    );
  }
}
```

Note: if any of the referenced constants do not exist (`AppColors.NEUTRAL_95`, `AppTypography.BODY_LARGE`, `AppTypography.DISPLAY_LARGE`), fall back to `Theme.of(context).textTheme` and `Colors.grey.shade200`. Open `lib/core/constants/app_colors.dart` and `app_typography.dart` to confirm; they were used in `verification_success_page.dart` so they exist.

- [ ] **Step 4.2: Export via barrel**

Modify `eatinpal-flutter/lib/modules/auth/auth.dart` — add this line to the `[PRESENTATION]` section (after the `verification_success_page.dart` export):

```dart
export 'presentation/pages/homepage.dart';
```

---

### Task 5: Flutter — Add `HOME` route + enable guard

**Files:**
- Modify: `eatinpal-flutter/lib/app/router/route_names.dart`
- Modify: `eatinpal-flutter/lib/app/router/app_router.dart`

- [ ] **Step 5.1: Add `HOME` to `RouteNames` and `RoutePaths`**

Replace the contents of `eatinpal-flutter/lib/app/router/route_names.dart`:

```dart
abstract final class RouteNames {
  static const String WELCOME = 'welcome';
  static const String REGISTER = 'register';
  static const String LOGIN = 'login';
  static const String VERIFY_EMAIL = 'verify_email';
  static const String VERIFICATION_SUCCESS = 'verification_success';
  static const String HOME = 'home';
}

abstract final class RoutePaths {
  static const String WELCOME = '/welcome';
  static const String REGISTER = '/register';
  static const String LOGIN = '/login';
  static const String VERIFY_EMAIL = '/verify-email';
  static const String VERIFICATION_SUCCESS = '/verification-success';
  static const String HOME = '/home';
}
```

- [ ] **Step 5.2: Register the route and enable the signed-user guard**

Replace the contents of `eatinpal-flutter/lib/app/router/app_router.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:eatinpal/app/router/route_names.dart';
import 'package:eatinpal/core/di/service_locator.dart';
import 'package:eatinpal/core/local/local_storage.dart';
import 'package:eatinpal/modules/auth/auth.dart';

final navigatorKey = GlobalKey<NavigatorState>();

GoRouter router() {
  return GoRouter(
    navigatorKey: navigatorKey,
    initialLocation: RoutePaths.WELCOME,
    debugLogDiagnostics: true,
    redirect: _guard,
    routes: [
      GoRoute(
        path: RoutePaths.WELCOME,
        name: RouteNames.WELCOME,
        builder: (_, _) => const AuthenticationPage(),
      ),
      GoRoute(
        path: RoutePaths.REGISTER,
        name: RouteNames.REGISTER,
        builder: (_, _) => const RegisterPage(),
      ),
      GoRoute(
        path: RoutePaths.LOGIN,
        name: RouteNames.LOGIN,
        builder: (_, _) => const LoginPage(),
      ),
      GoRoute(
        path: RoutePaths.VERIFY_EMAIL,
        name: RouteNames.VERIFY_EMAIL,
        builder: (_, state) =>
            VerifyEmailPage(email: state.extra as String?),
      ),
      GoRoute(
        path: RoutePaths.VERIFICATION_SUCCESS,
        name: RouteNames.VERIFICATION_SUCCESS,
        builder: (_, state) =>
            VerificationSuccessPage(token: state.extra as String?),
      ),
      GoRoute(
        path: RoutePaths.HOME,
        name: RouteNames.HOME,
        builder: (_, _) => const HomePage(),
      ),
    ],
  );
}

Future<String?> _guard(BuildContext context, GoRouterState state) async {
  final storage = sl<LocalStorage>();
  final signed = await storage.signed;

  final location = state.matchedLocation;
  final destSplash = location == RoutePaths.WELCOME;
  final destAuth =
      location == RoutePaths.WELCOME ||
      location == RoutePaths.REGISTER ||
      location == RoutePaths.LOGIN ||
      location == RoutePaths.VERIFY_EMAIL ||
      location == RoutePaths.VERIFICATION_SUCCESS;

  if (destSplash) return signed ? RoutePaths.HOME : RoutePaths.WELCOME;
  if (!signed && !destAuth) return RoutePaths.WELCOME;
  if (signed && destAuth) return RoutePaths.HOME;

  return null;
}
```

Notes:
- `destSplash` previously returned `WELCOME` in both branches (effectively a no-op); now it redirects signed users to `HOME`.
- `destAuth` intentionally does **not** include `HOME`.
- `HomePage` is imported via the auth barrel `eatinpal/modules/auth/auth.dart` (Task 4.2 added the export).

- [ ] **Step 5.3: Analyzer check**

Run: `cd eatinpal-flutter && fvm flutter analyze`
Expected: 0 new errors.

---

### Task 6: Flutter — Add `VERIFY` endpoint + `VerifyResult` entity/model

**Files:**
- Modify: `eatinpal-flutter/lib/core/network/api_endpoints.dart`
- Create: `eatinpal-flutter/lib/modules/auth/domain/entities/verify_result_entity.dart`
- Create: `eatinpal-flutter/lib/modules/auth/data/models/verify_result_model.dart`
- Modify: `eatinpal-flutter/lib/modules/auth/auth.dart`

- [ ] **Step 6.1: Add `VERIFY` endpoint**

Replace the contents of `eatinpal-flutter/lib/core/network/api_endpoints.dart`:

```dart
import 'package:flutter_dotenv/flutter_dotenv.dart';

abstract final class ApiEndpoints {
  static String get BASE_URL =>
      dotenv.env['BASE_URL'] ?? 'http://localhost:3000';

  // Auth
  static const String LOGIN = '/auth/login';
  static const String REGISTER = '/auth/register';
  static const String REFRESH = '/auth/refresh';
  static const String RESEND_VERIFICATION = '/auth/resend-verification';
  static const String VERIFY = '/auth/verify';
  static const String VERIFIED_LOGIN = '/auth/verified-login';
}
```

- [ ] **Step 6.2: Create the entity**

```dart
// eatinpal-flutter/lib/modules/auth/domain/entities/verify_result_entity.dart

import 'package:equatable/equatable.dart';

class VerifyResultEntity extends Equatable {
  final bool verified;

  const VerifyResultEntity({required this.verified});

  @override
  List<Object?> get props => [verified];
}
```

- [ ] **Step 6.3: Create the freezed model**

```dart
// eatinpal-flutter/lib/modules/auth/data/models/verify_result_model.dart

import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:eatinpal/modules/auth/domain/entities/verify_result_entity.dart';

part 'verify_result_model.freezed.dart';
part 'verify_result_model.g.dart';

@freezed
abstract class VerifyResultModel extends VerifyResultEntity
    with _$VerifyResultModel {
  const VerifyResultModel._() : super(verified: false);

  const factory VerifyResultModel({required bool verified}) =
      _VerifyResultModel;

  factory VerifyResultModel.fromJson(Map<String, dynamic> json) =>
      _$VerifyResultModelFromJson(json);
}
```

- [ ] **Step 6.4: Run codegen**

Run: `cd eatinpal-flutter && fvm dart run build_runner build --delete-conflicting-outputs`
Expected: `verify_result_model.freezed.dart` and `verify_result_model.g.dart` generated, no errors.

- [ ] **Step 6.5: Export via barrel**

Modify `eatinpal-flutter/lib/modules/auth/auth.dart`:

In the `[DOMAIN]` section, after `user_entity.dart`:
```dart
export 'domain/entities/verify_result_entity.dart';
```

In the `[DATA]` section, after `tokens_model.dart`:
```dart
export 'data/models/verify_result_model.dart';
```

(Keep other exports untouched.)

- [ ] **Step 6.6: Analyzer check**

Run: `cd eatinpal-flutter && fvm flutter analyze`
Expected: 0 new errors.

---

### Task 7: Flutter — Add `verify()` to service, repository, and usecase

**Files:**
- Modify: `eatinpal-flutter/lib/modules/auth/data/services/auth_service.dart`
- Modify: `eatinpal-flutter/lib/modules/auth/domain/repository/auth_repository.dart`
- Modify: `eatinpal-flutter/lib/modules/auth/data/repository/auth_repository_impl.dart`
- Create: `eatinpal-flutter/lib/modules/auth/domain/usecases/verify_usecase.dart`
- Modify: `eatinpal-flutter/lib/modules/auth/auth.dart`

- [ ] **Step 7.1: Add `verify()` to `AuthService`**

Replace the contents of `eatinpal-flutter/lib/modules/auth/data/services/auth_service.dart`:

```dart
import 'package:dio/dio.dart';
import 'package:fpdart/fpdart.dart';
import 'package:eatinpal/core/network/api_client.dart';
import 'package:eatinpal/core/network/api_endpoints.dart';
import 'package:eatinpal/core/network/api_methods.dart';
import 'package:eatinpal/core/network/api_result.dart';
import 'package:eatinpal/core/network/exceptions.dart';
import 'package:eatinpal/modules/auth/data/models/tokens_model.dart';
import 'package:eatinpal/modules/auth/data/models/user_model.dart';
import 'package:eatinpal/modules/auth/data/models/verify_result_model.dart';

typedef LoginResponse = ({UserModel user, TokensModel tokens});

class AuthService {
  final ApiClient _client;

  const AuthService(this._client);

  Future<Either<AppException, ApiResult<LoginResponse>>> login({
    required String email,
    required String password,
  }) {
    return _client.request(
      endpoint: ApiEndpoints.LOGIN,
      method: RestMethod.POST,
      data: {'email': email, 'password': password},
      parser: (data) {
        final map = data as Map<String, dynamic>;
        return (
          user: UserModel.fromJson(map['user'] as Map<String, dynamic>),
          tokens: TokensModel.fromJson(map['tokens'] as Map<String, dynamic>),
        );
      },
    );
  }

  Future<Either<AppException, ApiResult<String>>> register({
    required String email,
    required String password,
    required String name,
  }) {
    return _client.request(
      endpoint: ApiEndpoints.REGISTER,
      method: RestMethod.POST,
      data: {'email': email, 'password': password, 'name': name},
      parser: (data) =>
          (data as Map<String, dynamic>)['verification_token'] as String,
    );
  }

  Future<Either<AppException, ApiResult<String>>> resendVerification({
    required String email,
  }) {
    return _client.request(
      endpoint: ApiEndpoints.RESEND_VERIFICATION,
      method: RestMethod.POST,
      data: {'email': email},
      parser: (data) =>
          (data as Map<String, dynamic>)['verification_token'] as String,
    );
  }

  Future<Either<AppException, ApiResult<VerifyResultModel>>> verify({
    required String verificationToken,
  }) {
    return _client.request(
      endpoint: ApiEndpoints.VERIFY,
      method: RestMethod.GET,
      query: {'token': verificationToken},
      headers: {Headers.acceptHeader: Headers.jsonContentType},
      parser: (data) =>
          VerifyResultModel.fromJson(data as Map<String, dynamic>),
    );
  }

  Future<Either<AppException, ApiResult<LoginResponse>>> verifiedLogin({
    required String verificationToken,
  }) {
    return _client.request(
      endpoint: ApiEndpoints.VERIFIED_LOGIN,
      method: RestMethod.POST,
      data: {'verification_token': verificationToken},
      parser: (data) {
        final map = data as Map<String, dynamic>;
        return (
          user: UserModel.fromJson(map['user'] as Map<String, dynamic>),
          tokens: TokensModel.fromJson(map['tokens'] as Map<String, dynamic>),
        );
      },
    );
  }
}
```

Notes:
- `Headers.acceptHeader` and `Headers.jsonContentType` come from `package:dio/dio.dart` — constants `'accept'` and `'application/json'`.
- The explicit `Accept: application/json` header is what tells the Nest controller to return the JSON envelope (Task 2).
- The dio default `contentType: Headers.jsonContentType` already sets `Content-Type`, but doesn't set `Accept` — so we set it explicitly.

- [ ] **Step 7.2: Add `verify()` to `AuthRepository` abstract**

Replace the contents of `eatinpal-flutter/lib/modules/auth/domain/repository/auth_repository.dart`:

```dart
import 'package:fpdart/fpdart.dart';
import 'package:eatinpal/core/network/exceptions.dart';

abstract class AuthRepository {
  Future<Either<AppException, String>> login({
    required String email,
    required String password,
  });

  Future<Either<AppException, String>> register({
    required String email,
    required String password,
    required String name,
  });

  Future<Either<AppException, String>> resendVerification({
    required String email,
  });

  Future<Either<AppException, String>> verify();

  Future<Either<AppException, String>> verifiedLogin();
}
```

- [ ] **Step 7.3: Add `verify()` to `AuthRepositoryImpl`**

Replace the contents of `eatinpal-flutter/lib/modules/auth/data/repository/auth_repository_impl.dart`:

```dart
import 'dart:convert';

import 'package:fpdart/fpdart.dart';
import 'package:eatinpal/core/local/local_storage.dart';
import 'package:eatinpal/core/network/exceptions.dart';
import 'package:eatinpal/modules/auth/data/services/auth_service.dart';
import 'package:eatinpal/modules/auth/domain/repository/auth_repository.dart';

class AuthRepositoryImpl implements AuthRepository {
  final AuthService _service;
  final LocalStorage _storage;

  const AuthRepositoryImpl(this._service, this._storage);

  @override
  Future<Either<AppException, String>> login({
    required String email,
    required String password,
  }) async {
    final result = await _service.login(email: email, password: password);

    return result.fold((left) async => Left(left), (right) async {
      await _storage.saveCredentialsToken(
        accessToken: right.data.tokens.accessToken,
        refreshToken: right.data.tokens.refreshToken,
      );

      final userJSON = jsonEncode(right.data.user.toJson());
      await _storage.saveUser(userJSON);

      return Right(right.message);
    });
  }

  @override
  Future<Either<AppException, String>> register({
    required String email,
    required String password,
    required String name,
  }) async {
    final result = await _service.register(
      email: email,
      password: password,
      name: name,
    );

    return result.fold((left) async => Left(left), (right) async {
      await _storage.saveVerificationToken(right.data);
      return Right(right.message);
    });
  }

  @override
  Future<Either<AppException, String>> resendVerification({
    required String email,
  }) async {
    final result = await _service.resendVerification(email: email);

    return result.fold((left) async => Left(left), (right) async {
      await _storage.saveVerificationToken(right.data);
      return Right(right.message);
    });
  }

  @override
  Future<Either<AppException, String>> verify() async {
    final token = await _storage.verificationToken;
    final result = await _service.verify(verificationToken: token ?? '');

    return result.fold(
      (left) async => Left(left),
      (right) async => Right(right.message),
    );
  }

  @override
  Future<Either<AppException, String>> verifiedLogin() async {
    final token = await _storage.verificationToken;
    final result = await _service.verifiedLogin(verificationToken: token ?? '');

    return result.fold((left) async => Left(left), (right) async {
      await _storage.saveCredentialsToken(
        accessToken: right.data.tokens.accessToken,
        refreshToken: right.data.tokens.refreshToken,
      );

      final userJSON = jsonEncode(right.data.user.toJson());
      await _storage.saveUser(userJSON);

      await _storage.clearVerificationToken();

      return Right(right.message);
    });
  }
}
```

- [ ] **Step 7.4: Create `VerifyUseCase`**

```dart
// eatinpal-flutter/lib/modules/auth/domain/usecases/verify_usecase.dart

import 'package:fpdart/fpdart.dart';
import 'package:eatinpal/core/network/exceptions.dart';
import 'package:eatinpal/core/usecase/usecase.dart';
import 'package:eatinpal/modules/auth/domain/repository/auth_repository.dart';

class VerifyUseCase extends UseCaseNoParams<String> {
  final AuthRepository _repository;

  VerifyUseCase(this._repository);

  @override
  Future<Either<AppException, String>> call() {
    return _repository.verify();
  }
}
```

- [ ] **Step 7.5: Export usecase via barrel**

Modify `eatinpal-flutter/lib/modules/auth/auth.dart` — add in the `[DOMAIN]` section (near other usecases):

```dart
export 'domain/usecases/verify_usecase.dart';
```

- [ ] **Step 7.6: Analyzer check**

Run: `cd eatinpal-flutter && fvm flutter analyze`
Expected: 0 new errors.

---

### Task 8: Flutter — Register `VerifyUseCase` in DI and inject into `AuthBloc`

**Files:**
- Modify: `eatinpal-flutter/lib/core/di/service_locator.dart`

- [ ] **Step 8.1: Update DI registration**

Replace `_initAuth()` in `eatinpal-flutter/lib/core/di/service_locator.dart`:

```dart
void _initAuth() {
  // Services
  sl.registerLazySingleton(() => AuthService(sl<ApiClient>()));

  // Repositories
  sl.registerLazySingleton<AuthRepository>(
    () => AuthRepositoryImpl(sl<AuthService>(), sl<LocalStorage>()),
  );

  // Usecases
  sl.registerLazySingleton(() => LoginUseCase(sl<AuthRepository>()));
  sl.registerLazySingleton(() => RegisterUseCase(sl<AuthRepository>()));
  sl.registerLazySingleton(
    () => ResendVerificationUseCase(sl<AuthRepository>()),
  );
  sl.registerLazySingleton(() => VerifyUseCase(sl<AuthRepository>()));
  sl.registerLazySingleton(() => VerifiedLoginUseCase(sl<AuthRepository>()));

  // Blocs
  sl.registerFactory(
    () => AuthBloc(
      register: sl<RegisterUseCase>(),
      login: sl<LoginUseCase>(),
      resendVerification: sl<ResendVerificationUseCase>(),
      verify: sl<VerifyUseCase>(),
      verifiedLogin: sl<VerifiedLoginUseCase>(),
    ),
  );
}
```

- [ ] **Step 8.2: Analyzer check (will show a compile error until Task 9 adjusts `AuthBloc`)**

Run: `cd eatinpal-flutter && fvm flutter analyze`
Expected: an error about `AuthBloc` not accepting a `verify:` parameter. This is fine — Task 9 fixes it.

---

### Task 9: Flutter — Extend `AuthBloc._onVerifiedLogin` to chain verify → verified-login

**Files:**
- Modify: `eatinpal-flutter/lib/modules/auth/presentation/bloc/auth_bloc.dart`

- [ ] **Step 9.1: Update `AuthBloc`**

Replace the contents of `eatinpal-flutter/lib/modules/auth/presentation/bloc/auth_bloc.dart`:

```dart
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:eatinpal/core/network/exceptions.dart';
import 'package:eatinpal/modules/auth/domain/usecases/login_usecase.dart';
import 'package:eatinpal/modules/auth/domain/usecases/register_usecase.dart';
import 'package:eatinpal/modules/auth/domain/usecases/resend_verification_usecase.dart';
import 'package:eatinpal/modules/auth/domain/usecases/verified_login_usecase.dart';
import 'package:eatinpal/modules/auth/domain/usecases/verify_usecase.dart';
import 'package:eatinpal/modules/auth/presentation/bloc/auth_event.dart';
import 'package:eatinpal/modules/auth/presentation/bloc/auth_state.dart';

class AuthBloc extends Bloc<AuthEvent, AuthState> {
  final RegisterUseCase _register;
  final LoginUseCase _login;
  final ResendVerificationUseCase _resendVerification;
  final VerifyUseCase _verify;
  final VerifiedLoginUseCase _verifiedLogin;

  AuthBloc({
    required RegisterUseCase register,
    required LoginUseCase login,
    required ResendVerificationUseCase resendVerification,
    required VerifyUseCase verify,
    required VerifiedLoginUseCase verifiedLogin,
  }) : _register = register,
       _login = login,
       _resendVerification = resendVerification,
       _verify = verify,
       _verifiedLogin = verifiedLogin,
       super(const AuthInitial()) {
    on<AuthRegisterSubmitted>(_onRegister);
    on<AuthLoginSubmitted>(_onLogin);
    on<AuthResendVerificationRequested>(_onResendVerification);
    on<AuthVerifiedLoginRequested>(_onVerifiedLogin);
  }

  Future<void> _onRegister(
    AuthRegisterSubmitted event,
    Emitter<AuthState> emit,
  ) async {
    emit(const AuthLoading());
    final result = await _register(
      RegisterParams(
        email: event.email,
        password: event.password,
        name: event.name,
      ),
    );
    result.fold(
      (left) => emit(AuthFailure(left.message)),
      (right) => emit(AuthSuccess(right)),
    );
  }

  Future<void> _onLogin(
    AuthLoginSubmitted event,
    Emitter<AuthState> emit,
  ) async {
    emit(const AuthLoading());
    final result = await _login(
      LoginParams(email: event.email, password: event.password),
    );
    result.fold((left) {
      if (left is ForbiddenException) {
        emit(AuthRequiresVerification(left.message));
      } else {
        emit(AuthFailure(left.message));
      }
    }, (right) => emit(AuthSuccess(right)));
  }

  Future<void> _onResendVerification(
    AuthResendVerificationRequested event,
    Emitter<AuthState> emit,
  ) async {
    emit(const AuthInitial());
    final result = await _resendVerification(
      ResendVerificationParams(email: event.email),
    );
    result.fold(
      (left) => emit(AuthFailure(left.message)),
      (right) => emit(AuthSuccess(right)),
    );
  }

  Future<void> _onVerifiedLogin(
    AuthVerifiedLoginRequested event,
    Emitter<AuthState> emit,
  ) async {
    emit(const AuthLoading());

    final verifyResult = await _verify();
    final verifyFailure = verifyResult.fold<AppException?>(
      (left) => left,
      (_) => null,
    );
    if (verifyFailure != null) {
      emit(AuthFailure(verifyFailure.message));
      return;
    }

    final loginResult = await _verifiedLogin();
    loginResult.fold(
      (left) => emit(AuthFailure(left.message)),
      (right) => emit(AuthSuccess(right)),
    );
  }
}
```

Notes:
- `_onVerifiedLogin` first runs `_verify()`. If verify fails → emit `AuthFailure` with the server message and stop. If verify succeeds → proceed with `_verifiedLogin()`.
- The pattern `verifyResult.fold<AppException?>((l) => l, (_) => null)` extracts the error without re-handling the right branch (avoids a nested emit).
- `ResendVerificationParams(email: ...)` matches the existing bloc. If the usecase file defines a positional constructor instead, adjust to match.

- [ ] **Step 9.2: Analyzer check**

Run: `cd eatinpal-flutter && fvm flutter analyze`
Expected: 0 new errors.

---

### Task 10: Flutter — Nav `VerificationSuccessPage` to `HOME`

**Files:**
- Modify: `eatinpal-flutter/lib/modules/auth/presentation/pages/verification_success_page.dart:73-80`

- [ ] **Step 10.1: Change the two nav targets**

Open `verification_success_page.dart`. Replace the `_onStateChanged` method:

```dart
void _onStateChanged(BuildContext context, AuthState state) {
  if (state is AuthSuccess) {
    context.go(RoutePaths.HOME);
  } else if (state is AuthFailure) {
    AppSnackbar.error(context, state.message);
    context.go(RoutePaths.WELCOME);
  }
}
```

Only two lines change: the success nav target becomes `RoutePaths.HOME`; the failure nav target remains `RoutePaths.WELCOME`.

- [ ] **Step 10.2: Analyzer check**

Run: `cd eatinpal-flutter && fvm flutter analyze`
Expected: 0 errors overall.

---

### Task 11: Manual verification (end-to-end)

No code changes in this task. Run through the three user-facing paths to confirm the flow works.

- [ ] **Step 11.1: Start Nest dev server**

```bash
cd eatinpal-nest
pnpm start:dev
```

- [ ] **Step 11.2: Start Flutter app (device with App Links verified)**

```bash
cd eatinpal-flutter
fvm flutter run
```

Ensure the app is installed on an Android device with `assetlinks.json` served by your backend and `autoVerify="true"` matching your real domain.

- [ ] **Step 11.3: Path 1 — Desktop browser**

Generate a fresh verification token by registering a new user through the app (or `POST /auth/register`). Copy the `verification_token` from the response. In a desktop browser, open:

```
http://<backend-host>/auth/verify?token=<TOKEN>
```

Expected:
- Browser loads a blank page
- An alert appears with "Verification successful" (or "Email is already verified" on a repeat)
- Clicking OK closes the tab (or leaves a blank tab — `window.close()` may be blocked by the browser; this is documented behaviour, not a bug)
- Database: `users.email_verified = true` for the target user

- [ ] **Step 11.4: Path 2 — Mobile browser, no app installed**

Open Chrome DevTools → Device Emulation → pick an Android phone profile. Open:

```
http://<backend-host>/auth/verify?token=<TOKEN>
```

Expected:
- Page redirects to `https://play.google.com/store`
- Database: user is marked verified

Repeat with an iOS device emulation profile → expect redirect to `https://apps.apple.com`.

- [ ] **Step 11.5: Path 3 — Android app installed (same-device deeplink)**

```bash
adb shell am start -W -a android.intent.action.VIEW \
  -d "https://<your-domain>/auth/verify?token=<TOKEN>" \
  com.eatinpal.eatinpal
```

Expected:
- Flutter app opens directly (no browser flash) on `VerificationSuccessPage`
- Network inspector shows `GET /auth/verify?token=...` with `Accept: application/json` returning `{status_code: 200, data: {verified: true|false}}`, followed by `POST /auth/verified-login` returning user + tokens
- App navigates to `HomePage` — "Welcome to EatinPal" placeholder visible

- [ ] **Step 11.6: Path 4 — Signed user cannot re-enter auth routes**

While signed in (i.e. after Path 3 completes), programmatically push `/welcome`:

- Hot-restart the app; on cold start the router redirect should send you straight to `/home` (guard: `destSplash && signed → HOME`).
- Or: use Flutter inspector / a debug button to `context.go('/welcome')` — router should redirect back to `/home`.

- [ ] **Step 11.7: Path 5 — "I've verified" button still works**

Register a user but don't tap the email link. On `VerifyEmailPage`, tap the "I'VE VERIFIED" button.

Expected:
- `AuthVerifiedLoginRequested` fires
- Bloc runs verify then verified-login
- Success → `AuthSuccess` → snackbar → (page stays, `verified-login` returns credentials, but this page doesn't nav on success — it calls `AppSnackbar.success`. Verify this still matches the current behaviour you want.)

If you want the "I've verified" button to also navigate to HOME, change `_verifiedLogin` in `verify_email_page.dart` to also handle nav. This is outside the current plan scope — flag it and decide.

---

## Out of scope (user handles separately)

- iOS `Info.plist` `com.apple.developer.associated-domains` capability
- Populating `public/.well-known/apple-app-site-association` with real Team ID + Bundle ID
- Swapping `host="localhost"` for production domain in `AndroidManifest.xml`
- Moving `HomePage` out of the `auth` module to its own feature module later
- Moving store URLs into env/config
- Wiring "I've verified" button's navigation on success (call it out, don't touch)

## Notes on testing coverage

This plan adds **one** spec test (Nest `auth.controller.spec.ts`, Task 3). The repo had zero `*.spec.ts` files previously — this establishes the pattern. No Flutter test harness exists in this repo yet; adding one (mocktail/bloc_test + dev_deps in `pubspec.yaml` + `test/` scaffolding) is a separate undertaking. Manual verification in Task 11 is the coverage for Flutter-side changes.
