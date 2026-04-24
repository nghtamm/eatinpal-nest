---
name: Verify-email deeplink + web/mobile fallback
description: End-to-end flow for email verification link — Android/iOS App Links open the Flutter app; web/desktop shows a browser alert then closes; mobile without app redirects to store homepage
type: design
status: draft
---

# Verify-email deeplink + web/mobile fallback

## Context

The app sends a verification email containing `https://{DOMAIN}/auth/verify?token=<jwt>`. Currently that URL returns JSON from a NestJS controller. Three things are wrong or missing:

1. When Android App Links / iOS Universal Links intercept the URL (app installed + verified), the OS opens the Flutter app directly — **no HTTP request reaches the backend**. Flutter's `VerificationSuccessPage` then calls `POST /auth/verified-login`, which requires `user.emailVerified = true` — but nothing has marked the user verified yet on same-device installs. The call fails with 403. (Pre-existing bug.)
2. If the user opens the email on a device without the app (desktop, or second phone without the app), they hit the JSON endpoint and see raw JSON. There is no user-facing confirmation.
3. There is no `HOME` route; `VerificationSuccessPage` currently navigates to `WELCOME` on success.

This spec defines the end-to-end behavior: email link works identically regardless of platform, with platform-appropriate affordances (alert on desktop, store redirect on mobile-without-app, deep-link-into-app on mobile-with-app).

## Decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | Nest renders the HTML page inline (no separate frontend, no static file). | No web frontend exists. Controller returning `text/html` is the least infrastructure. |
| 2 | `GET /auth/verify` performs verification (marks `emailVerified=true`) and embeds the result message directly into the HTML. One request, no follow-up fetch. | Simplest path. Email-scanner false-positive risk accepted; refactor later if it becomes a problem. |
| 3 | Mobile without app → redirect to store **homepage** (Play Store / App Store). No alert. | App is not yet published. Homepage is the correct shape for when the app ships (swap URLs later). Handles cross-device case (receive mail on phone A, app on phone B). |
| 4 | Scope: logic + `HOME` route + deeplink bug fix. iOS `Info.plist` setup, Android intent-filter domain swap, and `apple-app-site-association` population are **out of scope** (need real Bundle ID / Team ID / cert fingerprint). | OS-level config requires inputs from the user and is independent of the logic. |
| 5 | Bug fix approach: **Flutter** calls `GET /auth/verify` before `POST /auth/verified-login` (option X, not Y). | Keeps each endpoint with one job: `/auth/verify` marks verified, `/auth/verified-login` issues tokens. |
| 6 | Store URLs hardcoded in the HTML template (not env vars). | User requested; env refactor to come later. |

## Architecture — three flow branches

```
User taps https://{DOMAIN}/auth/verify?token=X in an email

├── Android w/ app installed (App Links verify OK — assetlinks.json matches)
│     OS sends Intent → Flutter deeplink_service extracts token
│     → router go(VERIFICATION_SUCCESS, extra: token)
│     → VerificationSuccessPage onInit:
│         1. POST (via GET w/ Accept: application/json) /auth/verify  → mark verified
│         2. POST /auth/verified-login                                 → tokens
│         3. storage.save tokens; go(HOME)
│
├── iOS w/ app installed (Universal Links verify OK) — same path as Android
│
├── Mobile w/o app (OS cannot intercept)
│     Browser loads GET /auth/verify (Accept: text/html)
│     → Nest marks verified, returns HTML with embedded message + store URLs
│     → JS detects UA mobile → window.location.replace(PLAY_STORE|APP_STORE)
│
└── Web / desktop
      Browser loads GET /auth/verify (Accept: text/html)
      → Nest marks verified, returns HTML with embedded message
      → JS detects non-mobile UA → alert(message) → window.close()
```

Android App Links and iOS Universal Links intercept **at the OS level** when verified — the backend sees no HTTP request in those cases. Mobile-without-app falls through to the browser and reaches the backend.

## Nest changes

### Endpoint `GET /auth/verify?token=<token>` — content negotiation

File: `src/modules/auth/auth.controller.ts`

The existing endpoint at lines 68-76 currently always returns JSON. Change it to switch on the `Accept` header:

- `Accept: application/json` (Flutter call) → call `authService.verify(token)`, return JSON exactly as today (`{ message, verified }`). No behavior change for API clients.
- Anything else (browsers) → call `authService.verify(token)` (still marks verified), catch `UnauthorizedException`, use the exception's message if thrown, then render the HTML page with:
  - The message (success, already-verified, or error) embedded via `JSON.stringify` inside a `<script>`
  - The two store URLs embedded via `JSON.stringify`
  - Client-side JS that branches on `navigator.userAgent`

HTTP status always 200 for the HTML branch (this is a user-facing page, not an API). Error-case message becomes part of the alert text. JSON branch keeps current status semantics (200 / 401).

Controller pseudocode:

