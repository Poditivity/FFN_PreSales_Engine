# PipelineStepper

Where one lead stands on the FFN path, and when each step happened.

## Rules

- It shows the five on-path stages only: lead, MQL, SQL, customer, advocate. `dormant` and `lost` are exits, not steps; show those with a `StageBadge` and an `Alert` instead of bending the stepper.
- Steps behind the current one are filled, the current step is filled at reduced opacity, steps ahead are the empty track. The current step also carries a visually hidden "Current stage", because opacity is not a signal a screen reader can read.
- `meta` is the date the lead entered that step, in mono. Leave it empty for steps not yet reached rather than writing "pending".
- It is read-only. Stage changes happen through the record's own control, so they can be logged and can fire the stage email.
- Never reorder the stages per lead. The path is the product.

## The consumer provides

The current stage id and the entry dates. Defaults to the five FFN stages when `steps` is omitted.
