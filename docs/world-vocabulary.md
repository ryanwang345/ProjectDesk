# World-topic vocabulary

The seed library now contains **10,611 unique headwords** at the scale of the Longman Dictionary (LDOCE / Longman Communication 9000+): 570 Academic IELTS headwords, 60 world-topic terms, and 9,981 comprehensive vocabulary headwords. User-created cards may increase the actual library
total. Each new entry has a Chinese meaning, part of speech, a short original
English definition, and ten original contextual examples (600 examples total).

| Topic | Added words |
| --- | --- |
| Geography | archipelago, peninsula, estuary, tributary, plateau, hemisphere, latitude, longitude, equator, watershed |
| Environment | biodiversity, ecosystem, deforestation, reforestation, wetland, mangrove, aquifer, biodegradable, pollinator, microplastic |
| Sustainable cities | sustainability, renewable, decarbonization, electrification, desalination, urbanization, gentrification, congestion, pedestrianization, ecotourism |
| Global affairs | diplomacy, sovereignty, bilateral, multilateral, ceasefire, diaspora, globalization, interdependence, remittance, tariff |
| Health and development | literacy, numeracy, sanitation, vaccination, epidemiology, malnutrition, pandemic, antimicrobial, telemedicine, microfinance |
| Travel and weather | itinerary, layover, stopover, visa, consulate, monsoon, cyclone, glacier, tsunami, multiculturalism |

## Loading and storage

Content has been migrated into PostgreSQL schema migrations (`migration 17` in `server/internal/desk/migrate.go`).
The startup transaction and schema migration insert terms into ordinary PostgreSQL `english_cards`, with their
definitions in `senses` and examples in `examples`. Existing words are matched without case sensitivity and
retained, including learner edits, card IDs, and review state. Repeated startup
does not add duplicate cards or award XP. The English cache is invalidated after
the transaction commits.

The cards use the existing search, pronunciation, lesson, and word-level SRS
features. Their definitions and examples require no provider calls to load.
Optional pronunciation enrichment and additional AI notes continue to use the
application's existing services. Adding terms changes alphabetical lesson
groups; word-level SRS records retain their existing card IDs.

The 词库 header and alphabet counts now use the actual loaded cards in both
languages. Successful API responses are authoritative and no longer mixed with
client sample cards. Existing offline fallback behavior is retained. Review
labels describe saved review membership rather than fabricated mastery or dates.

## Verification

From `server`, run `go test -race -mod=vendor ./...`. Setting
`PROJECT_DESK_TEST_DATABASE_URL` to an isolated PostgreSQL database also runs
tests for insertion, cached reads, repeat startup, preserved learner edits and
review membership, full definitions/examples, and unchanged XP/streak. Those
tests create and clean their own database schemas. Content checks verify unique
new headwords, ten distinct examples, and absence of the generic seed templates.

From `project-desk`, run `npm run build`; from `e2e`, run `npm run typecheck` and:

```sh
E2E_BASE_URL=http://127.0.0.1:17311 npx cypress run \
  --browser electron --spec cypress/e2e/world-vocabulary.cy.ts
```

The browser spec reads the real authored JSON into isolated fixtures and checks
English/Chinese search, all ten examples, truthful totals, empty results, and
mobile width. It does not write learner data or call enrichment providers.
