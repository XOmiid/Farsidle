# Verified heights and editorial simulation traits

Research snapshot: 2026-10-31. Factual source notes; ability estimates remain editorial.

`players.json` contains 45 source-linked height records with factual heightCm, official primary-source URL and verification date. 44 IDs match the existing 298-player pool; kevin-de-bruyne is the additional requested real player. This is partial verified coverage, not a complete physical database. Unknown heights remain absent. Values represent the public source's listed height; they are not fresh medical measurements. Some Bundesliga profiles still show former clubs and some heights may date from earlier seasons. Do not use these height sources to update club membership.

Important examples:
- Erling Haaland195cm, Nick Woltemade198cm and Thibaut Courtois200cm are listed in the Premier League's July28,2026 tallest-player feature: https://www.premierleague.com/en/news/4054531
- Harry Kane188cm: https://fcbayern.com/en/teams/first-team/harry-kane
- Kylian Mbappe178cm: https://www.realmadrid.com/en-US/football/squad/kylian-mbappe
- Lautaro Martinez174cm: https://www.inter.it/en/news/2018-07-4-lautaro-martinez-is-a-nerazzurri-player (2018 announcement; dated explicitly in record). Current league page corroborates174cm: https://www.laliga.com/en-GB/player/lautaro-martinez
- Phil Foden171cm: https://www.englandfootball.com/england/mens-senior-team/squad/phil-foden
- Jeremy Doku173cm: https://www.bundesliga.com/en/player/jeremy-doku
- Brahim Diaz170cm, Rodrygo174cm, Vinicius Junior176cm and Endrick173cm: official Real Madrid individual URLs in each record.
- Arda Guler OMITTED: Real Madrid page currently displays malformed unit '1,75 cm'. Do not silently reinterpret that as a verified175cm without another primary source.

## Additional requested selectable player

Kevin De Bruyne: English display name Kevin De Bruyne; suggested stable id kevin-de-bruyne; club SSC Napoli; league serie-a; official role midfielder; height181cm. Detailed ['CM','AM'] eligibility would be editorial.
- Current official Serie A profile, Napoli and1.81m: https://en.legaseriea.it/players/kevin-de-bruyne
- Club announcement includes181cm and midfielder: https://sscnapoli.it/sscn-ufficiale-lingaggio-di-de-bruyne/
- Current2026/27 UEFA corroboration: https://www.uefa.com/uefachampionsleague/clubs/players/250008901--kevin-de-bruyne/

## Primary play-style evidence, separate from numeric ratings

These sources support recognizable styles, not numerical game scores:
- Michael Olise: Bayern describes him as a right-sided attacker who also operates behind the striker, with dribbling and chance-creation strengths: https://fcbayern.com/en/teams/first-team/michael-olise
- Jamal Musiala: Bayern highlights close control and dribbling at speed; listed186cm demonstrates why tall must not automatically mean dominant heading: https://fcbayern.com/en/teams/first-team/jamal-musiala
- Jeremy Doku: City has a club training video of him teaching dribbles: https://www.mancity.com/citytv/mens/learn-three-dribbles-with-doku-63883944 . Premier League analysis discusses his dribbling threat: https://www.premierleague.com/en/news/4432018/analysis-doku-adding-end-product-to-match-dribbling-skills
- Trent Alexander-Arnold: Liverpool's2020 interview discusses his crossing technique after two assists: https://www.liverpoolfc.com/news/first-team/388172-trent-alexander-arnold-liverpool-west-ham-assists-reaction (historical style evidence, not current club evidence).
- Harry Kane: Bayern's January2025 analysis reports his first18 club penalties all converted: https://fcbayern.com/en/news/2025/01/the-secret-to-success-behind-harry-kanes-perfect-run . Treat as historical evidence of penalty technique, not a current100% probability or guarantee.
- Lautaro Martinez: Inter's2018 announcement describes a mobile, strong forward able to use both feet and play centrally or alongside a striker: https://www.inter.it/en/news/2018-07-4-lautaro-martinez-is-a-nerazzurri-player

## Optional editorial game scores

The additional numerical ability fields in `players.json` are provisional original gameplay estimates (heading/crossing/longShots/freeKicks/penalties/composure). They are Farsidle design judgments, NOT EA attributes, official scouting metrics, or direct conversions from the cited qualitative evidence. Neither this file nor the factual map makes interpersonal claims. Discipline scores were deliberately not inferred from personality or off-field matters.

Simulation recommendation: crossing quality should compete with defensive aerial positioning, jump/heading ability, pressure and height/reach; height should provide a modest contextual input rather than setting heading skill. A smaller forward can have better timing and heading than a taller attacker. Separate the cross reaching its target, the aerial duel, and final shot accuracy. Unknown heights should not create a factual number; use neutral internal reach weight alongside explicitly editorial aerial ability, without presenting that weight as measured height.

Any De Bruyne/Courtois chemistry penalty is a fictional game rule requested by the user. It must be clearly labeled fictional and must not be explained through alleged personal history.
