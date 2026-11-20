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

## Behavior comes from ui-sdk

The interactive components render [ui-sdk](https://ui-sdk.dev) parts (`@ui-sdk/react`, peer dependencies) under the
same `ll-*` classes, so keyboard, focus, ARIA, dismissal and agent support come from its behaviors and the look stays
the design system's. State is styled from ui-sdk's attributes (`data-checked`, `data-selected`, `data-highlighted`),
not from hidden native inputs.

| Component                                   | ui-sdk parts                              |
| ------------------------------------------- | ----------------------------------------- |
| Button, IconButton, the shell's buttons     | Button                                    |
| Field, Input, AssumptionField's number box  | Field, FieldLabel, FieldDescription, FieldError, Input |
| Switch, Checkbox, RadioGroup                | Switch, Checkbox, RadioGroup and Radio    |
| SegmentedControl, Tabs                      | SegmentedControl, Tabs                    |
| Slider, AssumptionField                     | Slider                                    |
| Select                                      | Select                                    |
| Menu (with `trigger`), ScenarioSwitcher     | Menu, MenuRadioGroup                      |
| Dialog, Drawer                              | Dialog                                    |
| Tooltip                                     | Tooltip                                   |

What changed for callers:

- `Menu` takes a `trigger` element and becomes a whole menu that opens from it, named by the trigger. Without one it
  still renders the open list on its own.
- `Select` calls `onChange` with `{ target: { value } }`, as a native select did, and `onValueChange` with the value.
- `Tooltip` makes a single element child its trigger; text becomes a focusable info button. `focusable` is no longer
  needed.
- `Dialog` and `Drawer` stay open while mounted. Escape and the close button call `onClose`; focus moves in on open and
  back to what opened it after.

Put `@layer ui-sdk;` first in the app's global stylesheet.
