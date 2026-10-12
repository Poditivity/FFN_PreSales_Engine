# Alert

A persistent message about the thing on screen. It stays until the condition changes.

## Rules

- An alert is about the screen it sits on. A message about an action that just finished is a toast, and a toast is not in this system yet.
- `title` is the whole message when it fits in one line. The body adds only what the title cannot carry.
- `danger` renders with `role="alert"` and is announced immediately; every other tone uses `role="status"`. Do not use `danger` for something that is merely urgent, or the announcement stops meaning anything.
- `action` holds one small secondary button, and it must resolve the alert's own condition.
- Never stack more than two alerts. Three means the screen has a problem that a banner cannot fix.
- Each tone carries its own ground, border and text colour, so the meaning survives in both themes and does not depend on hue alone.

## The consumer provides

The condition that shows and hides it, and the action handler.
