# DINO OVERDRIVE

Standalone arcade remix of Chromium's offline Dino. This is a new game implementation using the official Chromium dinosaur, cactus, and bird sprite artwork. It does not patch chrome://dino or Chrome itself.

## Play

- Space / Up / W or tap: jump, with one extra jump in the air
- Down / S or hold the duck button: duck; in the air, fall faster
- P / Escape: pause; switching tabs also pauses
- M: toggle sound (off by default)
- Collect eight coins to charge six seconds of invincible, coin-attracting, double-score fever
- Best score and sound / reduced-motion preferences are saved only in localStorage

Static HTML/CSS/ES modules with locally vendored Three.js r180 for the playable scenes, no external fonts, network score submission, analytics, real ad delivery, purchases, or application accounts.

## Run locally

Serve dist with any static HTTP server. For example: `python3 -m http.server 4173 --directory dist`.

## Deploy with pnpm, Vite+, and cf

The complete game is in `dist/`, including its images, Three.js modules, and licenses. Deployment uses the official **cf CLI**, pinned to `1.0.0-beta.12`, the latest npm release verified on 2026-10-07. `cf` is currently in open beta.

`cloudflare.config.ts` defines an assets-only Worker. The Cloudflare Vite plugin 2.0 beta copies `dist/` as Vite's public directory into Cloudflare Build Output. All game assets remain unchanged. There is no Worker entrypoint, server bundle, backend, runtime binding, database, or runtime secret. The project does not install or invoke Wrangler.

