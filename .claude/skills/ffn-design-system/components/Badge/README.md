# Badge

A short, non-interactive label that states a fact about the row it sits in.

## Tones

`neutral` for a state with no charge, `brand` for something in progress, `success` for a completed or healthy state, `warning` for something that needs attention, `danger` for a failure. `success` is cyan rather than green on purpose: it must never be told apart from `danger` by hue alone.

## Rules

- **Every badge carries a word.** The dot is a second signal, never the only one. Drop the dot with `dot={false}` when the badge is a category rather than a state, for example a program name.
- One or two words. If it needs more, it is a sentence and belongs in the row's second line.
- Sentence case, except for acronyms the product already uses: MQL, SQL, NDA, UAT.
- A badge is never clickable. If it must filter, put a filter chip beside the table instead.
- For a pipeline stage use `StageBadge`, not this. It fixes the label and tone so the same stage never appears in two colours across modules.
