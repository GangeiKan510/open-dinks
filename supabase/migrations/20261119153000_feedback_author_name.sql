-- A featured review shows the club name the visitor typed. It is not an account.

alter table public.feedback
  add column if not exists author_name text;

alter table public.feedback
  drop constraint if exists feedback_author_name_length;

alter table public.feedback
  add constraint feedback_author_name_length
  check (
    author_name is null
    or char_length(btrim(author_name)) between 2 and 80
  );

drop policy if exists feedback_insert_public on public.feedback;
create policy feedback_insert_public
  on public.feedback
  for insert
  to anon, authenticated
  with check (
    featured = false
    and logo_url is null
    and char_length(btrim(author_name)) between 2 and 80
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
  author_name text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select f.id, f.body, f.rating, f.logo_url, f.author_name, f.created_at
  from public.feedback f
  where f.featured
  order by f.created_at desc
  limit 12;
$$;

revoke all on function public.featured_feedback() from public;
grant execute on function public.featured_feedback() to anon, authenticated;
