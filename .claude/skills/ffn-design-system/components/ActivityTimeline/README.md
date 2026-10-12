# ActivityTimeline

Every touch on a lead, newest first. This is the record the FFN team argues from, so it is append-only.

## Rules

- Newest at the top. An operator opens a record to find out what just happened.
- `title` is what happened and who did it, in one line. `meta` is when, and any identifier, in mono: duration, template key, fill time.
- `note` is for the lead's own words. Quote them. FFN's method is evidence, and a paraphrase is not evidence.
- The dot tone marks the kind of event, not its sentiment: `brand` for a stage or call event, `success` for a delivery or payment, `warning` for a retry, `danger` for a failure. Leave it unset for a plain log line.
- Entries are never edited or deleted. A correction is a new entry that says what was corrected.
- Machine events and human events sit in one stream. Separating them hides the gap between the email that was sent and the call that never happened.

## The consumer provides

The items, already sorted, and the paging for long histories.
