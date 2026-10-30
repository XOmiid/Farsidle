# Farsidle / فارسیدل

A mobile-first Persian puzzle arcade. `/` is the Farsidle hub; `/classic` contains the seven existing games. The Git-connected project is `/Users/xomiid/Desktop/farsidle`. Changes are local and unpushed.

## Local review

The authoritative checkout is `/Users/xomiid/Desktop/farsidle`. Requires Node.js 22+ and npm.

```sh
npm ci
npm run dev -- --hostname 127.0.0.1
```

Open http://127.0.0.1:3000. This checkout is connected to the existing Farsidle Supabase project. Existing public URL/key settings automatically select Supabase mode, so the same configured hosting project can deploy from GitHub without adding a new environment variable. Explicit `NEXT_PUBLIC_DATA_MODE=supabase` also works. Never use a service-role key in `NEXT_PUBLIC_` settings.

Signed-in players use server-side progress, balances, claims, crossword purchases and leaderboards. Signed-out visitors can practice in guest mode, with separate browser saves and no server rewards. The profile explains the distinction. Preview test coins never become account coins.

For an isolated offline preview, explicitly set `NEXT_PUBLIC_DATA_MODE=local`. That mode starts with 5,000 test coins, uses browser-only saves and shows only this device's leaderboard results. Its profile includes a reset action. Local preview, guest practice and authenticated saves are separate.

## Checks

```sh
npm run data:validate
npm test
npm run lint
npm run build
npm run format:check
```

Tests cover Persian letter normalization, repeated Wordle letters, the exact Tehran reset boundary, five distinct Factle countries, immutable color reveal times, memory answer validation, music rounds, timed geography, and crossword rules. Database tests use an in-memory PostgreSQL instance through PGlite, with disposable auth roles and fixtures. They do not use credentials, production data or a network database.

## Architecture

- `app/`: thin App Router pages, canonical URLs and redirects from the seven original game URLs.
- `components/arcade/`: shared responsive shell, home/collection, game views, profile/auth and leaderboards.
- `lib/classic/rules.mjs`: deterministic local daily challenges, scoring and validation.
- `lib/classic/gateway.js`: isolated browser saves by default; explicit Supabase mode after migration.
- `data/catalog.json`: fresh, versioned content. Country-clue sources and editorial notes are in `data/README.md`.
- `supabase/`: reviewable PostgreSQL schema, validated action endpoints and account/economy functions.

The four retired games and nonfunctional gift-card store are removed. No old answer pools, hand-written per-game storage copies, analytics dependency, external avatar calls or unused date-conversion package remain in the active app. Retired routes return the normal 404 page.

## Supabase connection and applied upgrade

The additive Classic upgrade was applied to project `pzfrjsmsqlzeygmgnypm` on 30 October 2026. The active content is now the new Classic pack. The original 57 profiles, 4,003 coin transactions and total balance of 242,454 coins were preserved and checked per player. No old puzzle content, user history or accounts were deleted.

- `classic_private` holds the new content, daily puzzles, progress and score verification. Its tables have RLS, no direct browser grants and no permissive policies. Only six narrow public `classic_*` functions are exposed; account functions require authentication and leaderboards may be read publicly.
- `classic_private.prelaunch_backup` contains a protected snapshot of the profiles, coins, streaks and affected grants/function definitions from before rollout. This is a focused rollback snapshot, not a replacement for full project backups.
- `classic-compatibility.sql` synchronizes coins in both directions and keeps profiles, moderation flags and streaks consistent while the old website remains online. Existing gameplay endpoints retain their privileges so this database update can precede the GitHub deployment. New puzzles use their own progress and purchase records.
- Direct public calls to the arbitrary-amount `award_coins` helper are revoked; existing server-owned game functions can still call it. Profile editing cannot change moderation restrictions.

```sh
npm run db:prepare
```

This regenerates the reviewable `supabase/upgrade.sql`; it makes no database connection and does not publish anything. The already-applied rollout is recorded in Supabase migration history. Do not reapply the upgrade as part of every frontend deployment.

Verification includes all 35 automated tests, the production build, direct live API checks for every leaderboard and denied anonymous account access, plus a live database smoke check for all seven games, profile updates, daily rewards and both ledger views. That smoke check rolled back its synthetic user, results, coins and daily puzzles. Existing account login/email delivery should also be checked with a real user; no real password was collected or automated email sent during verification.

Supabase's existing [leaked-password-protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) and [legacy function-access advisories](https://supabase.com/docs/guides/database/postgres/functions#function-privileges) remain project-level follow-up items. The new private helpers and allowlisted account RPCs were checked separately. No GitHub push or website deployment has been performed.

## Account and mini-crossword follow-up

Optional date of birth (Gregorian date input) and country of residence are available on signup and profile editing. Empty values are accepted, saved values may be cleared, existing values are preserved, and these fields are excluded from public profile columns and leaderboards. Signup metadata is passed to the existing Auth profile trigger; signed-in edits use the authenticated three-argument profile RPC. The older two-argument RPC remains compatible.

Signup and recovery codes continue through Supabase Auth and the project’s configured SMTP provider; no Resend secret belongs in browser code. Recovery resends now use the same redirect as the first request, code types remain separate (`email` for signup, `recovery` for password reset), and the interface waits 60 seconds before allowing resend. The project’s confirmation and recovery templates must contain `{{ .Token }}` for a code-based flow. See [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates) and [SMTP configuration](https://supabase.com/docs/guides/auth/auth-smtp). Actual delivery requires an approved test recipient and access to the SMTP/template settings; it is not established by the code tests alone.

Guest completions show a dismissible login/register dialog. Guest scores are practice scores and are not retroactively inserted into authenticated leaderboards. The shared Wordle/crossword keyboard uses left-to-right row layout so the Persian physical-key order is mirrored correctly.

The crossword library now has three fully checked, symmetric 5×5 minis (101–103). Earlier content and purchases remain available by their archived IDs. `supabase/account-crosswords-update.sql` records the additive update already applied to the connected database.
