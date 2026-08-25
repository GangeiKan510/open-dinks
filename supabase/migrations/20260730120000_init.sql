-- OpenDinks initial schema: venues, sessions, matches, RLS
-- Idempotent so a partially-applied remote DB can finish via `supabase db push`.

create extension if not exists "pgcrypto";

do $$ begin
  create type public.skill_tier as enum (
    'beginner',
    'novice',
    'intermediate',
    'advanced'
  );
exception when duplicate_object then null;
end $$;

-- Profiles (hosts)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  timezone text not null default 'UTC',
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);

do $$ begin
  create type public.venue_role as enum ('owner', 'admin', 'host');
exception when duplicate_object then null;
end $$;

create table if not exists public.venue_members (
  venue_id uuid not null references public.venues (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.venue_role not null default 'host',
  created_at timestamptz not null default now(),
  primary key (venue_id, user_id)
);

create table if not exists public.courts (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  skill_min public.skill_tier,
  skill_max public.skill_tier,
  created_at timestamptz not null default now()
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  name text not null,
  skill public.skill_tier not null default 'intermediate',
  dupr_id text,
  gender text,
  created_at timestamptz not null default now()
);

do $$ begin
  create type public.session_mode as enum (
    'rotating',
    'skill_separated',
    'king_of_court',
    'singles'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.session_status as enum ('scheduled', 'live', 'completed');
exception when duplicate_object then null;
end $$;

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  title text not null default 'Open Play',
  public_token text not null unique default encode(gen_random_bytes(9), 'hex'),
  mode public.session_mode not null default 'rotating',
  status public.session_status not null default 'scheduled',
  court_count int not null default 3,
  king_max_consecutive_wins int not null default 3,
  max_game_minutes int not null default 15 check (max_game_minutes between 1 and 60),
  started_at timestamptz,
  ended_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

do $$ begin
  create type public.session_player_status as enum (
    'waiting',
    'playing',
    'resting',
    'left'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.session_players (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  player_id uuid references public.players (id) on delete set null,
  display_name text not null,
  skill public.skill_tier not null default 'intermediate',
  status public.session_player_status not null default 'waiting',
  games_played int not null default 0,
  last_played_at timestamptz,
  checked_in_at timestamptz not null default now(),
  partner_lock_id uuid references public.session_players (id) on delete set null,
  avoid_ids uuid[] not null default '{}',
  consecutive_wins int not null default 0,
  queue_order int,
  team_lock_group_id text,
  unique (session_id, display_name)
);

do $$ begin
  create type public.match_status as enum ('ready', 'active', 'completed');
exception when duplicate_object then null;
end $$;

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  court_id uuid references public.courts (id) on delete set null,
  court_name text not null,
  team_a uuid[] not null,
  team_b uuid[] not null,
  status public.match_status not null default 'ready',
  winner text check (winner is null or winner in ('a', 'b')),
  started_at timestamptz,
  ended_at timestamptz
);

create table if not exists public.pairing_history (
  session_id uuid not null references public.sessions (id) on delete cascade,
  player_a uuid not null references public.session_players (id) on delete cascade,
  player_b uuid not null references public.session_players (id) on delete cascade,
  as_partners int not null default 0,
  as_opponents int not null default 0,
  primary key (session_id, player_a, player_b),
  check (player_a < player_b)
);

create table if not exists public.session_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'Host')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helpers for RLS
create or replace function public.is_venue_member(p_venue_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1 from public.venue_members
    where venue_id = p_venue_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_venue_manager(p_venue_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1 from public.venue_members
    where venue_id = p_venue_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

create or replace function public.session_venue_id(p_session_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select venue_id from public.sessions where id = p_session_id;
$$;

-- RLS
alter table public.profiles enable row level security;
alter table public.venues enable row level security;
alter table public.venue_members enable row level security;
alter table public.courts enable row level security;
alter table public.players enable row level security;
alter table public.sessions enable row level security;
alter table public.session_players enable row level security;
alter table public.matches enable row level security;
alter table public.pairing_history enable row level security;
alter table public.session_events enable row level security;

-- Profiles
drop policy if exists "Profiles are viewable by authenticated users" on public.profiles;
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select to authenticated
  using (true);

drop policy if exists "Users insert own profile" on public.profiles;
create policy "Users insert own profile"
  on public.profiles for insert to authenticated
  with check (id = auth.uid());

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid());

-- Venues
drop policy if exists "Members can view venues" on public.venues;
create policy "Members can view venues"
  on public.venues for select to authenticated
  using (public.is_venue_member(id) or created_by = auth.uid());

drop policy if exists "Authenticated can create venues" on public.venues;
create policy "Authenticated can create venues"
  on public.venues for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists "Members can update venues" on public.venues;
create policy "Members can update venues"
  on public.venues for update to authenticated
  using (public.is_venue_member(id));

-- Venue members
-- SELECT only own rows so policies never re-query venue_members under RLS
-- (a FOR ALL policy with EXISTS on venue_members causes 42P17 recursion).
drop policy if exists "Members can view venue_members" on public.venue_members;
create policy "Members can view venue_members"
  on public.venue_members for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Owners can manage venue_members" on public.venue_members;

drop policy if exists "Users can insert themselves as venue member" on public.venue_members;
create policy "Users can insert themselves as venue member"
  on public.venue_members for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Managers can add venue_members" on public.venue_members;
create policy "Managers can add venue_members"
  on public.venue_members for insert to authenticated
  with check (public.is_venue_manager(venue_id));

drop policy if exists "Managers can update venue_members" on public.venue_members;
create policy "Managers can update venue_members"
  on public.venue_members for update to authenticated
  using (public.is_venue_manager(venue_id))
  with check (public.is_venue_manager(venue_id));

drop policy if exists "Managers can delete venue_members" on public.venue_members;
create policy "Managers can delete venue_members"
  on public.venue_members for delete to authenticated
  using (public.is_venue_manager(venue_id));

-- Courts / players (roster)
drop policy if exists "Members manage courts" on public.courts;
create policy "Members manage courts"
  on public.courts for all to authenticated
  using (public.is_venue_member(venue_id))
  with check (public.is_venue_member(venue_id));

drop policy if exists "Members manage players" on public.players;
create policy "Members manage players"
  on public.players for all to authenticated
  using (public.is_venue_member(venue_id))
  with check (public.is_venue_member(venue_id));

drop policy if exists "Members manage sessions" on public.sessions;
create policy "Members manage sessions"
  on public.sessions for all to authenticated
  using (public.is_venue_member(venue_id))
  with check (public.is_venue_member(venue_id));

drop policy if exists "Anyone can read session by selecting (token filtered in client)" on public.sessions;
create policy "Anyone can read session by selecting (token filtered in client)"
  on public.sessions for select to anon, authenticated
  using (status in ('live', 'completed', 'scheduled'));

drop policy if exists "Members manage session_players" on public.session_players;
create policy "Members manage session_players"
  on public.session_players for all to authenticated
  using (public.is_venue_member(public.session_venue_id(session_id)))
  with check (public.is_venue_member(public.session_venue_id(session_id)));

drop policy if exists "Public can read session_players for live sessions" on public.session_players;
create policy "Public can read session_players for live sessions"
  on public.session_players for select to anon, authenticated
  using (
    exists (
      select 1 from public.sessions s
      where s.id = session_id and s.status in ('live', 'completed', 'scheduled')
    )
  );

drop policy if exists "Public can self check-in to live sessions" on public.session_players;
create policy "Public can self check-in to live sessions"
  on public.session_players for insert to anon, authenticated
  with check (
    exists (
      select 1 from public.sessions s
      where s.id = session_id and s.status = 'live'
    )
  );

drop policy if exists "Members manage matches" on public.matches;
create policy "Members manage matches"
  on public.matches for all to authenticated
  using (public.is_venue_member(public.session_venue_id(session_id)))
  with check (public.is_venue_member(public.session_venue_id(session_id)));

drop policy if exists "Public can read matches" on public.matches;
create policy "Public can read matches"
  on public.matches for select to anon, authenticated
  using (
    exists (
      select 1 from public.sessions s
      where s.id = session_id and s.status in ('live', 'completed', 'scheduled')
    )
  );

drop policy if exists "Members manage pairing_history" on public.pairing_history;
create policy "Members manage pairing_history"
  on public.pairing_history for all to authenticated
  using (public.is_venue_member(public.session_venue_id(session_id)))
  with check (public.is_venue_member(public.session_venue_id(session_id)));

drop policy if exists "Public can read pairing_history" on public.pairing_history;
create policy "Public can read pairing_history"
  on public.pairing_history for select to anon, authenticated
  using (
    exists (
      select 1 from public.sessions s
      where s.id = session_id and s.status in ('live', 'completed', 'scheduled')
    )
  );

drop policy if exists "Members manage session_events" on public.session_events;
create policy "Members manage session_events"
  on public.session_events for all to authenticated
  using (public.is_venue_member(public.session_venue_id(session_id)))
  with check (public.is_venue_member(public.session_venue_id(session_id)));

-- Realtime
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sessions'
  ) then
    alter publication supabase_realtime add table public.sessions;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'session_players'
  ) then
    alter publication supabase_realtime add table public.session_players;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'matches'
  ) then
    alter publication supabase_realtime add table public.matches;
  end if;
end $$;
