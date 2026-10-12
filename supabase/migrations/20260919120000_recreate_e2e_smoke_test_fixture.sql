-- Intentionally empty. This migration used to insert the "E2E Smoke Test" form,
-- which put test data into every fresh deployment. The fixture now lives in
-- supabase/dev-seed/e2e-smoke-test-form.sql, for explicit use on a development
-- project only. The file stays so the migration history keeps its order.
select 1;
