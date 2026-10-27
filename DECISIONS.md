# Decisions

Calls made without stopping to ask, and why.

## Game

- **Physics constants** landed on the spec's values (run 70, gravity 950, jump 270) with a 0.42 jump-cut multiplier, ground accel 1400 / decel 1800 and air accel 1100. That gives a ~38 px full jump apex and ~40 px full jump distance, which sets the scale for every trap.
- **Player hitbox** is 6×10 px. Horns are visual only and sit outside the hitbox.
- **Spike hitboxes** are inset (1 px each side, 2 px from the top) so grazes don't kill.
- **Crush rule.** A solid that moves into the player kills them, except the floor they're riding, which carries them. This one rule covers the crusher, the jaws and falling platforms.
- **Closing walls** are vertical jaws (ceiling and floor) rather than horizontal walls. In a side view, horizontal walls closing across the only corridor would permanently block it. They start cycling the first time you approach, so the first slam is the surprise.
- **Sinking ledge** extends 12 px into the next section. Without that, a natural edge jump overshoots the ledge onto safe floor and the trap never fires. The "edge zone" is the last 4 px before the lip plus coyote time.
- **Second spike**: the hidden spike starts 2 to 4 px after the visible one and is 12 to 15 px wide. A tap-hop or an early full jump lands on it; a late full jump clears it.
- **Reverse zone** uses hysteresis: it switches on when your center enters and off only when your whole body is out. Without it, holding right jitters at the entrance forever, which reads as a bug rather than a trap.
- **Door troll** is a 36 px hop from x=268 to x=304 that fires when you get within 5 px. On non-troll days the door sits at x=304 from the start.
- **Bot solutions are reactive scripts** that read world state (allowed to "know" hidden traps, like a player who has studied the crowd's X marks). Each one records a plain input tape, and a test replays the tape to confirm determinism. Verified clean over 3000 consecutive days, not just 365.
- **Freeze frame and respawn**: 60 ms freeze, then the 0.4 s respawn timer, with no menus.
- **Render loop sleeps until the first input.** Nothing moves before the player does. This took Lighthouse mobile from 74 to ~96 locally.

## Data

- **Death batches.** The client sends `{ day, deaths: [...] }` (up to 50) as well as the single-death shape from the spec. Batching every 2 s with one request per 300 ms per player keeps the rate limit meaningful. A `429` re-queues the batch.
- **Section index** for a death is the trap section under the death x; start-runway deaths count toward section 1 and end-runway deaths toward section 4. The share grid has no separate door square color; 🚪 is always appended.
- **Extra stats fields.** `/api/day` also returns `totalDeaths` and `medianDeaths`, because the crowd line ("9,881 deaths · median 14 deaths") needs them. `deaths:{day}` is capped at 5000, so the running total lives in a hash counter.
- **TTL.** The death list keeps the spec's 3-day TTL. Clear sets and counters keep 30 days. So `/d/[day]` shows crowd marks for the last 3 days and plain practice after that.
- **Clear validation.** The minimum time is a flat-out run from spawn to the door's final spot × 0.9. Clears are first-wins per player (`ZADD NX`). The `inputsHash` (FNV-1a over the winning attempt's input tape) is stored but not re-simulated server-side; uploading and replaying the full tape would be the next anti-cheat step.
- **Player count** is a HyperLogLog (`PFADD players:{day}`), counted on first death or clear.
- **Offline.** If Redis isn't configured or errors, the API returns `503`, and the client shows a quiet offline note and keeps local stats in localStorage.
- **Timer** is wall-clock from your first input of the day and survives reloads, so reloading doesn't reset your time.

## Platform

- **Next.js 16** (current at build time): `middleware.ts` is now `proxy.ts`, which hands out the player cookie on page visits. Route handlers also set it if missing, so API-only clients work.
- **TypeScript 5.9** pinned instead of 7.x, for toolchain compatibility.
- **Share link** points to `/s?day&deaths&time&grid`, a small server-rendered landing page whose metadata carries the dynamic OG image. That keeps `/` fully static for performance.
- **OG font**: Silkscreen is fetched from Google Fonts at request time as TTF (Satori can't read woff2), cached per instance, with a fallback to the default font.
- **Repository**: `Lameda12/Daily-Devil` already existed (the session's git remote), so I pushed there instead of running `gh repo create Lameda12/daily-devil`.
- **No emoji in UI chrome.** The share grid is drawn with colored squares in the UI; emoji appear only in the copied share text, as the spec requires.
