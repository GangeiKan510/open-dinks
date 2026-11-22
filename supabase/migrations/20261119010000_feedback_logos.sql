-- Optional club logo on an anonymous note. Visitors cannot set the URL
-- themselves. The server stores a file in this bucket, then writes the
-- public URL with the service role. Featured reviews are the only public read.

alter table public.feedback
  add column if not exists logo_url text;

drop policy if exists feedback_insert_public on public.feedback;
create policy feedback_insert_public
  on public.feedback
  for insert
  to anon, authenticated
  with check (
    featured = false
    and logo_url is null
    and char_length(btrim(body)) between 8 and 2000
    and (rating is null or rating between 1 and 5)
  );

drop function if exists public.featured_feedback();

create function public.featured_feedback()
returns table (
  id uuid,
  body text,
  rating smallint,
  logo_url text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select f.id, f.body, f.rating, f.logo_url, f.created_at
  from public.feedback f
  where f.featured
  order by f.created_at desc
  limit 12;
$$;

revoke all on function public.featured_feedback() from public;
grant execute on function public.featured_feedback() to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'feedback-logos',
  'feedback-logos',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can read feedback logos" on storage.objects;
create policy "Anyone can read feedback logos"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'feedback-logos');
