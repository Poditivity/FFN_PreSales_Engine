# StageBadge

The canonical rendering of a lead's position in the FFN pipeline. Use it anywhere a stage is shown, so the same stage never appears in two colours across the lead database, the dashboard and the daily digest.

## The stages

| Stage | Tone | A lead is here when |
| --- | --- | --- |
| `lead` | neutral | Captured from the intake form or LinkedIn outreach, not yet spoken to. |
| `mql` | brand | The outreach call confirmed fit against the Validation Lab profile. |
| `sql` | brand | Sujatha ran the discovery call and the lead stated intent. |
| `customer` | success | Payment received and enrolled. |
| `advocate` | success | Referring other founders, or has given a testimonial. |
| `dormant` | warning | No reply past the follow-up window. Off the path, still open. |
| `lost` | danger | Declined or disqualified. Off the path, closed. |

`lead` through `advocate` are the ordered path. `dormant` and `lost` are exits and are never shown in `PipelineStepper`.

## Rules

- The stage list lives in the bundle as `FFN.stages`. Read it from there rather than repeating the labels; a stage renamed once is renamed everywhere.
- Never invent a stage in a screen. A new stage is a change to the pipeline and to the digest, so it goes through the system.
- MQL and SQL share the brand tone because they are the same kind of thing at two depths. The label carries the difference.

## The consumer provides

The stage id, from the lead record.
