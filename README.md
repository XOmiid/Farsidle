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

Verification includes all 37 automated tests, the production build, direct live API checks for every leaderboard and denied anonymous account access, plus a live database smoke check for all seven games, profile updates, daily rewards and both ledger views. That smoke check rolled back its synthetic user, results, coins and daily puzzles. Existing account login/email delivery should also be checked with a real user; no real password was collected or automated email sent during verification.

Supabase's existing [leaked-password-protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) and [legacy function-access advisories](https://supabase.com/docs/guides/database/postgres/functions#function-privileges) remain project-level follow-up items. The new private helpers and allowlisted account RPCs were checked separately. No GitHub push or website deployment has been performed.

## Account and mini-crossword follow-up

Optional date of birth (Gregorian date input) and country of residence are available on signup and profile editing. Empty values are accepted, saved values may be cleared, existing values are preserved, and these fields are excluded from public profile columns and leaderboards. Signup metadata is passed to the existing Auth profile trigger; signed-in edits use the authenticated three-argument profile RPC. The older two-argument RPC remains compatible.

Signup and recovery codes continue through Supabase Auth and the project’s configured SMTP provider; no Resend secret belongs in browser code. Recovery resends now use the same redirect as the first request, code types remain separate (`email` for signup, `recovery` for password reset), and the interface waits 60 seconds before allowing resend. The project’s confirmation and recovery templates must contain `{{ .Token }}` for a code-based flow. See [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates) and [SMTP configuration](https://supabase.com/docs/guides/auth/auth-smtp). Actual delivery requires an approved test recipient and access to the SMTP/template settings; it is not established by the code tests alone.

Guest completions show a dismissible login/register dialog. Guest scores are practice scores and are not retroactively inserted into authenticated leaderboards. The shared Wordle/crossword keyboard uses left-to-right row layout so the Persian physical-key order is mirrored correctly.

The crossword library now has three fully checked, symmetric 5×5 minis (101–103). Earlier content and purchases remain available by their archived IDs. `supabase/account-crosswords-update.sql` records the additive update already applied to the connected database.

## Leaderboard and clock follow-up

Teamdle displays «تیم قرمز» and «تیم آبی» with each finished player's name and score under their actual team. The team endpoint returns all members rather than truncating the combined list at 50; matched-pair rules still determine team totals. Wordle returns successful and unsuccessful completions, ordered with all winners first by submission time, then losses by submission time. Its UI shows a green check or red cross instead of a numeric score, and submission times use Tehran time.

Every page has a live clock labeled «به وقت ایران», using the `Asia/Tehran` time zone. Memorydle displays no sample number before either stage starts. The updated leaderboard function is applied in Supabase and recorded in `supabase/leaderboard-update.sql`; test fixtures were rolled back. These frontend changes remain local until the next GitHub push.

## Galactic multiplayer — کهکشانی

The new mode lives at `/galactic`, separately from Classic. Player names remain in English; interface and original match commentary are Persian. The current pool contains 728 real players across nine selected leagues. Ratings are explicitly custom Farsidle estimates, not EA ratings. Source notes and limitations are recorded in `data/galactic/README.md`.

Accounts are required. Rooms hold 2–8 humans, with public listings or private invitation codes. Managers choose a formation and tactic before a randomized snake draft. Every footballer is unique in a room. Each pick has a server-enforced 60-second deadline and an automatic choice that fills vacant positions. Out-of-position selections show a performance penalty. Setups lock when the draft starts; each completed team has exactly eleven players. A frozen dataset version prevents later player edits from changing an existing room.

The knockout bracket uses byes, with no artificial teams. Matches in each round start simultaneously, about eight minutes for regulation, with extra time and penalties when needed. A private deterministic simulation weighs midfield control, attack, defending, goalkeeper quality, fatigue, tactic tradeoffs and position fit. Text incidents hold the shared clock before play resumes. The server returns only events whose reveal time has arrived; hidden winners and future commentary remain private. Ratings influence probabilities and never guarantee victory.

The additive backend is already installed in the connected Supabase project. `npm run db:galactic` produces `supabase/galactic-upgrade.sql` for review or another environment; it does not connect to a database. Source SQL is split into schema, engine, rooms and Realtime policy files. Do not change an existing dataset version: create a new version for future rooms. Private tables have RLS and no direct client grants. Authenticated RPCs validate membership and serialize room mutations with row locks. Realtime channels are private and receive-only; polling provides recovery. Advancement runs on server requests and catches up after an offline period, requiring no continuously running Node process.

Verification covers complete 2-, 3-, 5- and 8-person tournaments, unique XIs, snake order, automatic picks, byes, simultaneous rounds with a completion barrier, hidden events, direct-access denial, deterministic replay, balanced-team symmetry, stronger-team advantage, extra time and penalties. Two disposable accounts also exercised live sign-in, joining, setup, picking and private Realtime notifications against Supabase. Test-account cleanup is limited to the two QA identities and their rooms; no existing user data is included. This is an initial editorial player pool and simulation; it will need broader player feedback and tuning. No GitHub push or website deployment is included.

Supabase advisory review: the authenticated `SECURITY DEFINER` RPC notices are intentional for the allowlisted, auth-checked gateway; direct table access remains denied. The [RLS-without-policy notices](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) for the private tables reflect that deny-all design. The [function privilege notices](https://supabase.com/docs/guides/database/postgres/functions#function-privileges) were reviewed alongside membership, host and turn checks. New foreign-key indexes are retained even before production usage. Existing unrelated project advisories remain unchanged.

## Galactic version 2

The draft is formation-first: click an empty position, search an English player name, then select. Results show identity, club, eligible positions, qualitative playing traits, verified height where available, an out-of-position warning and prospective chemistry. No numerical ratings or rating-ordered player lists appear. A how-to-play manual explains these decisions. Thirteen formations include 4-3-3 A/B, three back-five variants, a midfield diamond and more; nine tactics include crossing, central attacks, direct play, low block and shooting on sight.

The server generates staged build-up, action and outcome commentary. Scores, cards and statistics reveal only at their event times. Blue and red shirts match the attacking commentary backgrounds. A manager sees their own fixture by default; a live scoreboard permits switching to another current-round match. Goal news from other fixtures joins the commentary. The next round waits for all extra time and shootouts. Live statistics include possession, shots, on-target shots, passes, completed passes, corners, fouls, cards, offsides and in-game penalties.

Frozen v1 games retain their original simulation; unstarted lobbies move to the new dataset and require readiness again. Version 2 introduced this baseline; new games now use version 4. The initial traits are an editorial model, not a complete football-data feed: only 45 factual heights are verified, and unknowns remain absent. Source notes are in `data/galactic/traits-sources.md`.

Version 2 was checked with complete isolated PostgreSQL tournaments, simultaneous-round and legacy-version tests, tactical/chemistry/discipline checks, hidden-statistic checks and native browser checks at 320px, 390px and desktop widths. A live four-person Supabase fixture confirmed parallel kickoffs, round barriers and hidden future statistics, then rolled back completely; no new QA accounts or rooms remain. Temporary UI review routes and fixtures were removed before the final build.

## November 2026 game refresh

Factle uses 146 rewritten clues across 73 countries, with food, customs, sport, film/music and nature replacing repeated heritage-site clues. Existing daily attempts retain their saved content. Teamdle needs one start: each of its four questions begins automatically after the previous answer or timeout, with its own six-second window.

Galactic v3 has 644 curated players across 34 clubs, including all 20 Premier League clubs and Atletico Madrid, AC Milan, Inter, AS Roma, Lazio, Napoli, Juventus, Borussia Dortmund and Bayern Munich. Clicking a position shows five random available specialists, with refresh, club/league filters and English-name search. Ratings remain hidden; disabling the position filter allows an out-of-position pick with the existing penalty.

Regulation opportunities are sampled across minutes 1–90, allowing clusters, quiet spells and late events, while keeping approximately eight-minute matches. Commentary has multiple variants for each attacking route, plus cutbacks, dribbling duels, goalkeeper claims/sweeps, blocked shots, playable corners, parries/rebounds and offside reviews. New incidents change stats and outcomes, with build-up before each result. Existing skill, tactic, fatigue, aerial, chemistry and discipline factors continue to apply. Active/finished rooms keep their frozen versions and saved timelines; lobby rooms move to v3 and must ready again.

Verified with 52 passing tests, lint, formatting, a production build, a rolled-back live Supabase simulation, and mobile player-picker checks at 320px and 390px. No QA account or room was created; temporary preview files were removed before the production build. No Git commit or push was made.

## Galactic version 4

Create a Cup or League room, then choose Normal or Draft player selection. Normal retains English-name search and club/league filters. Draft enforces five saved server-generated options per position with a balanced mix of good and average slot bands. Managers have one initial-draft re-roll and one new re-roll per match's halftime window; a re-roll without an available improvement preserves the credit. Refreshing does not produce new offers. Auto-picks obey the same restrictions.

Captain, penalty taker and free-kick taker can be selected during drafting and the one-minute preparation period. At halftime, each manager has two minutes to change formation, tactics, roles and up to five players. Drag with a mouse or touch to swap positions; tap/click for a replacement. Normal searches the free pool; Draft offers five saved choices. Changes are validated by the server and apply only to that match. Opponents cannot duplicate a reserved incoming player. Saved first-half events remain immutable, and only the second half is generated after the window closes. Matches have roughly eight minutes of active playback plus the two-minute interval.

League teams face each other once, with simultaneous fixtures each round. Wins earn three points, draws one, losses zero. Ranking uses points, goal difference, goals scored, then head-to-head points among the tied teams. Complete ties share a position. League draws have no extra time or shootout. Cup retains the knockout bracket and tiebreaks. Existing started rooms keep their previous frozen version.

V4 expands the curated pool to 728 players from nine leagues, including Saudi Arabia, Turkey, MLS and Brazil. Pubill is eligible at CB and RB; both Diomandes are included. Weighted actors give wingers, midfielders and advancing defenders meaningful chances. Corners now have explicit awards, deliveries and aerial contests. Assigned takers, actual lineup roles, tactics, chemistry, fatigue and substitutions feed the simulation and its visible statistics. See `data/galactic/README.md` for sources and limitations.

The additive extension is `supabase/galactic-v4.sql`, included by `npm run db:galactic`. Private offers, halftime state and replacement reservations have RLS and no direct client access. Server room locks serialize drafting, reservations and deadline enforcement. No production test accounts or rooms are required for the local integration tests. Temporary browser-review fixtures are removed before the production build. Changes remain uncommitted for local review.

V4 validation: 60 regression tests pass, including 3/4/8-team complete leagues, direct head-to-head ties, saved offer enforcement, per-context re-rolls, both halftime selection modes, match-local substitutions, immutable first halves, selected takers, winger/defender goals, narrated corner totals and tactical possession. Native browser checks at 320px/390px covered position dragging, formation changes, replacement search, the constrained Draft picker and re-roll state. Build, lint and formatting pass. A live Supabase transaction exercised the Draft League RPC flow and halftime continuation, then rolled back with zero QA rooms/offers/reservations remaining.

The two new private tables intentionally have deny-all RLS with no client policies, and `galactic_create_room` is an authenticated-only validated RPC, matching the existing gateway pattern. Advisor findings for those deliberate settings are expected; indexes cover the newly introduced foreign keys. Existing unrelated legacy advisor findings were not changed by this update.
