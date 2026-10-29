# The redesign: every page as a function of the window

This redesign applies one idea from [The Calculus of Interfaces](https://calculus-of-interfaces.vercel.app/) to
every page of Ledgerline: **a layout is a function of its inputs**, `UI = f(props)`, and once you treat it as one
you can measure it, find exactly where it breaks, and change it so it breaks less.

This document explains what changed, why, and how it was measured. Each section matches one or more commits in
the pull request.

## The idea in one paragraph

A page's layout takes the window's width (and a few other props) and returns where every block goes. Between
breakpoints it moves in straight lines: a block slides a little as the window widens. At a breakpoint it **jumps**:
a column folds, a rail moves under a chart, a heading gains a line. In the article's terms every `@media` or
`@container` rule is a **step function**, so it jumps; every `min()`, `max()` and `clamp()` is a **ReLU**, so it
only **bends** and stays continuous. A reader sees each jump as the page teleporting. So the goals were:

1. **Fewer jumps.** Where a size can follow the width continuously, it does (clamp instead of a breakpoint).
2. **Jumps in the right places.** Changes that must happen happen together, at one width, and only once.
3. **The answer on the first screen.** Measure what fills the first screen on real devices and move the answer up.
4. **Jumps that remain glide** instead of teleporting, and lift while they travel.

## How it was measured

The pages that can render without a backend (Overview, Profit and loss, Balance sheet, Cash flow, and the landing
page) were rendered locally with the sample company (Kestrel Joinery) in headless Chromium and **swept across
every width from 320 to 1920px** (every 4px; the first Overview runs every pixel), recording every block's
rectangle at each width. That's the article's point about screenshot tests: four screenshots sample four points
of the function and miss nearly every jump between them; a sweep sees all of them.

From each sweep:

| Measure | What it is |
| --- | --- |
| **Jumps** | Widths where a block leaves the straight line through its previous positions (a second difference above 6px). |
| **Repeated jumps** | The same change happening twice as the window widens: a threshold crossed, uncrossed and crossed again. |
| **First-screen answers** | Whether the figures, the one-line answer and what needs attention are above the fold. |
| **Device-mix averages** | Averages over an assumed mix of visits: 55% phones (360–430px), 12% tablets (744–1024px), 33% laptops and desktops (1280–1920px), uniform within each. Viewport heights are assumed (720, 960, 832, 960px). These are illustrative, not measured traffic, as in the article. |
| **Cut-offs** | Any text wider than its box, and any sideways scroll, at any width. |

The other pages (forecast, scenarios, board pack, ledger, audit log, sync, settings, onboarding, sign in) read
live data, so they weren't swept. For those, **every layout threshold in the stylesheet was listed and mapped to
window width**. That's the article's "find every breakpoint exactly, not by sampling", done by reading the rules
instead of bisecting the function. That's how the root cause below was found.

## The root cause: a main column that shrinks as the window grows

Every page lays itself out by the width of its main column, `m`. Before:

```
m(W) = W            for W ≤ 900px     (no sidebar)
m(W) ≈ W − 262      for W > 900px     (a 244px sidebar arrives all at once)
```

So as the window widens, `m` rises to 899px, **drops to about 638px**, and rises again. This is exactly the
article's `min(viewport, maxWidth)` case under *Transition paths*: a quantity that rises and then falls crosses
the same threshold twice. Every fold whose threshold sat between 638 and 899px of column happened, undid itself,
and happened again. That covered the report pairs on profit and loss, balance sheet and cash flow, Sync's import
grid, Settings' navigation, the Scenarios rows, the Overview's calendar and revenue flow, and the phone header,
which showed up on a desktop window just past 900px.

The sweep shows it directly. On the old profit and loss page the two cost charts fold side by side at **724px**
and fold side by side **again at 976px**. On the old Overview the calendar's summary wraps under it at 820, 1072
and 1412px, and the revenue flow switches to a list at 744 and again at 1000px.

**The fix (commit "Shell: the sidebar shows as icons from 901 to 1319px…"):**

```
m(W) = W            for W ≤ 900px
m(W) ≈ W − 72       for 901–1319px   (the sidebar as icons, 64px)
m(W) ≈ W − 262      for W ≥ 1320px   (the full sidebar)
```

Each arrival still takes width from the column, but now only where no page has a threshold: icons take it from
899 to about 829px, and the full sidebar from about 1246 to 1058px. Checked against every threshold in the
stylesheet (600, 640, 700, 720, 760, 820, 884/940, 900, 1000, 1040, 1680px of column), none falls in either
range, so **the column only grows between jumps and every fold happens once**, on every page. In the icons band
the toggle still opens the full sidebar for that visit, without changing what's remembered.

Result: repeated jumps went from 7 to **0** on the Overview and from 1 to **0** on profit and loss.

## Spacing as a function

**Commit "Spacing: gutters, section gaps and padding follow the main column instead of stepping".** The article
treats padding and gap as props of `f`, and its optimiser keeps both at 12px or more. Ledgerline's spacing stepped:
gutters were 32px, then 16 below 900px of window and again below 600px of column, then 48 above 1680px. Each step
moved the whole page at once. Now each is one straight line in the column's width between a floor and a ceiling
(a clamp: two kinks, no jumps), never under 12px:

| Token | Floor → ceiling | Formula |
| --- | --- | --- |
| `--gutter` (page sides) | 16 → 48px | `clamp(16px, 2.7cqi + 2.5px, 48px)` |
| `--flow` (between sections) | 20 → 32px | `clamp(20px, 1.2cqi + 12px, 32px)` |
| `--pad` (inside a section) | 14 → 24px | `clamp(14px, 1.1cqi + 8px, 24px)` |

`cqi` is 1% of the main column, so the spacing follows the room the page actually has, not the window. The same
treatment went to the page title (26 to 36px), the landing page (gutters 20 to 32px, sections 96 to 136px apart),
sign in and sign up, onboarding, the board pack's margins and cover title, and the audit log's day column.

One threshold moved for the same reason: narrow-sheet styles (the phone header, tight gutters) started at 640px of
column. Someone who opens the full sidebar in a window just past 900px has a 638px column, a desktop, so it now
starts at 600px.

## Jumps that must happen, together and once

**Commits "Figures: four fold to two by two at the same width the rail folds under the report" and "Overview: laid
out as a function of the window".** The article's *Paths* section shows the transition with the fewest jumps is the
one that changes things together. Before, at 1180px the four figures folded to two by two, and 16px later at 1196px
the rail moved beside the chart: two big jumps, 16px apart. The figures' threshold is measured on their own row,
which is the column less two gutters, so it was re-derived: with the fluid gutter (2.7% + 2.5px), 940px of column
is `0.946 × 940 − 5 ≈ 884px` of row. Now the figures, the rail and the revenue flow (Sankey, list ↔ chart) all
change at **940px of column, in one jump**.

The Sankey needed a new prop, `minColumn` (commit "SankeyChart: minColumn…"). It used to switch at 150px a column,
wherever that fell (745px of column). Its column width is `(0.924m − 205) / 3`, which is 221.2px at `m = 940`, so
the Overview passes `minColumn = 221.3`.

The calendar follows the same rule. It sits under the cash chart so the two columns balance. Beside the rail its
summary always stacks under it, because the column narrows by the rail's width when the rail moves up at 940px. A
fold inside it would otherwise repeat the double-crossing problem in miniature.

## The answer first

**Commits "Overview: the answer in a sentence…", "Overview: answer first, and headed by the questions it answers",
"Forecast and scenarios: headed by the questions they answer".** The article's *Metrics* tab asks what fills the
first screen and what moves that most. Measured on the old Overview:

* On a phone (390px), **what needs attention was at y = 1,554px**, more than two screens down. It sat in the rail,
  and the rail flows under the charts on a narrow screen. Only **33%** of visits (device-mix average) saw it on the
  first screen.
* Four figures went one per row below 400px, so on a phone they filled most of the first screen by themselves.

Now:

* The figures stay **two by two on a phone** (commit "Figures: two by two on a phone…"). Their size follows their
  own cell, 12% of its width between 18 and 30px, instead of stepping from 30 to 24px. That also gives a guarantee
  in the spirit of the article's *Prove* tab: at 12% of the cell and about 0.6em a character, thirteen characters
  fit any cell, so a figure like −€12,345,678 can't overflow at any width.
* Under the figures, **one sentence says what they mean**: *"Cash is €412,300, down 6.6% on last month, and
  September sales were up 15.8%. On the base case it lasts the whole forecast."* (`overviewLede`, tested.)
* Below 940px of column, **what needs attention comes first**, before the chart. It's the same jump as the rail
  folding, not another one.
* Each section is headed by **the question it answers**, and its first line answers it: *How long will the cash
  last?* ("Through the whole forecast, on the base case. Lowest point €59,500 in Sep 2027."), *Who owes you money?*,
  *Is revenue growing?*, *When does money move?*, *Where did September's cash go?* ("Cash fell €29,000. Trade
  debtors moved it most: −€38,400."), *Where did September's revenue go?* The forecast and scenarios pages got the
  same treatment.

Result: what needs attention is on the first screen for **100%** of visits (was 33%: laptops only). On a laptop
(1470 × 832) the whole cash chart and what needs attention stay above the fold, now with the one-line answer
added above them.

**About "empty space".** The article splits the first screen into header and navigation, content, and spacing and
empty. Measured the same way, the share of points that land on page background rose by a few points on most
pages. That isn't wasted room. On a phone the old first screen was four stacked figures, one block. The new one
shows the figures, the answer and the start of the next section, and the gaps between those blocks count as
background. On a laptop most of it is the one-line answer's deliberate line length (78 characters). The useful
measure is what the first screen *answers*, and that went up.

## Information that was being cut off

**Commit "Ledger: on a narrow screen each line's description moves under its account".** The article's *Limits*
list and its clamp-and-fallback point: a clamp needs a fallback. Below 720px of column the ledger *hid* each
journal line's description, so a phone showed accounts and amounts with no word of what the line was. Now the line
wraps: account and amounts, then the description underneath.

## Motion: jumps that glide, and lift while they travel

**Commits "Glide: blocks travel across a layout jump instead of teleporting" and "Glide on every page".** The
article's *Motion*, *Resize* and *Imagine* tabs, applied:

* **Resize, `f + JΔ`.** Between breakpoints a block moves in a straight line with the width, so its next position
  is predicted exactly by its last one plus its slope times the change in width. `useGlide` keeps each block's
  slope. Whatever the prediction misses is a jump: a column folds, a section above gains a line, a forecast arrives
  and adds a warning, a scenario switch changes what needs attention. Only that residual is animated. Smooth
  stretches are never animated, so dragging the window stays crisp.
* **Motion, `σ(a / τ)`.** The jump is softened. Timing is smoothstep, `t²(3 − 2t)`, the same curve the article's
  demo uses, over 200–560ms depending on distance. That's the step replaced by a sigmoid; the duration plays the
  role of the temperature.
* **Imagine, `Im f(x + iε) ≈ ε f′(x)`.** A block lifts **by its speed**. Speed is `distance · 6t(1 − t)`, normalised
  to the fastest block, and lift is `speed^0.7`, the article's exponent, drawn as a slight scale (at most 16px
  wider, so a wide section and a small figure lift alike) and a deeper shadow. Blocks that don't move stay flat; the
  block crossing furthest lifts highest, at the middle of its trip, then lands.

