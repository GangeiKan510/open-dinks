-- Public sponsor logos for the tournament scoreboard.
-- Directors upload into a folder named with their tournament id.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tournament-sponsors',
  'tournament-sponsors',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can read sponsor logos" on storage.objects;
create policy "Anyone can read sponsor logos"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'tournament-sponsors');

drop policy if exists "Directors upload sponsor logos" on storage.objects;
create policy "Directors upload sponsor logos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'tournament-sponsors'
    and (storage.foldername(name))[1] in (
      select id::text from public.tournaments where created_by = auth.uid()
    )
  );

drop policy if exists "Directors delete sponsor logos" on storage.objects;
create policy "Directors delete sponsor logos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'tournament-sponsors'
    and (storage.foldername(name))[1] in (
      select id::text from public.tournaments where created_by = auth.uid()
    )
  );
