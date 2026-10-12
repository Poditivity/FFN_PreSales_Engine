# Button

The one control that commits an operator to an action.

## Variants

- `primary` — the single committing action on a screen or in a dialog. Never two on the same view.
- `secondary` — every other action that is safe and reversible. This is the default choice.
- `ghost` — cancel, dismiss, and actions inside a dense row where a bordered button would add noise.
- `danger` — only inside a confirmation, and only when the action destroys or closes something. A destructive action is never the first thing an operator can click; it is confirmed.

## Sizes

`sm` in table rows and filter bars, `md` everywhere else, `lg` only on login and the public intake form. Sizes match the `control-sm`, `control-md` and `control-lg` tokens so a button lines up with an Input beside it.

## Rules

- Label with a verb and its object in sentence case: "Send discovery invite", not "Submit" and not "Send Discovery Invite".
- Say what the button does, never what it promises. "Move to SQL" is right. "Convert this lead" is not.
- `loading` holds the button's width and swaps the label for a spinner, so nothing on the row shifts. Use it for anything that hits the network.
- An icon sits left of the label unless it means "this opens something else", in which case it sits right.
- Do not nest a Button inside a clickable table row. Stop the row's click on the button.

## The consumer provides

The click handler, the pending state, permission checks, and any routing. The button has no opinion about what happens next.
