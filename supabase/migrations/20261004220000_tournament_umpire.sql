-- Secret write link for the umpire phone. Kept off the tournament row so a
-- scoreboard subscriber cannot read it from a realtime payload.

create table if not exists public.tournament_umpire_links (
  tournament_id uuid primary key references public.tournaments (id) on delete cascade,
  token text not null unique default gen_random_uuid()::text
);

alter table public.tournament_umpire_links enable row level security;

insert into public.tournament_umpire_links (tournament_id)
select id from public.tournaments
on conflict (tournament_id) do nothing;

create or replace function public.create_tournament_umpire_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.tournament_umpire_links (tournament_id)
  values (new.id)
  on conflict (tournament_id) do nothing;
  return new;
end;
$$;

drop trigger if exists tournaments_create_umpire_link on public.tournaments;
create trigger tournaments_create_umpire_link
  after insert on public.tournaments
  for each row execute function public.create_tournament_umpire_link();

create or replace function public.director_umpire_token()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select link.token
  from public.tournament_umpire_links as link
  join public.tournaments as tournament
    on tournament.id = link.tournament_id
  where tournament.created_by = auth.uid()
  order by tournament.updated_at desc
  limit 1;
$$;

create or replace function public.umpire_load_tournament(p_token text)
returns table (id uuid, document jsonb)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if p_token is null or length(trim(p_token)) = 0 then
    return;
  end if;
  return query
    select tournament.id, tournament.document
    from public.tournament_umpire_links as link
    join public.tournaments as tournament
      on tournament.id = link.tournament_id
    where link.token = p_token
    limit 1;
end;
$$;

create or replace function public.umpire_save_tournament(
  p_token text,
  p_document jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_id uuid;
begin
  if p_token is null or length(trim(p_token)) = 0 then
    raise exception 'umpire token is required';
  end if;
  if p_document is null
     or jsonb_typeof(p_document) <> 'object'
     or not (p_document ? 'categories') then
    raise exception 'tournament document is invalid';
  end if;

  update public.tournaments as tournament
  set document = p_document
  from public.tournament_umpire_links as link
  where link.token = p_token
    and tournament.id = link.tournament_id
  returning tournament.id into updated_id;

  if updated_id is null then
    raise exception 'umpire link was not found';
  end if;
end;
$$;

revoke all on function public.director_umpire_token() from public;
revoke all on function public.umpire_load_tournament(text) from public;
revoke all on function public.umpire_save_tournament(text, jsonb) from public;

grant execute on function public.director_umpire_token() to authenticated;
grant execute on function public.umpire_load_tournament(text) to anon, authenticated;
grant execute on function public.umpire_save_tournament(text, jsonb) to anon, authenticated;
