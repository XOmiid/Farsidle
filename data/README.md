# Farsidle Classic content pack

Version: `classic-2026-10`. This pack replaces the old content for the new Classic release; it does not delete live user history.

- **741 Persian Wordle answers:** curated common vocabulary, 4–7 Persian letters, without whitespace or half-spaces. Arabic ي/ك are excluded. Display spelling retains آ; the rules normalize آ/ا for input. Canonically identical answers are deduplicated. The list supplies answers only. Guesses may be any combination of Persian letters of the required length; they do not need to appear in the answer list.
- **56 named colors:** an original palette spanning warm, cool, pastel, earth and neutral colors. RGB hex values are unique; names describe the palette rather than claiming a universal standardized color definition.
- **73 countries and 146 Factle clues:** two individually usable clues per country, rather than an ordered easy-to-hard hint ladder. Each daily Factle selects five different countries and one clue for each. Clues are original short Persian location descriptions; no UNESCO prose is reproduced. Each country carries its own official UNESCO source URL.
- **73 Teamdle capital pairs:** each country record holds its national capital and an `otherCity` distractor from the same country. Teamdle always presents those two cities in random order. Where a country has multiple capital functions, the field uses the familiar administrative/national answer (Pretoria for South Africa; Sri Jayawardenepura Kotte for Sri Lanka; Kuala Lumpur for Malaysia; Bern for Switzerland).
- **32 musical chords:** original MIDI configurations combining four chord qualities over eight registers. There are no external audio files or sampled recordings.
- **Four mini crosswords:** original clues and grids, IDs 1–4, each costing 1,000 coins. Across/down crossings agree, every white cell belongs to a clue and unused cells are black.
- **Memorydle:** generated from fresh daily seeds; the two number ranges are 0–99 and 100–999, with five targets among fifteen distinct choices.

## Sources and editorial scope

The [UNESCO World Heritage List](https://whc.unesco.org/en/list/) and the individual [States Parties listings](https://whc.unesco.org/en/statesparties/) are the primary references for the heritage-location clues. All 73 country listing URLs in `catalog.json` were opened during preparation on 30 October 2026. Clues avoid changing officeholders, prices, population counts, rankings and disputed superlatives. UNESCO URLs document the heritage clues; they are not represented as the source for capital spellings or Persian vocabulary.

Capital names use conventional Persian spellings. This is a deliberately curated country selection, not a claim to cover every country in the world. Shared heritage properties are described by the named site/component in the selected country.

Run `npm run data:validate` before importing an edited content pack. It checks canonical word uniqueness and alphabet, color format/uniqueness, country IDs, distinct capital/city pairs and source links, musical ranges, crossword boundaries, numbering and complete grid coverage.

For the Gulf city alternatives, see the official [Visit Qatar city guide](https://visitqatar.com/intl-en/about-qatar/cities) for Al Khor and [Bahrain’s Ministry of Housing](https://housing.gov.bh/muharraq-city-development) for Muharraq. City labels use conventional Persian spellings. Multi-capital countries use a distractor that has no competing national-capital role (Johannesburg for South Africa, Kandy for Sri Lanka and George Town for Malaysia).
