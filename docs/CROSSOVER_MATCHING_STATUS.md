# Crossover Matching Status

Status: Parked

Crossover Matching has a tested backend, but the product is not enabled for
travelers yet. The public tRPC boundary blocks `crossover.*` procedures and the
manual cron route returns `503` unless `CROSSOVER_MATCHING_ENABLED=true`.

The consolidated cron route is `/api/cron/crossover-sweeps`. It remains in the
codebase for manual validation and future launch work, but it is intentionally
absent from `vercel.json` so production cannot run the lifecycle sweeps on a
half-built UI.

Do not set `CROSSOVER_MATCHING_ENABLED=true` until the traveler-facing warning,
discovery, proposal, escrow, chat/SSE, and observability surfaces are shipped.
