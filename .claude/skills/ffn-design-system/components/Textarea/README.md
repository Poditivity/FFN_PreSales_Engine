# Textarea

Multi-line free text. Same label, hint and error contract as `Input`.

## Rules

- Minimum height is 96px, which is four lines of `body`. It grows vertically only; never let it resize horizontally and break the form grid.
- Use it for call notes, objection text and internal context. Use it for an email template body only in the drafting screen, where the rendered preview sits beside it.
- Cap long-form copy at `prose-max` so a line stays readable.
- Prompt for the founder's own words. FFN's whole method is evidence, so notes that paraphrase are worth less than notes that quote.

## The consumer provides

Value, change handler, autosave, and any character limit.