```ts
@Public()
@Get('verify')
async verify(
  @Query('token') token: string,
  @Headers('accept') accept: string,
  @Res() res: Response,
) {
  const wantsJson = (accept || '').includes('application/json');

  let message: string;
  try {
    const result = await this.authService.verify(token);
    message = result.message; // "Verification successful" or "Email is already verified"
    if (wantsJson) return res.json(result);
  } catch (err) {
    if (wantsJson) throw err; // let HttpExceptionFilter format JSON error
    message = err instanceof UnauthorizedException
      ? 'Invalid or expired verification link'
      : 'Something went wrong verifying your email';
  }

  return res
    .type('text/html')
    .status(200)
    .send(renderVerifyPage(message));
}
```

Note: because we're bypassing the global `ResponseInterceptor` via `@Res()`, the JSON path must wrap the result in the same `{ status_code, message, data }` shape it would have produced — do this manually in the controller to stay consistent with the rest of the API.

Alternative that preserves the interceptor: keep two code paths by returning a plain object for JSON (interceptor wraps) and using `res.type('text/html').send(...)` only for the HTML branch. Pick whichever fits cleaner when implementing — both are equivalent from the spec's perspective.

### HTML template helper

File: `src/modules/auth/utils/verify-page.html.ts` (new)

```ts
export function renderVerifyPage(message: string): string {
  const PLAY_STORE = 'https://play.google.com/store';
  const APP_STORE = 'https://apps.apple.com';
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>EatinPal</title></head>
<body>
<script>
(function () {
  var msg = ${JSON.stringify(message)};
  var playStore = ${JSON.stringify(PLAY_STORE)};
  var appStore = ${JSON.stringify(APP_STORE)};
  var ua = navigator.userAgent || '';
  if (/Android/i.test(ua))              { window.location.replace(playStore); return; }
  if (/iPhone|iPad|iPod/i.test(ua))     { window.location.replace(appStore); return; }
  alert(msg);
  window.close();
})();
</script>
</body></html>`;
}
```

`JSON.stringify` on the server escapes quotes/backslashes/newlines safely, preventing XSS via the message and making the URLs drop-in swappable later.

### `POST /auth/verified-login` — unchanged

Keep the existing 403 behavior. Flutter will call `/auth/verify` first (see below).

### No new env vars

Store URLs hardcoded in the template per decision #6.

### Tests (Nest)

- `auth.controller.spec.ts` — unit test both Accept branches:
  - `application/json` → JSON response (success + already-verified + invalid), DB field `emailVerified` updated where applicable.
  - `text/html` (or absent) → response `Content-Type: text/html`, body contains the expected embedded message (JSON-stringified), body contains both store URLs.
- `auth.e2e-spec.ts` — e2e:
  - `GET /auth/verify?token=<valid>` with `Accept: text/html` → 200, body contains `"Verification successful"`.
  - `GET /auth/verify?token=<invalid>` with `Accept: text/html` → 200, body contains `"Invalid or expired verification link"`.
  - `GET /auth/verify?token=<valid>` with `Accept: application/json` → 200, JSON shape matches existing.
  - `GET /auth/verify?token=<invalid>` with `Accept: application/json` → 401, JSON error shape.

## Flutter changes

### New `HomePage`

File: `lib/modules/auth/presentation/pages/homepage.dart` (new) — class name `HomePage`. Temporary location inside `auth/` module; may move later.

Scaffold only:

```dart
class HomePage extends StatelessWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Home')),
      body: const Center(child: Text('Welcome to EatinPal')),
    );
  }
}
```

Export through the `auth` module barrel: `lib/modules/auth/auth.dart`.

### Route `HOME`

- `lib/app/router/route_names.dart` — add `static const String HOME = '/home';`
- `lib/app/router/app_router.dart` — add a `GoRoute` for `RoutePaths.HOME` → `HomePage`.

### Router guard — enable "signed user cannot visit auth routes"

`lib/app/router/app_router.dart` — the comment at lines 63-64 becomes live:

```dart
if (signed && destAuth) return RoutePaths.HOME;
```

`destAuth` set continues to include `WELCOME`, `REGISTER`, `LOGIN`, `VERIFY_EMAIL`, `VERIFICATION_SUCCESS` (do **not** add `HOME` to it).

### Verify-then-login in `VerificationSuccessPage`

File: `lib/modules/auth/presentation/pages/verification_success_page.dart`

Current `initState` dispatches `AuthVerifiedLoginRequested` only. Change to dispatch a new `AuthVerifyRequested(token)` first; the bloc chains verify → verified-login; on final success the page navigates to `HOME`.

### New `VerifyUseCase` + service method

File: `lib/modules/auth/data/services/auth_service.dart`

Add method:

```dart
Future<Either<AppException, VerifyResult>> verify(String token) async {
  // GET /auth/verify?token=<token>  with headers: Accept: application/json
  // Response shape: { message: String, verified: bool }  (unwrapped from ResponseInterceptor envelope)
}
```

File: `lib/modules/auth/domain/usecases/verify_usecase.dart` (new) — thin wrapper over repository method, mirroring `VerifiedLoginUseCase`.

Repository + abstract pairing mirrors existing auth methods.

`VerifyResult` entity (domain): `{ String message; bool verified; }`.

### AuthBloc — chain verify → verified-login

File: `lib/modules/auth/presentation/bloc/auth_bloc.dart`

New event: `AuthVerifyRequested(String token)`.

Handler: calls `VerifyUseCase`; on success, dispatches `AuthVerifiedLoginRequested`; on failure, emits an error state (same pattern as other failures).

The existing `AuthVerifiedLoginRequested` handler is unchanged.

### Navigate to HOME on success

File: `lib/modules/auth/presentation/pages/verification_success_page.dart` — at line 75, change the destination from `RoutePaths.WELCOME` to `RoutePaths.HOME`.

### "I've verified" button flow

The button at `verify_email_page.dart` currently navigates to `VERIFICATION_SUCCESS` with the locally-stored token. That screen now does verify → verified-login, which is also the correct behavior for this button (covers the cross-device case where phone A verified via email link, phone B taps "I've verified"). No change to `verify_email_page.dart`.

### Tests (Flutter)

- `auth_bloc_test.dart` — `AuthVerifyRequested` success → bloc subsequently dispatches `AuthVerifiedLoginRequested`; failure → error state emitted, no verified-login call.
- `verification_success_page_test.dart` — widget test: on mount, verify service is called first, then verified-login, then `context.go(HOME)`.
- `app_router_test.dart` — signed user pushing `/welcome` redirects to `/home`; unsigned user pushing `/home` redirects to `/welcome` (or whatever the existing unsigned default is).

## Files touched

### Nest
| File | Action |
|---|---|
| `src/modules/auth/auth.controller.ts` | modify `verify` handler: Accept-based content negotiation |
| `src/modules/auth/utils/verify-page.html.ts` | **create** — HTML template function |
| `src/modules/auth/auth.controller.spec.ts` | add tests for both Accept branches |
| `test/e2e/auth.e2e-spec.ts` | add e2e tests for HTML and JSON responses |

### Flutter
| File | Action |
|---|---|
| `lib/modules/auth/presentation/pages/homepage.dart` | **create** — scaffold placeholder |
| `lib/modules/auth/auth.dart` | export `homepage.dart` |
| `lib/app/router/route_names.dart` | add `HOME` |
| `lib/app/router/app_router.dart` | add `HOME` route; enable signed-user guard |
| `lib/modules/auth/presentation/pages/verification_success_page.dart` | dispatch `AuthVerifyRequested` first; nav to `HOME` on success |
| `lib/modules/auth/presentation/bloc/auth_bloc.dart` | add `AuthVerifyRequested` event + handler |
| `lib/modules/auth/presentation/bloc/auth_event.dart` | add event class |
| `lib/modules/auth/data/services/auth_service.dart` | add `verify(token)` method |
| `lib/modules/auth/data/repository_impl/auth_repository_impl.dart` | add `verify(token)` |
| `lib/modules/auth/domain/repository/auth_repository.dart` | add `verify(token)` abstract |
| `lib/modules/auth/domain/usecases/verify_usecase.dart` | **create** |
| `lib/modules/auth/domain/entities/verify_result.dart` | **create** — `{ message, verified }` entity |
| `lib/modules/auth/data/models/verify_result_model.dart` | **create** — freezed model extending entity |
| `lib/core/di/service_locator.dart` | register `VerifyUseCase` |
| tests (see above) | add |

(Exact file paths for repository/service split follow existing conventions in the auth module — adapt as found during implementation.)

## Out of scope (user will do separately)

- iOS `Info.plist` — `com.apple.developer.associated-domains` capability; populate `public/.well-known/apple-app-site-association` with real Team ID + Bundle ID.
- Android intent-filter — swap `host="localhost"` for the production domain in `AndroidManifest.xml`.
- `assetlinks.json` is already configured (per user).
- Environment variables — `PLAY_STORE_URL` / `APP_STORE_URL` will be moved to env/config later.
- Moving `HomePage` out of the `auth` module when its final home is decided.

## Verification plan

### Nest
- `yarn lint` passes.
- `yarn test` — unit tests for the controller pass.
- `yarn test:e2e` — e2e tests pass for both Accept branches.
- Manual: `curl -H 'Accept: text/html' 'http://localhost:3000/auth/verify?token=<valid>'` — returns HTML with embedded expected message; DB shows user verified.
- Manual: `curl -H 'Accept: application/json' 'http://localhost:3000/auth/verify?token=<valid>'` — returns JSON exactly as before.
- Manual: open HTML response in a desktop browser — alert fires with expected message, tab closes (may be blocked depending on browser; known limitation).
- Manual: open HTML response with mobile UA (DevTools device emulation) — redirects to Play Store or App Store homepage.

### Flutter
- `fvm flutter analyze` passes.
- `fvm flutter test` — all new and existing tests pass.
- Manual (Android with app installed + App Links verified):
  1. `adb shell am start -W -a android.intent.action.VIEW -d "https://<domain>/auth/verify?token=<valid>" com.eatinpal.eatinpal`
  2. App opens on `VerificationSuccessPage`.
  3. Network inspector shows `GET /auth/verify` with `Accept: application/json`, then `POST /auth/verified-login`.
  4. Lands on `HomePage`.
- Manual (signed user deep-links to `/welcome`): redirected to `/home`.