The build-only dependencies and their exact versions are recorded in `package.json` and `pnpm-lock.yaml`. The project pins **pnpm 10.11.1** (matching Cloudflare's documented default) and **Vite+ 1.0.0**. Vite+ supplies the project-local `vp` CLI; no global Vite+ installation is required. Its matching Vite core alias and Vitest override are kept together in `pnpm-workspace.yaml`. Use Node.js **22.18+ within 22.x, 24.11+ within 24.x, or 26+**. Cloudflare's default Node.js 24 build image is suitable.

### GitHub integration settings

Connect `AkaakuHub/dopa-dino` through Cloudflare's own GitHub integration: **Workers & Pages → Create application → Import a repository**. For an existing Worker, use **Settings → Builds → Connect**.

- Worker/project name: `dopa-dino`
- Production branch: `main`
- Root directory: repository root (leave blank or `/`, depending on the dashboard field)
- Build command: `pnpm run build`
- Deploy command: `pnpm run deploy`
- Optional build variable: `CF_SEND_TELEMETRY=false`

Cloudflare installs the dependencies from the committed pnpm lockfile. The build command runs `vp build`; the Cloudflare Vite plugin emits `.cloudflare/output/v0/`. The deploy command runs `cf deploy --prebuilt --mode production`, deploying the exact output of the preceding build. The production mode must match the Vite build. Replace the dashboard's default deploy command with the command above.

Pushes to the configured branch trigger Cloudflare Builds. No GitHub Actions workflow is used. The GitHub connection and Cloudflare build credentials belong in the Cloudflare dashboard; never commit tokens or login files. Dashboard authorization and an actual deployment are separate from local build validation.

### Local validation

Run `pnpm install --frozen-lockfile`, then `pnpm run build`, then `pnpm run check`. The check invokes `cf deploy --prebuilt --mode production --dry-run`; it validates the assets-only deployment without authentication, API calls, or an upload. Generated `.cloudflare/` output is ignored by Git.

With a global `vp` CLI, use `vp install --frozen-lockfile`, `vp build`, and `vp run check`. Use `vp run deploy` only when ready to publish. `vp run check` runs this project's deployment dry-run script; the built-in `vp check` is a different lint/format/type-check command.

Do not use `cf init` to regenerate this configured project. Its generic static-site autoconfiguration may choose different build tooling.

### Custom domain: dopa-dino.akaaku.net

After deploying, verify that `akaaku.net` is an active zone in the selected Cloudflare account and inspect existing DNS records and Worker routes for `dopa-dino.akaaku.net`. Resolve any existing use deliberately before replacing it.

Open **dopa-dino → Settings → Domains & Routes → Add → Custom Domain** and enter `dopa-dino.akaaku.net`. Cloudflare manages the DNS record and TLS certificate. An existing CNAME at this hostname prevents adding the Custom Domain; do not delete unrelated DNS records. Verify domain activation and HTTPS afterward.

Domains and fetch triggers are intentionally omitted from `cloudflare.config.ts`, with `workersDev` and `previewUrls` disabled. The domain is managed in the dashboard. The first deployment has no public endpoint until that Custom Domain is added. The game has no built-in sign-in gate, so the configured domain is public unless access protection is configured separately.

Official references, checked 2026-10-07: [cf installation](https://developers.cloudflare.com/cf/get-started/), [cf project builds](https://developers.cloudflare.com/cf/projects/), [programmatic configuration](https://developers.cloudflare.com/cf/projects/cloudflare-config/), [cf CI](https://developers.cloudflare.com/cf/ci/), [Workers Builds settings](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/), [Workers Builds tool versions](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/), [Vite+ project-local CLI](https://viteplus.dev/guide/local-cli), [Vite+ 1.0 release](https://github.com/voidzero-dev/vite-plus/releases/tag/v1.0.0), and [Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).

## Sources and attribution

Pixel sprite artwork: Copyright The Chromium Authors, distributed under the BSD 3-Clause license in dist/LICENSE.txt.

- Sprite: https://chromium.googlesource.com/chromium/src/+/main/components/neterror/resources/images/default_100_percent/offline/100-offline-sprite.png
- Reference: https://chromium.googlesource.com/chromium/src/+/main/components/neterror/resources/dino_game/
- License: https://chromium.googlesource.com/chromium/src/+/main/LICENSE

No endorsement by Google or Chromium contributors is implied. Gameplay, interface, rendering, and arcade mechanics are an independent implementation.

## MAX upgrade

- Shift / X or the large BOOST card: 2.6 seconds of invincible acceleration, coin magnet, and double scoring. Three-second post-boost cooldown; energy recharges over ten seconds or faster with coins. Every run begins charged.
- Smooth acceleration with desktop/mobile speed limits and speed-aware spawn spacing. Protection briefly persists while slowing down.
- Four 600 m sectors repeat: neon city, sunset dunes, low-gravity lunar orbit, and aurora ice. Each sector grants 250 points, some boost energy, a transition safety window, and a fresh obstacle queue.
- Boost + fever multiplies points by four. Rainbow afterimages, expanding impact rings, combo fireworks, and stage-entry celebrations have bounded particles (260), rings (12), and score labels (24). No white-screen flashes, camera shake, or strobing. Reduced-motion disables particles, rings, speed lines, and moving afterimages.
- Stage backdrop atlas is original generated pixel art. Chromium sprite attribution is unchanged.

Checks: `node test-engine.mjs && node test-upgrade.mjs && node test-ui.mjs`.
The UI integration test uses DOM/canvas stubs; it verifies event bindings and HUD updates, not browser rendering or real-device performance.

## Full-screen playable games

- After a collision, choose 広告で復活. Unlimited revivals retain score, coins, combo, distance, stage and boost charge. Obstacles are cleared and a three-second collision shield protects each return.
- An opaque full-screen creative slides up once per opening over 400 ms. Reduced-motion preferences suppress the entrance animation. The background runner, page scrolling and background controls stay paused.
- Compact rewarded-ad chrome contains the game title, a small ad label, three live stats, controls and a countdown. Skip unlocks after five active, visible seconds. There is no automatic exit or install prompt. Each objective round has a visible active-play time limit and a success/failure result; replay and next-game controls permit indefinite play. Blur, hidden tabs and input cancellation are handled separately from game progress.
- A shuffled game bag visits every game once before refilling and prevents adjacent repeats across boundaries.

### Ten original real-time 3D games

1. FROSTFIRE CAMP: gather six logs at snow-covered trees and deliver them to a glowing furnace. Carrying models, working crew, snow, chimney smoke and fire have bounded effects.
2. CITY FEAST: grow a moving hole by swallowing street props, cars and buildings. Movement is unconstrained. A deterministic 3×3 neighborhood of 16-unit chunks streams around the player, retaining at most 234 item records. Road tiles and detailed object archetypes are instanced with fixed capacities. Swallowed objects tilt and sink; the camera follows and smoothly widens as the hole grows. Departed chunks are discarded and may regenerate when revisited; there is no persistent visited-map growth.
3. SPIRAL DROP: rotate thick platform rings in the direction of the drag. Three consecutive gaps charge a fireball; the next solid platform, including a red hazard, shatters without stopping descent. A safe bounce resets the combo and an uncharged red hit ends the round with a result. Nine ring slots and forty shared-geometry fracture pieces are recycled. Input and visible geometry use the same angular convention.
4. CROWD RUSH: steer a helmeted squad through paired arithmetic gates, avoid barricades, fight opposing crowds and defeat bosses. Crowd growth, shooting, gate labels and formations are rendered in 3D with bounded pools.
5. SKY STACK: tap to land an alternating-axis sliding slab. Actual overlap trims the tower footprint; overhangs tumble, precise landings build combos and missed placements end the round with a result. Tower levels and fragments recycle.
6. POCKET PUTT: drag backward from the ball and release, or aim with the keyboard, to bank a putt around walls, ramps and sand. Six course layouts cycle and mirror, with strokes/par scoring and a bank-aware aiming guide.
7. NEON BREAKER: steer a paddle beneath a ricocheting ball to clear layered brick patterns. Armored bricks and wide-paddle, fireball and slow-ball pickups vary the waves; three lives and explicit replay retain indefinite play.

8. NEON RANGE: first-person pulse blaster versus moving drones in a lit 3D hangar. Drag/hold to aim and fire; release into cover and reload, or use arrows/Space/Enter. Hit 12 drones before the 45-second timer or three shields run out.
9. TREASURE PINS: four vertical water/lava/treasure chambers with gravity-driven drops. Pull the water pin, cool the connected lava basin, then route twelve gems to the chest. Pulling in the wrong order can destroy the treasure.
10. ORBIT MERGE: aim and drop numbered 3D orbs into a gravity cabinet; identical values collide and merge. Create 32 (64 on every fourth round) before an overflow. Physical separation, danger timing, bounded particles and original numbered geometry keep the rules visible.

All scenes use locally vendored Three.js r180, original procedural geometry, soft PCF shadows and shared material caches. Static decoration is merged by material. New game modules add no dependencies. Dynamic geometry and effects are bounded, and scene geometries, materials, textures, shadow maps and renderer lists are disposed on dismissal. The reusable WebGL context is retained; the main runner remains Canvas 2D. No reference screenshots, third-party game logos, external ad SDKs, tracking, ratings, purchase buttons or installation claims are embedded.

Official reference pages reviewed on 2026-10-07:
- Whiteout Survival: https://apps.apple.com/us/app/whiteout-survival/id6443575749
- Hole.io: https://play.google.com/store/apps/details?id=io.voodoo.holeio
- Helix Jump: https://play.google.com/store/apps/details?id=com.h8games.helixjump
- Last War: https://play.google.com/store/apps/details?id=com.fun.lastwar.gp
- Mob Control: https://play.google.com/store/apps/details?id=com.vincentb.MobControl
- Google rewarded-ad demo: https://codelabs.developers.google.com/codelabs/admob-ads-in-flutter
- Unity playable creative guide: https://storage.googleapis.com/unity-ads-aui-prod-deployments/external-app/UnityAds_Playable_guide.pdf

References inform visual and interaction choices, not official affiliation. Five-second skip is the requested app behavior, not a claim that every rewarded-ad network uses the same duration.

### Validation

Focused suite: `node test-ui.mjs && node test-ads.mjs && node test-ad-lifecycle.mjs && node test-three-scene.mjs && node test-helix-rules.mjs && node test-gates-stack.mjs && node test-golf-breaker.mjs && node test-endless-city.mjs`.

Tests cover active-visible skip timing, unlimited play/revival, input interruption and pointer cleanup, seven-game shuffle, mathematical model interactions, streamed-city bounds, actual fracture geometry, projection/raycasting, bounded scene graphs and disposal. DOM and renderer stubs are explicitly not GPU or real-browser evidence. Browser pixel/input QA must be recorded separately against the deployed version.

### Procedural soundtrack and effects

Every game has an original Web Audio score: synthwave for DINO, warm bells for FROSTFIRE CAMP, syncopated bass for CITY FEAST, driving arpeggios for SPIRAL DROP, a brass-like march for CROWD RUSH, airy mallets for SKY STACK, soft lounge plucks for POCKET PUTT, and chiptune for NEON BREAKER. Event-specific effects cover gathering, delivery, growth, bouncing, drops, fractures, gates, combat, stacking, putting, bricks and power-ups. No downloaded audio, external requests or new dependencies are used.

The main sound icon, the icon inside each playable game, and M use one saved master toggle (off by default). Audio starts only after a user gesture. A single context and the existing animation loop drive a 140 ms look-ahead scheduler with at most 48 voices. Transitions stop the previous score and effects; pause, blur, hidden tabs and mute silence active voices. Resuming does not replay missed notes or muted gameplay events. No audio intervals or per-game DOM listeners are allocated.

Audio checks: `node test-audio.mjs && node test-ui.mjs && node test-ad-lifecycle.mjs`. The audio API is mocked for lifecycle, score distinction, event coverage, scheduling bounds and cleanup tests; actual speaker output and device latency require real-browser listening.

### Incremental arcade lab

Each completed objective or failure now freezes into an explicit result. Ten live games have objective progress and active-play countdowns; the skip still unlocks after five active, visible seconds and preserves unlimited revivals. Replay starts a new independent round, while Next draws from the shuffle bag. Skipping or restarting never awards materials. Failure payout is 0–4 based on demonstrated objective progress; idle failure pays zero. First clear pays 8, with consecutive clear chains growing to 16. Settlement runs exactly once per round and saves a bounded 64-receipt history.

DINO LAB launches any available game directly and shows its dedicated material, next threshold, permanent skill level and actual effect. The first clear earns the first skill level. Ten bounded skill definitions support up to 10 levels each; all ten playable games appear in the lab. Existing games provide recharge, permanent coin attraction, stronger jumps, longer revive protection, combo retention, dodge-score bonuses and extended boost. Total skill milestones at levels 3, 8, 15, 25 and 40 multiply main-run coin/time/dodge/stage scoring ×2/4/8/16/32. Clear-chain rewards and visible level-up results make progress immediately legible. No offline earnings, external economy or payments.

Progression uses a versioned, validated local save, migrates the version-1 material shape, clamps values and receipt memory, preserves old best/sound settings, and reports unavailable storage as session-only. Higher unknown save versions are never overwritten. New checks: `node test-progression.mjs` plus the expanded UI regression suite.

The last three materials unlock an actual obstacle-targeting auto-blaster, a permanent coin-value multiplier and longer fever invincibility. Camera setup supports the range's perspective projection; cabinet pointers intersect their vertical gameplay plane. Static batching now separates indexed/non-indexed and attribute-incompatible geometries so a failed merge cannot silently discard visible parts.

Focused expansion checks: `node test-fps.mjs && node test-pin-merge.mjs`. All ten scene graphs are exercised at desktop and portrait dimensions. These use real Three.js geometry but a renderer stub; real-device WebGL pixels/performance and audio listening are not claimed.
