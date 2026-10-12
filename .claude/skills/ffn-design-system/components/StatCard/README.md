# StatCard

One number an operator checks without reading anything else.

## Rules

- The value is pre-formatted by the caller, in mono, including the separators and the unit. Format once, in one place, so the same number reads the same on the dashboard and in the digest.
- `label` is the eyebrow: short, uppercase, no verb.
- A `delta` needs a `direction`, and the direction is about the number, not about whether the news is good. Pair it with a `note` that says what it is compared against, otherwise it is decoration.
- **Up is not automatically good.** "Median time to reply" rising is bad. Colour follows the direction token, so state the target in the `note` and let the operator judge.
- Four across is the most a row should carry. Past that, nobody reads the fourth.
- Never put a sparkline inside a stat card here. If the shape of the series matters, it is a `TrendChart`.

## The consumer provides

Formatted values, the comparison period, and the target.
