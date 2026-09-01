drop policy if exists "students upload own reports" on storage.objects;
create policy "students upload own reports" on storage.objects for insert to authenticated with check (
  bucket_id = 'practicum-reports'
  and (storage.foldername(name))[1] = auth.uid()::text
  and lower(storage.extension(name)) = 'pdf'
  and coalesce(metadata->>'mimetype', '') = 'application/pdf'
  and coalesce((metadata->>'size')::bigint, 0) <= 31457280
);

drop policy if exists "students replace own reports" on storage.objects;
create policy "students replace own reports" on storage.objects for update to authenticated using (
  bucket_id = 'practicum-reports' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff())
) with check (
  bucket_id = 'practicum-reports'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff())
  and lower(storage.extension(name)) = 'pdf'
  and coalesce(metadata->>'mimetype', '') = 'application/pdf'
  and coalesce((metadata->>'size')::bigint, 0) <= 31457280
);
