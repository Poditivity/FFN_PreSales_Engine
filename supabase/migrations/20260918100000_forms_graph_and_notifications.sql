-- Rework forms.schema from a flat field list into a node/edge graph (start /
-- question / end nodes, with branching edges per answer) so the public form
-- becomes a one-question-at-a-time flow instead of a single long page, and
-- add the supporting tables the real build-fellowship source system pairs
-- with it: notification_emails (who gets notified of a new submission),
-- email_logs (delivery record for every submission email), and
-- analytics_events (start/complete/drop funnel tracking).
--
-- forms.payment_link is dropped — it stood in for build-fellowship's
-- Razorpay integration, which is out of scope for a presales forms tool.

alter table forms
  drop column if exists payment_link;

alter table forms
  add column if not exists description text,
  add column if not exists thank_you_message text not null default 'Thank you for applying! We will be in touch soon.',
  add column if not exists post_submit_action text not null default 'message' check (post_submit_action in ('message', 'redirect')),
  add column if not exists redirect_url text;

alter table forms
  alter column schema set default '{"version":2,"nodes":[],"edges":[],"startNodeId":"start"}'::jsonb;

comment on column forms.schema is
  'Node/edge graph: {version, nodes:[{id,type,position,data}], edges:[{id,source,target,type,data}], startNodeId}. type is start|question|end.';

-- ---------------------------------------------------------------------------
-- notification_emails — extra recipients notified of every new submission,
-- alongside every profiles row with role = admin.
-- ---------------------------------------------------------------------------
create table if not exists notification_emails (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  name       text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

alter table notification_emails enable row level security;

create policy notification_emails_admin_all on notification_emails
  for all to authenticated
  using  (is_admin())
  with check (is_admin());

-- ---------------------------------------------------------------------------
-- email_logs — delivery record for every submission-related email, written
-- by send-submission-email (service role, bypasses RLS).
-- ---------------------------------------------------------------------------
create table if not exists email_logs (
  id             uuid primary key default gen_random_uuid(),
  form_id        uuid references forms(id) on delete cascade,
  submission_id  uuid references form_submissions(id) on delete cascade,
  email_type     text not null check (email_type in ('submitter_confirmation', 'admin_notification')),
  to_email       text not null,
  subject        text not null,
  status         text not null check (status in ('sent', 'failed')),
  provider       text,
  error_message  text,
  created_at     timestamptz not null default now()
);
create index if not exists email_logs_submission_idx on email_logs (submission_id);
create index if not exists email_logs_form_idx       on email_logs (form_id, created_at desc);

alter table email_logs enable row level security;

create policy email_logs_admin_select on email_logs
  for select to authenticated
  using (is_admin());

-- ---------------------------------------------------------------------------
-- analytics_events — public form funnel tracking (start / complete / drop).
-- Fire-and-forget from the browser, so anon can insert directly; only admins
-- can read them back.
-- ---------------------------------------------------------------------------
create table if not exists analytics_events (
  id          uuid primary key default gen_random_uuid(),
  session_id  text not null,
  event_type  text not null,
  page_path   text,
  referrer    text,
  user_agent  text,
  utm_source  text,
  utm_medium  text,
  utm_campaign text,
  form_id     uuid references forms(id) on delete set null,
  form_slug   text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists analytics_events_form_idx on analytics_events (form_id, created_at desc);
create index if not exists analytics_events_type_idx on analytics_events (event_type, created_at desc);

alter table analytics_events enable row level security;

create policy analytics_events_public_insert on analytics_events
  for insert to anon, authenticated
  with check (true);

create policy analytics_events_admin_select on analytics_events
  for select to authenticated
  using (is_admin());
