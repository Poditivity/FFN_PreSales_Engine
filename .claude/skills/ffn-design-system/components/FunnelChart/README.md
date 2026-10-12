# FunnelChart

The pipeline as volume: how many leads reach each stage, and how many are lost between them.

## Rules

- Stages run in pipeline order, top to bottom. The first row sets the full-width bar; every bar below is a share of it.
- Each row prints its count in mono and the drop from the row above as a negative percentage. **The drop is the point of the chart.** A funnel without drop figures is a bar chart with extra steps.
- **Every bar is `chart-1`.** There is one measure here, and its length already carries it; a different hue per stage would imply the stages are different kinds of thing. The name is printed beside each bar, so nothing has to be matched to a legend.
- Never draw a trapezoid funnel. Angled sides distort area and make the drop look smaller than it is.
- Name the period in the `label`. A funnel with no time window cannot be compared to anything.

## The consumer provides

Ordered data for one period, and the period label.
