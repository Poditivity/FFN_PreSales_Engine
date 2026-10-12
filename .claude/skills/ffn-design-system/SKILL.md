---
name: ffn-design-system
description: The Founders First Network design system — tokens, components, voice and usage rules for the FFN Presales Engine and any other FFN product surface. Use whenever building, styling or reviewing UI for Founders First Network, or when choosing a colour, type style, spacing step, radius, component or piece of interface copy in an FFN repository.
---

# FFN design system

Everything in this folder is the source of truth for FFN product UI. Do not invent a colour, a spacing value, a radius or a stage label. If something you need is not here, say so and ask before adding it.

## Read in this order

1. `BRAND-BOOK.md` — voice, visual foundations, iconography, and how this system sits on top of shadcn/ui and Untitled UI. Read it once per session before writing any UI.
2. `tokens/tokens.json` — every token with its usage note and the contrast figure behind it.
3. `components/<Name>/README.md` — the guidelines for a component, before you use it. `components/index.d.ts` has the props.

## Wiring it into a repo

- Import `tokens/tokens.css` once at the app root. It defines every custom property and a class per type style, under `:root` and `[data-theme="dark"]`.
- Import `tokens/shadcn-theme.css` after it if the repo uses shadcn/ui. It maps shadcn's variables onto FFN tokens so every shadcn component inherits the brand without being forked.
- Set `data-theme="light"` or `data-theme="dark"` on `<html>`. There is no third theme.
- `components/bundle.js` and `components/bundle.css` are the reference implementation of the FFN-specific components. In a TypeScript and React repo, port them as real components rather than loading the bundle; keep the class names and the markup so the CSS stays valid.
- Load Poppins (400, 500, 600, 700) and IBM Plex Mono (400, 500, 600) from Google Fonts.

## Rules that are not negotiable

- **Read stage labels from one place.** The pipeline is lead, MQL, SQL, customer, advocate, plus the two exits dormant and lost. Never hardcode a stage label or colour in a screen; import the list. See `components/StageBadge/README.md`.
- **Never use a raw hex, px value or font stack in a component.** Every value is a `var(--token)`.
- **Text clears 4.5:1 on the ground its token's usage note names, in both themes.** 3:1 for text at 24px and above, for control borders, focus rings and any mark that carries meaning. Check the dark value too, not only the light one.
- **Interactive boundaries use `--border-control`, not `--border`.** `--border` is decorative and does not meet 3:1.
- **Every status carries a word.** A colour or a dot is never the only signal. Success is cyan, not green, so it never has to be told apart from danger by hue alone.
- **Write in the FFN voice.** Short, declarative, second person, sentence case. No contractions, no em dashes, no emoji, no overselling an outcome. `BRAND-BOOK.md` has the examples.
- Charts use `--chart-1` through `--chart-6` in order, y axis from zero, three series at most.

## When you are asked to change the system

Changing a token or adding a component changes every FFN surface. Do not do it silently inside a feature branch. Say what you would change and why, and let Prashanth put it back into the design system artifact so the two do not drift.
