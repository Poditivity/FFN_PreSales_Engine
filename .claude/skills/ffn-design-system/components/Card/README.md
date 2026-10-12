# Card

The panel every block of content sits in. A card is a boundary, not a decoration.

## Rules

- A card is defined by its `border`. Add `raised` only when it floats on `surface-page` on a dashboard; never inside another card.
- `title` is `h3` and says what is inside. `subtitle` carries the count or the freshness, in `ink-muted`.
- `actions` holds at most two controls, both `size="sm"`, and never the primary action of the page.
- Use `flush` when the body is a `DataTable`, so the table's own edges meet the card's.
- `footer` sits on `surface-sunken` and is right-aligned. It holds the action that applies to everything in the card.
- Do not nest cards. If the content needs its own boundary, it needs its own card beside this one.

## The consumer provides

All content, and the layout grid the cards sit in.
