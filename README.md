# Token Radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/majidaji1/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/majidaji1/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token-launch radar: it reads one frozen snapshot of the protocol universe (DefiLlama, fetched 2026-11-14),
finds every protocol whose **token does not exist yet**, ranks them by an **implied value**, and shows a reader
how to farm each one. Entered on [make.fun](https://make.fun)'s *Build the best token launch radar* bounty.

## The model (`radar-2`)

Implied value is a comparable-token valuation scaled by a launch-readiness blend, derived only from the
snapshot's own figures — no protocol name is special-cased and no row is hand-picked:

```
implied   = round( tvl_usd x fdv_multiple x ageDecay x readiness )
readiness = 0.25 + 0.20·size + 0.35·momentum + 0.15·persistence + 0.05·breadth
```

- **size** — TVL on a log scale from \$10M to \$500M
- **momentum** — clamped 7-day TVL growth, −25% to +35%
- **persistence** — days the protocol has run with no token, to 540
- **breadth** — number of chains it is deployed on, to 4
- **ageDecay** — the comparable multiple decays toward `0.4` with age: a token long delayed carries less upside

Protocols whose token already trades are separated out and shown at the market's own market cap, never mixed
into the pre-token ranking.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input snapshot.json
```

Writes `out/board.json` (the ranked board), `out/data.js` + `out/dashboard/` (a static, no-network page) and
`out/dossier.json`. Open `out/dashboard/index.html` for the board, a detail view per protocol, and a filter.

Self-check every gate rule (dossier byte-identical to `buildDossier`, ranks, coverage, screenshot dims):

```sh
SNAPSHOT=snapshot.json node selfcheck.ts
```

## Files

- `main.ts` — reads the snapshot, writes the board, dashboard and dossier
- `lib/model.ts` — the `radar-2` model: implied value, readiness factors, farm plans
- `dashboard/` — the static page (no framework, no network)
- `screenshots/` — board, a protocol's detail view, a filtered view
- `vendor/makefun-board.ts` — make.fun's dossier library

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
