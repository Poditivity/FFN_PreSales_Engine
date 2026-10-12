# Alerts, summaries and form uploads: setup

This covers what must be done in Supabase and Cloudflare for these features to work. Nothing here is applied by merging the code.

## 1. Apply the migrations

In order:

1. `20261001090000_app_settings_and_form_uploads.sql` creates `app_settings` (escalation delay, summary times, privacy notice, last R2 reading), `form_upload_log`, and `hubs.sent_at`.
2. `20261001100000_escalations_and_digests.sql` creates the escalation and digest tables, the metric functions, and the pg_cron schedule.
3. `20261001110000_validate_email_on_submit.sql` makes `upsert_form_submission` refuse a finished submission whose email answer is not an email address.

The schedule needs two Vault secrets, created once (they are credentials, so they are not in a migration):

```sql
select vault.create_secret('https://<project-ref>.supabase.co/functions/v1', 'edge_functions_url');
select vault.create_secret('<service role key>', 'edge_functions_key');
```

Until both exist the schedule does nothing and says so in the Postgres log. If `pg_cron` or `pg_net` cannot be enabled by the migration, enable them in the dashboard and run the two `cron.schedule` calls at the end of the second migration.

## 2. Deploy the functions

New: `form-upload-presign`, `r2-usage`, `escalation-check`, `digest-dispatch`, `storage-alerts`.
Changed: `admin-users-invite`, `hub-hydrate`, `send-submission-email`.

## 3. Set the secrets

| Secret | Used by | Notes |
| --- | --- | --- |
| `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_BASE_URL` | `form-upload-presign`, `r2-usage`, `r2-presign` | The same R2 token as for the image uploads. Object Read & Write covers listing the bucket for the usage figure. |
| `R2_STORAGE_LIMIT_GB` | `r2-usage` | Optional. Overrides the 10 GB free-tier limit Settings shows. |
| `GOOGLE_CHAT_WEBHOOK_URL` | `escalation-check`, `digest-dispatch` | An incoming webhook on the Chat space: open the space, Apps and integrations, Webhooks. Email still goes out without it. |
| `SITE_URL` | `escalation-check`, `digest-dispatch`, `lead-email-dispatch` | The public address of the app, for the links in messages. `lead-email-dispatch` falls back to the address of the staff browser that triggered it, and uses it to fill `{{hub_link}}`. |

There is no test button in the app. To check the Google Chat connection, wait for a real escalation alert or the next daily or weekly summary.

## 4. Bucket CORS

Applicants upload from the public form, so the bucket's CORS rule must allow `PUT` with the `Content-Type` and `Cache-Control` headers from the app's origin, as it already does for the admin.

## How it behaves

- **File questions.** Two limits apply: a fixed list of file types and a 10 MB ceiling in code, and the types and size set on each file question in the form builder (the only place the team sets a file limit). The server checks both; the browser check is only a quick answer. SVG and HTML are not accepted. An applicant's file name never reaches the bucket: the key is `forms/<form id>/<uuid>.<ext>`. A session can start 10 uploads an hour and a form 300.
- **Privacy consent.** Every public form asks for it on the last question. The notice and link come from Settings; the answer is stored with the submission under `__consent`, with the time.
- **Escalation.** Every 5 minutes, leads in the lead, MQL or SQL stage that arrived after escalation was switched on, have waited longer than the delay on Settings, and have no hub that has been sent, are raised once, in one message to Google Chat and by email to the same people who get new-submission emails (admins with notifications on, plus the notification email list).
- **Daily summary.** At the time on Settings (IST): leads received, applicant hubs sent, calls made by outcome, from midnight to then.
- **Weekly summary.** On the day and time on Settings (IST), the seven days before, set against the seven before those: leads received, moves into MQL, SQL, customer, advocate, nurture, dormant and lost, hubs sent, hub open rate, calls by outcome, and the Attention needed counts, each with whether it went up or down.
- **Storage warnings.** `storage-alerts` runs once a day (04:00 UTC, 09:30 IST). When the Supabase database is over 0.4 GB, or the R2 bucket is over 9 GB, every active super admin gets an email, one a day for three days. After the third it stays quiet until usage has dropped back under the line and climbed over it again. If R2 is not configured, only the database is checked. The free-plan limits and warning levels are in `supabase/functions/_shared/storageAlerts.ts`; the schedule comes from the `storage_alerts` migration.
