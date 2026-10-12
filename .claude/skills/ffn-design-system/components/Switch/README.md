# Switch

An immediate on or off. Flipping it changes something now.

## Rules

- Use it only where there is no save button. If the change needs saving, it is a `Checkbox`.
- The label states the on position: "Daily digest to Google Chat". Never label it "Enabled" and leave the operator to guess what.
- Show the result of the flip near the switch, not in a toast that disappears.
- Never use a switch for something destructive. Pausing nurture email is a switch; deleting a lead is a `Modal` with a danger confirm.

## The consumer provides

Checked state, the change handler, and optimistic or pending handling while the write is in flight.
