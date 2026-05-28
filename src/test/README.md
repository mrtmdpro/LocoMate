# Test harness

Test infrastructure for LOCOMATE. See [app/docs/TRD.md](../../docs/TRD.md)
for the wider testing strategy.

## Layers

| Layer | Runner | Where | What it tests |
| --- | --- | --- | --- |
| Unit | Vitest | `src/**/*.test.ts` | Pure functions (pricing, slugify, profile-engine) |
| Integration | Vitest + PGlite | `src/server/routers/*.test.ts` | tRPC procedures against a real Postgres schema |
| Component | Vitest + Testing Library | `src/app/**/__tests__/*.test.tsx` | UI behaviour (form validation, state, callbacks) |
| E2E | Playwright | `tests/e2e/**/*.spec.ts` | Full browser flow against a running app |

## Running

```bash
pnpm test              # all Vitest layers
pnpm test:watch        # watch mode
pnpm test:coverage     # Vitest + v8 coverage report
pnpm test:e2e          # Playwright (needs PLAYWRIGHT_BASE_URL or `pnpm dev`)
```

## Writing tests

### Conventions

- One `describe` block per procedure / function.
- One `test` per meaningful branch (happy path, each validation rule, each
  authz gate, each state transition).
- Arrange-Act-Assert structure. Assertions on database state after a mutation,
  not just on the mutation return value.
- No `expect(x).toBeTruthy()`. Prefer `expect(x).toBe(something)`,
  `expect(x).toEqual({...})`, or `expect(x).toMatchObject({...})`.
- Authorization negative tests are mandatory for every
  `protectedProcedure` / `hostProcedure` / `adminProcedure`.

### Integration test skeleton

```ts
import { describe, test, expect } from "vitest";
import { eq } from "drizzle-orm";
import { callerAs } from "@/test/trpc";
import { createHost, createExperience } from "@/test/fixtures";
import { getTestDb } from "@/test/setup";
import { experiences } from "@/server/db/schema";

describe("hostExperience.publish", () => {
  test("happy path: verified host publishes a valid draft", async () => {
    const { user } = await createHost();
    const draft = await createExperience({
      authorId: user.id,
      kind: "host_custom",
      status: "draft",
    });
    const caller = await callerAs(user);

    await caller.hostExperience.publish({ id: draft.id });

    const [updated] = await getTestDb()
      .select()
      .from(experiences)
      .where(eq(experiences.id, draft.id));
    expect(updated.status).toBe("published");
    expect(updated.publishedAt).toBeInstanceOf(Date);
  });

  test("rejects unverified host", async () => {
    const { user } = await createHost({ host: { verificationStatus: "pending" } });
    const draft = await createExperience({ authorId: user.id, kind: "host_custom", status: "draft" });
    const caller = await callerAs(user);

    await expect(caller.hostExperience.publish({ id: draft.id }))
      .rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
});
```

### Fixtures (`fixtures.ts`)

- `createUser({ role, email, ... })` - traveler by default, with a
  `user_profiles` row.
- `createHost({ user, host })` - user with `role='host'` plus a
  `host_profiles` row (verified by default).
- `createPlace({ ... })` - minimal place row.
- `createExperience({ authorId, kind, status, ... })` - defaults to
  a published curated experience; pass overrides for host_custom / draft.
- `createTour({ userId, ... })` - tour in `preview` state.
- `createPayment({ tourId, ... })` - payment in `pending` state.
- `signTokenFor(user)` - real JWT for the auth-token header tests.

### Test DB lifecycle

- `setup.ts` boots one PGlite instance per test file, applies drizzle
  migrations 0000-0003, then the accounts + marketplace additions.
- `afterEach` truncates every table so each test sees a clean slate.
- `afterAll` closes the PGlite instance.

If you need to stop the reset for a specific test (not recommended), use
`vi.unstubAllEnvs()` and set up your own lifecycle -- but reach for that only
if the existing pattern is actually blocking you.

### Faster unit tests

Unit tests that touch no database should skip `setup.ts` implicitly by not
reading `getTestDb()`. Vitest still loads the setup file (it's a global hook),
but PGlite boot happens in `beforeAll` which is ~500ms; if this becomes too
slow we can split into `vitest.config.ts` projects later.
