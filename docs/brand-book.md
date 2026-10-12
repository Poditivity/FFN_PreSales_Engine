Use this system for every FFN product surface: the Presales Engine (intake forms, lead database, proof pages, email engine, metrics) first, and any internal FFN tool after it. It is built from the FFN Brand Book and foundersfirstnetwork.com, extended into the tokens and components a dense operational product needs. Where the brand book was silent, this system decided — every such decision is marked below.

## Content fundamentals

Write the way FFN's own site writes. The voice is short, declarative and second person, and it refuses hype on purpose.

- **Say the thing, then stop.** FFN's own lines are the model: "Grow your startup without the noise." "Everything you see is filtered to your stage." "Stop guessing. Start validating." "Save months of building the wrong thing." One idea per sentence. No sentence in the product interface runs past two lines.
- **Do not use contractions and do not use em dashes.** The house style writes "do not", "you are", "it is". FFN's own copy answers an objection as "No. That is not the promise." Match that register: flat, calm, unhurried. Use a full stop or a colon where you were reaching for a dash.
- **Never oversell an outcome.** The site's strongest sales line is a disclaimer: "Not with your startup magically validated. But with clarity on what matters." In the product this means a button says what it does ("Send discovery invite"), never what it promises ("Convert this lead!").
- **Second person for the operator, third for the lead.** "You have 4 follow-ups due today." "Ananya has not replied since 12 Sep."
- **Sentence case everywhere except the eyebrow.** Page titles, buttons, table headers and menu items are sentence case. Only the `eyebrow` style is uppercase, and only as a section kicker.
- **Reassure at the point of friction.** The site does this with "Free to apply", "Takes under 2 minutes", "No payment required to apply." Carry it into forms: put the cost of an action next to the action, in `body-sm` and `ink-muted`.
- **No emoji anywhere in the product.** Status is carried by a `StageBadge` or a status dot with a word beside it, never by a symbol.
- **Numbers are typed, not written.** Set every count, currency amount, percentage, phone number and identifier in the `Data` styles (`data`, `data-sm`, `data-lg`). "100+ startups progressed" on the site is the tone to match: plain, checkable, no adjective.

Vocabulary the product uses, and nothing else for these things: *lead*, *MQL*, *SQL*, *customer*, *advocate* for pipeline stages; *Validation Lab* and *Startup Lab* for the programs; *apply*, *verify*, *invite* for the intake steps; *owner* for the FFN person responsible; *touch* for any logged contact.

## Visual foundations

**Colour.** The brand is one blue and two neutrals: `brand` #233ce6, black and white, exactly as the brand book states them. Everything else in the palette is a working neutral or a status, added by this system because an operational product cannot be built from three values.

- Ground the application in `surface-page`, put every panel on `surface`, and float only modals, menus and toasts on `surface-raised`.
- Spend `brand` sparingly. On a screen full of leads, the blue marks one thing: the primary action, or the single item that is selected. If two blues are competing on a screen, one of them is wrong.
- Text is `ink`, its supporting line is `ink-muted`, and placeholders and axis labels are `ink-subtle`. All three clear 4.5:1 on `surface`, `surface-page` and `surface-sunken` in both themes. `ink-disabled` is the one text colour below that floor, and it is only ever used on a disabled control.
- Interactive boundaries use `border-control`, not `border`. `border` is decorative separation and does not meet 3:1; an input or a secondary button outlined in it would have no accessible edge.
- **Success is cyan, not green.** `success` is #0d7490. A green success beside a red danger can only be told apart by hue, which fails for red-green colour blindness at exactly the moment it matters most, when an operator scans a column of delivery states. Cyan leaves the red-green axis. On top of that, **every status in this product carries a word**: a dot or a fill is never the only signal.
- Dark theme is not a re-tint. `brand` and `brand-solid` lift in dark because the exact brand hex reaches only 2.6:1 on `surface-page`; `on-danger` flips to near-black in dark because `danger-solid` lightens there. Check the dark value, not only the light one, whenever you add a colour.

**Type.** Poppins is the brand typeface, from the brand book, loaded from Google Fonts. IBM Plex Mono is added by this system for data, because Poppins numerals are geometric and wide and a column of them cannot be compared at a glance.

