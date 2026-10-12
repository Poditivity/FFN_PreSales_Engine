-- DEVELOPMENT ONLY. Never run by a deployment.
--
-- A fixed-slug, public, active form for the Playwright e2e suite. It used to be
-- created by three migrations, which meant every new deployment shipped with a
-- publicly reachable "E2E Smoke Test" form. Those migrations are now empty. Run
-- this file by hand against a development project if you want the fixture:
--
--   psql "$DEV_DATABASE_URL" -f supabase/dev-seed/e2e-smoke-test-form.sql
--
-- The e2e suite does not need it: test-support/e2eData.ts (ensureSmokeForm)
-- creates the same form when a run starts and removes it when the run ends.
--
insert into forms (title, slug, status, schema)
values (
  '[E2E fixture — do not edit] Smoke Test',
  'e2e-smoke-test',
  'active',
  '{
    "version": 2,
    "startNodeId": "start",
    "nodes": [
      {"id":"start","type":"start","position":{"x":80,"y":40},"data":{}},
      {"id":"name","type":"question","position":{"x":80,"y":180},"data":{"field":{"id":"name","type":"text","label":"Full name","placeholder":"","required":true,"helpText":"","width":"full","validation":{},"showIf":null}}},
      {"id":"email","type":"question","position":{"x":80,"y":320},"data":{"field":{"id":"email","type":"email","label":"Email","placeholder":"","required":true,"helpText":"","width":"full","validation":{},"showIf":null}}},
      {"id":"why","type":"question","position":{"x":80,"y":460},"data":{"field":{"id":"why","type":"textarea","label":"Why do you want to join?","placeholder":"","required":true,"helpText":"","width":"full","validation":{},"showIf":null}}},
      {"id":"end1","type":"end","position":{"x":80,"y":600},"data":{"label":"Finish","message":"","redirect_url":""}}
    ],
    "edges": [
      {"id":"e1","source":"start","target":"name","type":"flow","data":{"kind":"always"}},
      {"id":"e2","source":"name","target":"email","type":"flow","data":{"kind":"always"}},
      {"id":"e3","source":"email","target":"why","type":"flow","data":{"kind":"always"}},
      {"id":"e4","source":"why","target":"end1","type":"flow","data":{"kind":"always"}}
    ]
  }'::jsonb
)
on conflict (slug) do update set
  status = excluded.status,
  schema = excluded.schema;
