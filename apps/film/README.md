# Ledgerline launch film

A 110-second launch film made from the product itself: every screen in it is a real component from `@ledgerline/ui`
or `apps/web` (the app shell, the Ask chat and its chart renderer, AI actions, the what-if forecast, the board pack),
fed the sample company's real figures. Nothing is a screenshot.

```bash
cd apps/film
npx vite                                  # preview in a browser (loops; add ?seek=39 to start at a scene)
node render/score.mjs                     # synthesise the score → out/score.wav
node render/render.mjs --audio out/score.wav        # render 1080p60 → out/ledgerline-launch.mp4
node render/render.mjs --from 39 --to 55 --fps 10 --stills out/stills --every 5     # check one scene as stills
```

Needs Chromium (`--chrome <path>` or `CHROME=` if it isn't on the path) and ffmpeg.

## How it renders

`render/render.mjs` builds the film, opens it in headless Chromium and stops time there (`render/virtual-time.js`):
the clock, timers, animation frames and every CSS and Web Animations API animation only move when the renderer
advances by one frame. The components' own motion (springs, streaming text, the AI orb) is therefore frame-exact
however long a screenshot takes. Frames are piped to ffmpeg as H.264.

## The cut

| Time | Scene | What it shows |
| --- | --- | --- |
| 0:00 | Cold open | The ledger as most owners see it: falling journal amounts, one emerald rule |
| 0:07 | The question | 2,400 journals, 60 months, 13 accounts, then "Are we okay?" |
| 0:13 | Title | The mark, the name, "Your accounts, explained every morning." |
| 0:19 | 01 Connect | Connect Xero, read-only consent, the sync, matches Xero to the cent |
| 0:30 | 02 Every morning | The overview in the app shell, with the Ask panel answering beside it |
| 0:39 | 03 Ask Ledgerline | Ctrl J, a question, the reading timeline, the streamed answer and its chart |
| 0:55 | 04 AI actions | Search, Explain, Flag, Plan, Draft |
| 1:12 | 05 Forecast | Hire four fitters, customers pay late, the cash runs out, then recovers |
| 1:23 | 06 Trust and privacy | An uncited number rejected; read-only, isolated, private, audited |
| 1:36 | Finale | The whole product as a landscape, then "Know your cash every morning." |

Scene timings live in `src/Film.tsx`; the score in `render/score.mjs` is timed to the same marks.

## Shorts

Five vertical shorts for Reels and YouTube Shorts (1080×1920, 60 fps) live in `src/shorts`. Each makes one point: a
hook in the first two seconds, the product doing it, the payoff, then the end card. Readable content stays clear of
the top 220 px and bottom 380 px, which the apps cover with their own interface.

| id | Length | Hook | Shows |
| --- | --- | --- | --- |
| `ask` | 19 s | Ask your books anything. | The Ask window streams a real answer and draws its chart |
| `cash` | 17 s | What if I hire four fitters? | The what-if: cash runs out when customers pay late, then recovers |
| `cent` | 14.5 s | Is your dashboard actually right? | The sync, then the P&L and balance sheet matching Xero to the cent |
| `cite` | 15 s | Should AI write your board pack? | An uncited figure rejected; every other one traced to its source |
| `actions` | 21.2 s | 5 things your accounts can now do for you. | Search, Explain, Flag, Plan, Draft |

```bash
node render/score.mjs --short ask
node render/render.mjs --short ask --audio out/shorts/ask.wav     # → out/shorts/ask.mp4
```
