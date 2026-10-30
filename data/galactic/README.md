# کهکشانی starter player pack

Created 2026-10-30. File: `players.json`.

298 real male players selected from 13 official men's first-team squad pages across the five requested leagues. This is a deliberately selected starter pool, NOT a complete league database. The roster is a snapshot of the public pages accessed on 2026-10-30; those pages can change and several explicitly label 2026/27. Do not present this as a permanent live transfer feed or as independently audited registration data. Loaned-out sections were excluded where shown. Club names are editorial display names.

## Primary roster sources accessed

| Club | League | Public official source |
|---|---|---|
| Liverpool | Premier League | https://www.liverpoolfc.com/teams/mens-team?position=all |
| Chelsea | Premier League | https://www.chelseafc.com/en/teams/mens-profiles |
| Manchester City | Premier League | https://shop.mancity.com/en/lifestyle/men/ |
| Barcelona | LaLiga | https://www.fcbarcelona.com/en/football/first-team/players |
| Real Madrid | LaLiga | https://www.realmadrid.com/en-US/football/first-team/players |
| Paris Saint-Germain | Ligue 1 | https://www.psg.fr/en/mens-football/squad |
| Monaco | Ligue 1 | https://www.asmonaco.com/en/pros/players |
| Marseille | Ligue 1 | https://www.om.fr/en/team/men |
| Bayern Munich | Bundesliga | https://fcbayern.com/en/teams/first-team |
| Borussia Dortmund | Bundesliga | https://www.bvb.de/de/de/mannschaften/fussball/maenner.html |
| Inter | Serie A | https://www.inter.it/en/teams/first-team |
| Juventus | Serie A | https://www.juventus.com/en/teams/first-team-men/squad/ |
| AC Milan | Serie A | https://www.acmilan.com/en/teams/men-first-team |

Corroborating official sources inspected:
- Liverpool September 3, 2026 registered-squad announcement: https://lfcbeta.liverpoolfc.com/es/noticias/liverpool-submit-premier-league-squad-list-2026-27
- Chelsea Premier League squad: https://www.premierleague.com/en/clubs/8/chelsea/squad?se=363
- Dortmund Bundesliga squad: https://www.bundesliga.com/de/bundesliga/clubs/borussia-dortmund/profil
- Juventus official store squad: https://store.juventus.com/ec/men-team
- Inter official store squad: https://store.inter.it/se/men-team

City's source is the official club shop's men's-team player navigation, not a full position-verified football resource. Its names/club membership are shown there; detailed football positions below remain editorial. No photos, badges, logos, EA cards, biographies, or source-specific written descriptions are included in this pack.

## Positions and identities

Names and current club membership were checked against the listed public roster pages. Most pages use only broad goalkeeper/defender/midfielder/forward groups. Detailed positions GK/CB/LB/RB/DM/CM/AM/LW/RW/ST and secondary eligibility are EDITORIAL gameplay judgments based on recognizable playing roles, not claimed verbatim official position data. Primary role appears first. Stable IDs are normalized name slugs, independent of clubs. Real-world name collisions in future expansions should use a permanent distinguishing suffix rather than club names. No special-card duplicates.

Some players use their familiar professional names (Rodri, Vanderson, Endrick, etc.) rather than full legal names. Names are Latin display forms. Persian transliterations are intentionally omitted until reviewed. A few official public pages contain recent transfers different from older seasons; the pack follows the accessed pages rather than old recollection.

## Rating provenance: our own estimates, NOT EA

Every number is an ORIGINAL, provisional editorial game estimate. No EA numerical rating was imported or copied. No provider's match rating or statistical performance score was imported. These ratings are not objectively measured current performance and must never be labeled EA FC, official, or licensed EA ratings.

Recommended user-facing attribution: «امتیازها برآورد اختصاصی فارسیدل برای این بازی هستند.»

Overall values (62–94 in this pack) were manually estimated to create a usable range between elite, established, rotation and young players. Ability fields are generated from primary-position templates around that custom overall, with deterministic small differences and individual editorial adjustments for recognizable styles (for example, Kane has lower pace and stronger passing; Haaland has stronger physical play; Alexander-Arnold has stronger passing; modern distributing goalkeepers have stronger passing). This does NOT incorporate up-to-date season form, current injury status, real stamina tests, or professional scouting data.

Outfield template offset order: pace, shooting, passing, dribbling, defending, physical, stamina, goalkeeping. Values are clamped 8–97; name-based deterministic jitter ranges −3 to +3.
- CB: −13, −40, −13, −20, +2, +3, −5, −72
- LB/RB: +5, −26, −6, −3, −2, −6, +1, −72
- DM: −9, −20, 0, −5, 0, 0, +4, −72
- CM: −6, −12, +3, 0, −17, −8, +3, −72
- AM: −1, −5, +3, +5, −41, −16, −2, −72
- LW/RW: +9, −4, −4, +5, −46, −17, −3, −72
- ST: 0, +5, −15, −6, −48, 0, −7, −72
- GK outfield fields: −45, −62, −32, −48, −59, −8, −25; numerical goalkeeping equals custom overall.

GK records additionally contain goalkeeperSkills {diving, handling, kicking, reflexes, positioning}, around custom overall with offsets 0/−1/−3/+2/0 and small deterministic differences. These are also our own estimates. All players have a numeric goalkeeping field for a simple common engine interface.

The checked-in `players.json` is the reviewable source of the starter pool. Edit a new version when expanding; do not overwrite the frozen dataset of existing rooms.

## Coverage and limits

League counts: Premier League 72; LaLiga 46; Ligue 1 64; Bundesliga 46; Serie A 70.
Primary-role counts: GK 39, CB 59, LB 27, RB 18, DM 17, CM 47, AM 24, ST 31, RW 18, LW 18.
The 298 unique records comfortably exceed 8 × 11 picks and include adequate goalkeepers, center-backs, fullbacks, midfielders and attackers for common formations. Engine should still enforce legal draft completion and position availability.

Public source visibility is not a blanket commercial data license. This starter pack includes minimal factual identity/club information plus original numeric gameplay estimates, with no copied EA ratings or visual assets. Provider contracts and paid subscriptions are not required or used for this local prototype. If later using EA values or a full automated external feed, inspect its reuse terms separately.

Freeze a roster/version snapshot when a room starts; later content edits should not change active tournaments. This recommendation protects gameplay consistency, not currentness guarantees.
