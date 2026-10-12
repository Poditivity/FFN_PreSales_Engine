# DataTable

The lead database, and every other list an operator scans rather than reads.

## Rules

- **Always pass a `caption`.** It is visually hidden and it is the only thing a screen reader user has to tell one table from another.
- Column order is scan order: who, then what state, then who owns it, then when it last moved. The identifier is second, not first; operators recognise people before codes.
- Numbers go in a right-aligned column, which sets them in mono with tabular figures so the digits line up.
- A row's second line carries the supporting fact, in `ink-muted`. Two lines maximum per row.
- `onRowClick` opens the record. Anything else in the row that is clickable must stop propagation, or the operator will open a record while trying to press a button.
- Selection uses `surface-selected`, not a border, so the row does not shift by a pixel.
- Rows do not animate when data changes. A row moving under a reading eye costs more than the freshness gains.
- Sorting, filtering and pagination are the application's. The table renders what it is given.

## Density

Default row height is `row-height` (52px), which fits an avatar and a two-line cell. A dense mode at 44px is for single-line rows only.

## The consumer provides

Columns with their renderers, rows, the sort state and its handler, selection, and pagination.
