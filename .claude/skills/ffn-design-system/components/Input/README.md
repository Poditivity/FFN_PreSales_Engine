# Input

A single-line text field with its label, helper text and error in one component, so a form cannot be built with a label missing.

## Rules

- **Always supply a `label`.** A placeholder is not a label; it disappears the moment someone types. Use `placeholder` for an example value only.
- `hint` explains the field before anything goes wrong; `error` replaces it when something does. Both are wired to `aria-describedby`, and `error` also sets `aria-invalid`.
- Error text names the fix, not the failure: "Enter a 10 digit number after the country code", not "Invalid input".
- Set `mono` for anything compared character by character: lead IDs, phone numbers, amounts, template keys, UTM values.
- `required` marks the label and sets the attribute. Mark the optional fields instead when most of a form is required.
- Validate on blur and on submit, never on every keystroke.
- A disabled field uses `ink-disabled` on `surface-sunken`, which is below the text contrast floor on purpose: a disabled field must read as unavailable. Never disable a field that carries information a person still needs to read.

## The consumer provides

Value, change handler, validation and the error string. The component holds no state.
