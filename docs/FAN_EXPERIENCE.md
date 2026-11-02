# Fan experience and contracts portal

The November 2 interface update makes the main fan workflow easier to find: choose teams, route assets, understand the trade check and share a versioned proposal. The contracts portal adds a separate place to compare salaries and understand options before building a deal.

## Interface decisions

- A compact introduction, quiet chalk/navy surfaces and court-blue actions put the actual NBA teams and players first. Existing team identity and headshots carry the basketball context.
- Searchable team choices collapse after two teams are added. Player cards expose readable salaries, basic stats and named destination buttons. Contract years, draft rights, exceptions and matching settings remain available through disclosure controls.
- Desktop places trade checks beside rosters; phones use team switches and a persistent result shortcut. Dragging starts only from a grip so ordinary card scrolling stays available. Keyboard routing preserves a stable next focus target and announces the move result.
- Resetting, changing seasons and removing teams require an in-page choice. Removing a receiving team returns assets owned by other teams. Direct home visits and navigation from contracts preserve saved historical boards; a conflicting explicit season offers Resume or Start before replacing inputs.
- Shared proposals use the same palette and retain their saved inputs and verdict. Opening a different saved proposal asks before replacing a working board. Public discussion, the rules guide and account-free sharing remain available.

## Contracts data and scope

The portal reads the same source-dated roster snapshot as the builder. Current coverage is 523 rostered players across 30 teams. It offers URL-backed player/team/position/contract-feature filters, sortable cap-hit years and listed commitments, pagination, option markers, guarantee-status notes and per-player source links. The historical snapshot is labeled as an archive with incomplete point-in-time ownership.

SalarySwish public cap sheets supply current contract facts and ESPN supplies roster biographies. Basketball-Reference's contracts page informed the comparison-table workflow; it is a reference, not the portal's live feed.

Listed commitments include options and are not guaranteed-money totals. Missing future amounts are unknown, rather than zero. A two-way $0 figure is a cap charge and does not establish cash earnings. Waived-player dead money, cap holds and unrostered free agents are outside the portal. Future columns retain the selected snapshot's ownership and do not establish free-agency status.

## Verification

All 242 tests in 40 files pass, including new regressions for future-amount sorting, commitments, filters, team removal, direct contracts hydration, historical-board preservation, explicit shared-proposal replacement and review dialogs escaping a clipped workspace. Lint, TypeScript, structural roster and legacy transaction checks pass. Remote CI also builds and audits the production dependencies.

Hosted Chrome checks cover desktop and 390×844 phone layouts; player search and routing; reset cancellation, keyboard focus and historical season navigation; contract search, combined filters, year sorting, pagination, URL reload and expansion; two-way disclosures; and light/dark rendering without page-level horizontal overflow. Cap tables intentionally scroll. This is not a certification of every browser or complete accessibility conformance.

Design work applies [Anthropic Frontend Design](https://github.com/anthropics/skills/tree/main/skills/frontend-design) and [Vercel Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines). Parallel implementation, primary-source research and code review were used, with browser verification against the integrated result.
