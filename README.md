# Daily Devil

A daily troll platformer for the web. One single-screen level per day, identical for every player on Earth, generated from the UTC date. A new level drops at 00:00 UTC.

The level looks harmless and betrays you: floors collapse, spikes pop up, ceilings fall, ledges sink, and the exit door runs away. Every player's death position is stored, so when you play you see faint X marks where everyone else died today. The crowd's deaths are the hint system. Clear it and you get a Wordle-style share card.

```
Daily Devil #1
14 deaths · 42.3s
🟩🟨🟥🟧🚪
```

## Run it locally

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # PRNG, solvability bot (365 days), API validation
npm run build      # runs the tests first, fails if any day is unbeatable
```

Without Redis env vars the dev server uses an in-memory store, so crowd stats and death marks work locally (they reset when the server restarts). In production without Redis the API answers `503` and the game runs fully offline with local stats only.

## Environment variables

Provided automatically by the Upstash Redis integration from the Vercel Marketplace. Either pair works:

| Variable | Purpose |
| --- | --- |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Upstash REST endpoint and token (Vercel KV-style names) |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Same, Upstash-style names |
| `NEXT_PUBLIC_SITE_URL` | Optional. Absolute origin for OG metadata. Defaults to the Vercel production URL. |

Pull them with `npx vercel env pull .env.local`.

## How a day's level is generated

1. **Seed.** `cyrb53("daily-devil:YYYY-MM-DD")` gives a 32-bit seed for `mulberry32` (`game/prng.ts`, `game/level.ts`).
2. **Pick.** A seeded Fisher-Yates shuffle of the 8 trap types; the first 4 become the day's sections, in that order. One more draw decides the door troll (65% of days): the door hops 36 px away on your first approach.
3. **Lay out.** 320×180 screen: a 36 px safe start runway, four 55 px trap sections, a safe end runway with the door. Each trap is built from a second seeded stream (`seed ^ 0x9e3779b9`) that jitters its geometry and timing within ranges that keep it fair.
4. **Prove it.** Every trap file ships a scripted solution. `tests/solvability.test.ts` runs a headless bot through the real simulation for the next 365 days, plus 300 jitter seeds per trap type in isolation, and replays the recorded input tape to confirm the sim is deterministic. A player who only holds right must die on every day.

### The traps (`game/traps/`)

| Trap | Betrayal | Solution |
| --- | --- | --- |
| Trapdoor | A floor segment drops when you stand on it | Jump over it |
| Pop-up spikes | Hidden spikes burst up as you approach | Jump early |
| Crusher | A block hidden in the ceiling slams down and stays as a wall | Stop, let it land, hop it |
| Sinking ledge | The ledge across the gap sinks if you take off from the lip | Jump early |
| Second spike | A visible spike, and a hidden one where a minimal hop lands | Long jump |
| Closing walls | Ceiling and floor jaws slam shut on a loop | Wait, time the pass |
| Fake floor | A tile that looks solid isn't | Jump over it |
| Reverse zone | Left and right swap inside a marked strip, with a spike inside | Press the other way, hop the spike |

## Architecture

```
game/          framework-free engine
  tuning.ts    every feel constant (run 70 px/s, gravity 950, jump 270, coyote 80 ms, buffer 100 ms)
  world.ts     fixed 120 Hz sim: AABB collision, carry and crush, hazards, door
  traps/       one file per trap, each with reset/update/bot
  engine.ts    fixed-timestep loop, juice (shake, freeze frame, squash, particles), events → sound
  render.ts    canvas renderer at 320×180, nearest-neighbor scaled
  audio.ts     Web Audio synth, no files
app/           Next.js App Router pages and API routes
lib/server/    Redis store, validation, cookie identity
lib/client/    localStorage state and the batched death reporter
tests/         Vitest
```

### API

| Route | |
| --- | --- |
| `POST /api/death` | `{ day, x, y, section }` or `{ day, deaths: [...] }` (≤ 50). Day must be today (UTC), coordinates in bounds, 1 request per 300 ms per player. Stored in `deaths:{day}`, capped at 5000, 3-day TTL. |
| `POST /api/clear` | `{ day, deaths, timeMs, inputsHash }`. One per player in `clears:{day}`. Times faster than a flat-out run to the door are rejected. |
| `GET /api/day/{day}` | `{ deaths: [[x,y],...] (≤ 2000), players, clears, totalDeaths, avgDeaths, medianDeaths, medianTime }`, `s-maxage=15`. |
| `GET /api/og` | Share card image (`?day=&deaths=&time=&grid=`). |

Players are anonymous: a random id in an httpOnly cookie (1 year), set by `proxy.ts` on first visit.

## Controls

Arrows or WASD to move, Space / W / Up to jump. On touch screens, on-screen ◀ ▶ JUMP pads appear.
