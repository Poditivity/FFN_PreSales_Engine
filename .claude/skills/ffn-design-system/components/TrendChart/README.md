# TrendChart

A measure over time. Use it when the shape of the line is the finding, not the latest value.

## Rules

- Two series is the clear case, three is the ceiling here. More than that belongs in a small-multiples grid.
- `chart-1` is always the primary measure. The second series is `chart-2`, which differs from the first in lightness as well as hue.
- The y axis starts at zero. A truncated axis makes a flat month look like a breakthrough, and this product exists to stop people fooling themselves.
- Label the x axis in the operator's own unit: week numbers for the weekly digest, dates for a month view.
- Gridlines are `chart-grid` and sit behind the data. Three of them is enough.
- A point is a real observation. Never interpolate a missing week; break the line instead.

## The consumer provides

Series already aggregated to the period, the axis labels, and the width. Height defaults to 200.
