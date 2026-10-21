# @ledgerline/ui

The Ledgerline design system as a package: 76 components and charts, 65 icons, light and dark tokens.
The published reference with live previews and the brand book is the "Ledgerline" design-system artifact.

```tsx
import "@ledgerline/ui/styles/tokens.css";
import "@ledgerline/ui/styles/components.css";
import { KpiTile, LineChart, Amount } from "@ledgerline/ui";
```

Rules that matter most: money is passed in major units to `Amount` (negatives get parentheses), forecast
data is always indigo and hatched, and screens are composed on one sheet with hairlines, never as loose cards.