- Set the application default at `body`. Set a page title in `h1`, a section in `h2`, a card header in `h3`.
- `display-*` belongs to full-page moments only: login, onboarding, a zero-data screen, and the one headline number on a stat card.
- Put every identifier, amount, percentage, date-with-time and phone number in `data` or `data-sm`, right-aligned when it sits in a column with others like it.
- `eyebrow` is the only uppercase style. One per section, always `ink-subtle`.

**Spacing and layout.** A strict 4px grid. Card and modal padding is `space-6`; dense panels use `space-5`; table cells are `space-3` vertical and `space-4` horizontal; page sections are separated by `space-8`. Controls line up because they share three heights only: `control-sm`, `control-md`, `control-lg`. The shell is `sidebar-width` beside a `content-max` column, under a `topbar-height` bar.

**Borders, radii and shadows.** The FFN mark is cut from hard diagonals and square terminals, so the system stays tight: `radius-sm` on controls, `radius-lg` on cards, `radius-xl` on modals, and `radius-full` reserved for avatars, dots and the switch. A card is defined by its `border`, not by a shadow. Shadows belong only to things that genuinely float: `shadow-md` for menus, `shadow-lg` for modals.

**States.** Every interactive element answers to all five: rest, hover (`surface-hover` or the `-hover` fill), active (the `-active` fill), focus-visible (a 2px solid `focus-ring` offset 2px), and disabled (`ink-disabled` on `surface-sunken`, `border` not `border-control`, cursor not-allowed). The focus ring is solid and never replaced by a shadow. Loading is a state of the control itself: a button keeps its width and swaps its label for a spinner, so nothing on the row moves.

**Motion.** Two durations: 120ms for a state change on a control, 200ms for something entering or leaving. Easing is `cubic-bezier(0.2, 0, 0, 1)`. Nothing in an operational table animates on data change: a row that moves while an operator is reading it costs more than it gains.

**Imagery.** FFN uses documentary photography of real cohorts, never stock and never illustration. Inside the Presales Engine there is almost no photography at all: the only images are a lead's avatar, the FFN mark, and photographs on a proof page, which come from the content database and are always real people who agreed to appear.

**Data visualisation.** Charts use `chart-1` through `chart-6` in order, and `chart-1` is always the primary measure. Gridlines are `chart-grid` and axis text is `chart-axis` at `caption`. Never colour a chart by hue alone: label the series directly at its end, or give each series a distinct mark. Three series is a good chart, six is the ceiling; past that, aggregate.

## Iconography

The brand book defines no icon system, so this one chose **Lucide**, which is what shadcn/ui ships with and what the Presales Engine already pulls in. This is a substitution, not an FFN asset: if FFN commissions its own icon set, replace the mapping here.

- 16px icons inside `control-sm`, 18px inside `control-md` and `control-lg`, 20px in a page header. Stroke width 1.75 at every size.
- Icons are `ink-subtle` at rest and take the colour of their label when that label is `brand`, `success`, `warning` or `danger`.
- An icon never stands alone as the only signal of a state or an action, except in a collapsed sidebar, where every icon carries a tooltip.

## Assets

The `Logos` group holds the four real FFN marks, copied from the brand book. Read `assets/Logos/README.md` before placing one. There are no other brand assets in this system: no illustration set, no pattern library, no photography.

## Building with shadcn/ui and Untitled UI

The Presales Engine is TypeScript, React, Next.js and Tailwind, so:

1. Install **shadcn/ui** components into the repository, then replace their default theme variables with the compiled `tokens.css` from this system. Map `--background` to `surface`, `--foreground` to `ink`, `--primary` to `brand-solid`, `--primary-foreground` to `on-brand`, `--muted` to `surface-sunken`, `--muted-foreground` to `ink-muted`, `--border` to `border`, `--input` to `border-control`, `--ring` to `focus-ring`, and `--destructive` to `danger-solid`.
2. Take **Untitled UI React** components where shadcn has no equivalent and the pattern is worth not rebuilding: file upload, the multi-step form, date range picker, command menu. Restyle them to these tokens on the way in. Do not mix two visual languages in one screen.
3. Use **Recharts** for charts, themed with `chart-1` through `chart-6`, `chart-grid` and `chart-axis`.
4. The components in this system are the FFN-specific layer on top: `StageBadge`, `PipelineStepper`, `DataTable`, `StatCard`, `FunnelChart`, `ActivityTimeline` encode FFN's own pipeline and vocabulary, and are not in either library. Build those from this system, not from scratch.

Anything a component does not provide, the consumer provides: routing, data fetching, permissions and persistence are the application's, never the component's.
