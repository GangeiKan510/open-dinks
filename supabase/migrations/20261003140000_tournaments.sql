-- One tournament document per director. The scoreboard reads it by public token.

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles (id) on delete cascade,
  -- gen_random_uuid() is built into Postgres. gen_random_bytes needs pgcrypto
  -- on the search path, which this hosted database does not expose.
  public_token text not null unique default gen_random_uuid()::text,
  document jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists tournaments_created_by_updated_at_idx
  on public.tournaments (created_by, updated_at desc);

create or replace function public.touch_tournament_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tournaments_touch_updated_at on public.tournaments;
create trigger tournaments_touch_updated_at
  before update on public.tournaments
  for each row execute function public.touch_tournament_updated_at();

alter table public.tournaments enable row level security;

drop policy if exists "Directors manage own tournaments" on public.tournaments;
create policy "Directors manage own tournaments"
  on public.tournaments for all to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists "Anyone can read a tournament" on public.tournaments;
create policy "Anyone can read a tournament"
  on public.tournaments for select to anon, authenticated
  using (true);

grant select on public.tournaments to anon, authenticated;
grant insert, update, delete on public.tournaments to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tournaments'
  ) then
    alter publication supabase_realtime add table public.tournaments;
  end if;
end $$;
