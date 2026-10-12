-- Case study PDFs.
--
-- Case studies are PDFs, and the applicant hub reads them in the page itself so
-- reading can be tracked page by page. That needs the file to come from a host
-- the browser is allowed to read, so staff upload the PDF here instead of
-- pasting a link to somewhere else.
--
-- The bucket is public for reads: hub visitors are not signed in, and the file
-- names are random ids, not guessable. Only signed-in admins can add, replace or
-- remove files. Only PDFs, at most 25 MB each.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('case-studies', 'case-studies', true, 26214400, array['application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists case_study_pdfs_staff_insert on storage.objects;
create policy case_study_pdfs_staff_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'case-studies' and is_admin());

drop policy if exists case_study_pdfs_staff_update on storage.objects;
create policy case_study_pdfs_staff_update on storage.objects
  for update to authenticated
  using (bucket_id = 'case-studies' and is_admin())
  with check (bucket_id = 'case-studies' and is_admin());

drop policy if exists case_study_pdfs_staff_delete on storage.objects;
create policy case_study_pdfs_staff_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'case-studies' and is_admin());
