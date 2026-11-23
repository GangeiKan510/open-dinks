-- Operator-controlled plan prices and which product surfaces are shown.
-- Hosts and the public site read the row through platform_catalog().
-- Writes stay on the service role.

create table if not exists public.platform_settings (
  id boolean primary key default true check (id),
  club_monthly_php integer not null default 799,
  tournament_day_php integer not null default 2000,
  show_open_play boolean not null default true,
  show_booking boolean not null default false,
  show_tournament boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint platform_settings_club_price
    check (club_monthly_php between 1 and 100000),
  constraint platform_settings_tournament_price
    check (tournament_day_php between 1 and 100000)
);

insert into public.platform_settings (id)
values (true)
on conflict (id) do nothing;

alter table public.platform_settings enable row level security;

revoke all on table public.platform_settings from anon, authenticated;

create or replace function public.platform_catalog()
returns table (
  club_monthly_php integer,
  tournament_day_php integer,
  show_open_play boolean,
  show_booking boolean,
  show_tournament boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    club_monthly_php,
    tournament_day_php,
    show_open_play,
    show_booking,
    show_tournament
  from public.platform_settings
  where id
  limit 1;
$$;

revoke all on function public.platform_catalog() from public;
grant execute on function public.platform_catalog() to anon, authenticated;
