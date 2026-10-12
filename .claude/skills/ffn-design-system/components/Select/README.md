# Select

A native single-choice control. It is native on purpose: it works on a phone, it works with a keyboard, and it needs no portal.

## Rules

- Up to about fifteen options. Past that the operator is searching, not choosing, so use a command menu or a combobox from Untitled UI instead.
- Order options the way the operator thinks: pipeline stages in pipeline order, people by how often they are picked, everything else alphabetically.
- `placeholder` renders as a leading empty option and means "not set". It is not a label.
- Changing a stage in a Select must not be the same gesture as saving it. Stage changes are logged to the timeline, so confirm them.

## The consumer provides

Options, value, change handler, and the permission check on who may reassign an owner.