It runs on every page, from `AppPage`. Only the innermost matching block moves, so nothing glides twice. It's off
under *reduce motion*.

## Results

Swept at every 4px from 320 to 1920px with the sample company:

| Page | Jumps | Repeated jumps | First screen has what needs attention | Average page height, phones | Cut-offs or sideways scroll |
| --- | --- | --- | --- | --- | --- |
| Overview | 21 → **14** | 7 → **0** | 33% → **100%** of visits | 3,337 → 3,272px | none → none |
| Profit and loss | 11 → **8** | 1 → **0** | – | 2,312 → **2,160px** | none → none |
| Balance sheet | 13 → **11** | 0 → 0 | – | 2,339 → **2,170px** | none → none |
| Cash flow | 10 → **9** | 0 → 0 | – | 1,944 → 1,944px | none → none |
| Landing | 21 → 23 | 0 → 0 | – | 10,144 → 10,144px | two deliberate ellipses in the product mock-ups, unchanged |

The landing page is the honest exception. Its spacing now follows the window instead of snapping at 900px, but
its only big jump, the sections stacking at 900px, was already at the same width as the old spacing step, so the
count of jumps didn't fall. The two extra are headings gaining a line at slightly different widths, because the
fluid gutter moves where lines wrap.

What's left of the jumps are, on purpose: the sidebar arriving (901 and 1320px), the one shared fold at 940px of
column, the rail's blocks going one per row at 600px, and text gaining a line, which is the article's commit
messages wrapping and can't be removed without truncating words.

