# Tabs

Views of the same collection. Tabs filter, they do not navigate.

## Rules

- Every tab shows the same kind of record. "All leads" and "Follow-up due" are tabs; "Leads" and "Templates" are sidebar links.
- Up to five tabs. Past that it is a filter bar.
- `count` is the number of records behind the tab and it must be live. A stale count is worse than no count.
- The active tab is `brand` with a `brand-solid` underline. Colour alone is not the signal: the underline carries it too.
- The first tab is the unfiltered view and is the default. Do not open on a filtered view.

## The consumer provides

The active id, the change handler, the counts, and the filtered data behind each tab.
