# OAuth Setup

Step-by-step to wire real Google Sign-In into LOCOMATE. Apple is deliberately out of scope for v1 (requires paid Apple Developer, HTTPS-only dev, domain verification).

## Google Cloud Console

1. Open https://console.cloud.google.com/ and pick (or create) a project.
2. Navigate: **APIs & Services -> OAuth consent screen**.
   - User Type: **External**.
   - App name: `LOCOMATE`. User support email: your address.
   - Scopes: `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`.
   - Test users (while app is in Testing mode): add your own Gmail.
3. Navigate: **APIs & Services -> Credentials -> Create Credentials -> OAuth client ID**.
   - Application type: **Web application**.
   - Name: `LOCOMATE Web`.
   - **Authorized redirect URIs** (exact matches, no wildcards accepted by Google):
     - `http://localhost:3000/api/auth/google/callback`
     - `https://loco-mate.vercel.app/api/auth/google/callback`
     - Add any other deploy URLs (staging, custom domain) here.
   - Save and copy the generated **Client ID** + **Client secret**.

## Environment variables

Local (`app/.env`):

```
GOOGLE_CLIENT_ID=<client id from step 3>
GOOGLE_CLIENT_SECRET=<client secret from step 3>
OAUTH_REDIRECT_BASE=http://localhost:3000
```

Vercel (Production + Preview):

```
GOOGLE_CLIENT_ID=<same>
GOOGLE_CLIENT_SECRET=<same>
OAUTH_REDIRECT_BASE=https://loco-mate.vercel.app
```

`OAUTH_REDIRECT_BASE` is concatenated with `/api/auth/google/callback` at runtime, so it must match one of the authorized redirect URIs registered in the Google Cloud Console exactly (scheme + host + port, no trailing slash).

## Database migration

Run once (idempotent) to create the `accounts` table:

```bash
npx tsx scripts/create-accounts-table.ts
```

The script also marks the demo seed users (`alex@test.com`, etc.) as `email_verified = true` so that the conditional OAuth linking rule works end-to-end in the demo environment.

## Flow at a glance

```
User click "Continue with Google"
  -> GET  /api/auth/google?returnTo=/explore       (generate state+PKCE, set cookies)
  -> 302  https://accounts.google.com/...           (consent)
  -> GET  /api/auth/google/callback?code&state     (verify state, exchange code, verify id_token)
  -> Account resolution:
       (a) accounts(provider=google, sub) match  -> sign in as linked user
       (b) users.email match + both sides emailVerified  -> auto-link + sign in
       (c) users.email match + either unverified -> /login?error=email_exists (safety)
       (d) no match -> create new user + profile + accounts row -> sign in + /onboarding
  -> 302  /auth/complete                           (handoff cookies hold JWTs for 60s)
  -> GET  /api/auth/session                        (browser swaps cookies for tokens, clears them)
  -> localStorage set, router.replace /home or /onboarding or returnTo
```

## Conditional linking rule (chosen policy)

LOCOMATE auto-links an OAuth identity to an existing email-password account only when **both** sides have a verified email. This blocks the 2025 OAuth account-squatting attack (attacker pre-registers `victim@gmail.com` with a password, victim later signs in with Google, attacker reuses the account).

| Existing `users.emailVerified` | Google `email_verified` | Outcome |
| --- | --- | --- |
| true  | true  | Auto-link (accounts row inserted, sign in) |
| true  | false | Block, `/login?error=email_exists` |
| false | true  | Block, `/login?error=email_exists` |
| false | false | Block, `/login?error=email_exists` |
| n/a (new email) | true | Create user with `emailVerified=true`, sign in |

### Recovery when OAuth is blocked

The conditional-linking rule is strict by design. In v1 there is no in-app recovery for the blocked case, so the supported path is:

1. User tries Google sign-in, we block with `?error=email_exists`.
2. The login page pre-fills their email from a short-lived httpOnly cookie (never from the URL).
3. They enter the password they originally registered with and sign in.
4. They continue using email + password as their auth method.

Link-Google-from-Settings is intentionally deferred (it needs a user-bound one-shot linking token the current flow does not have). Until it ships, any LOCOMATE user who originally signed up with a password stays on password auth unless they sign up a second Google-only account.

Practical impact: OAuth works out-of-the-box for (a) brand-new users whose email is not yet in our DB, and (b) the 8 seeded demo users (explicitly marked `email_verified = true` by the migration script). Existing password users continue to use their password.

## Troubleshooting

- `redirect_uri_mismatch` from Google: the URL built from `OAUTH_REDIRECT_BASE` does not exactly match one of the registered redirect URIs. Fix the env var or add the URI in Cloud Console.
- `invalid_client`: `GOOGLE_CLIENT_SECRET` missing or wrong. Re-copy from Cloud Console.
- `/login?error=state`: the `g_state` cookie did not round-trip. Usually means cookies are blocked or the user took longer than 10 minutes to consent. Retry.
- `/login?error=email_exists`: expected behavior for the conditional linking rule. Sign in with password, then link Google.
