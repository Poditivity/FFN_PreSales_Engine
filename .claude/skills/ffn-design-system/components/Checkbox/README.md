# Checkbox

A binary choice inside a form, submitted with the form.

## Rules

- The label is the full sentence of what checking it does. "Send the stage email automatically", not "Auto email".
- Put the consequence in `hint` when checking it causes something to happen to a lead.
- Group related checkboxes under a single question and keep them in one column.
- For a setting that takes effect immediately, use `Switch` instead. Checkbox means "this will apply when I save".
- The box is 16px with a 3:1 border, so it has an accessible edge before it is checked.

## The consumer provides

Checked state and the change handler. The component is controlled.