## What to look at on the preview

Open the Vercel preview of this pull request and production side by side, signed in to the same company.

1. **Drag the window slowly from narrow to wide.** On production, between about 900 and 1000px, panels fold,
   unfold and fold again. On the preview each change happens once, and blocks glide to their new places, lifting
   slightly as they go.
2. **At 1100–1300px** the preview shows the sidebar as icons; production's full sidebar squeezes the page.
3. **Overview on a phone, or a window under 600px:** four figures two by two, one sentence, then what needs
   attention, all on the first screen. On production what needs attention is two screens down.
4. **Overview on a laptop:** the one-line answer under the figures, then the cash chart with what needs attention
   beside it, every section headed by a question with the answer in its first line.
5. **Switch scenario on the Overview or Forecast.** Blocks that move glide instead of jumping.
6. **Ledger on a phone:** descriptions under each line instead of missing.
7. **Any page, resizing:** gutters and spacing change smoothly instead of snapping at 900 and 600px.

## Limits

* The sweeps use the sample company and assumed device shares and viewport heights. Real figures (longer names,
  more warnings) move individual numbers, not the method.
* Font scale (browser zoom, larger text) wasn't swept. The article does, and it's the natural next step.
* The pages that need live data were checked by listing their thresholds, not by sweeping.
* The header's action buttons still wrap under the title at about 660px of column. That's content wrapping, not a
  rule, and it now happens once.
