-- OpenDinks initial schema: venues, sessions, matches, RLS

create extension if not exists "pgcrypto";

create type public.skill_tier as enum (
  'beginner',
  'novice',
  'intermediate',
  'advanced'
);

-- Profiles (hosts)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  timezone text not null default 'UTC',
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);

create type public.venue_role as enum ('owner', 'admin', 'host');

create table public.venue_members (
  venue_id uuid not null references public.venues (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.venue_role not null default 'host',
  created_at timestamptz not null default now(),
  primary key (venue_id, user_id)
);

create table public.courts (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  skill_min public.skill_tier,
  skill_max public.skill_tier,
  created_at timestamptz not null default now()
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  name text not null,
  skill public.skill_tier not null default 'intermediate',
  dupr_id text,
  gender text,
  created_at timestamptz not null default now()
);

create type public.session_mode as enum (
  'rotating',
  'skill_separated',
  'king_of_court',
  'singles'
);

create type public.session_status as enum ('scheduled', 'live', 'completed');

create table public.sessions (
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

create type public.session_player_status as enum (
  'waiting',
  'playing',
  'resting',
  'left'
);

create table public.session_players (
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

create type public.match_status as enum ('ready', 'active', 'completed');

create table public.matches (
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

create table public.pairing_history (
  session_id uuid not null references public.sessions (id) on delete cascade,
  player_a uuid not null references public.session_players (id) on delete cascade,
  player_b uuid not null references public.session_players (id) on delete cascade,
  as_partners int not null default 0,
  as_opponents int not null default 0,
  primary key (session_id, player_a, player_b),
  check (player_a < player_b)
);

create table public.session_events (
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
as $$
  select exists (
    select 1 from public.venue_members
    where venue_id = p_venue_id and user_id = auth.uid()
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
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select to authenticated
  using (true);

create policy "Users update own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid());

-- Venues
create policy "Members can view venues"
  on public.venues for select to authenticated
  using (public.is_venue_member(id));

create policy "Authenticated can create venues"
  on public.venues for insert to authenticated
  with check (created_by = auth.uid());

create policy "Members can update venues"
  on public.venues for update to authenticated
  using (public.is_venue_member(id));

-- Venue members
create policy "Members can view venue_members"
  on public.venue_members for select to authenticated
  using (public.is_venue_member(venue_id));

create policy "Owners can manage venue_members"
  on public.venue_members for all to authenticated
  using (
    exists (
      select 1 from public.venue_members vm
      where vm.venue_id = venue_members.venue_id
        and vm.user_id = auth.uid()
        and vm.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.venue_members vm
      where vm.venue_id = venue_members.venue_id
        and vm.user_id = auth.uid()
        and vm.role in ('owner', 'admin')
    )
    or user_id = auth.uid()
  );

-- Allow creator to insert themselves as owner when creating venue
create policy "Users can insert themselves as venue member"
  on public.venue_members for insert to authenticated
  with check (user_id = auth.uid());

-- Courts / players (roster)
create policy "Members manage courts"
  on public.courts for all to authenticated
  using (public.is_venue_member(venue_id))
  with check (public.is_venue_member(venue_id));

create policy "Members manage players"
  on public.players for all to authenticated
  using (public.is_venue_member(venue_id))
  with check (public.is_venue_member(venue_id));

-- Sessions: hosts manage; public can read by token via anon policies using token filter in app
-- For guest access we use a SECURITY DEFINER RPC + permissive select on live session by token.

create policy "Members manage sessions"
  on public.sessions for all to authenticated
  using (public.is_venue_member(venue_id))
  with check (public.is_venue_member(venue_id));

create policy "Anyone can read session by selecting (token filtered in client)"
  on public.sessions for select to anon, authenticated
  using (status in ('live', 'completed', 'scheduled'));

create policy "Members manage session_players"
  on public.session_players for all to authenticated
  using (public.is_venue_member(public.session_venue_id(session_id)))
  with check (public.is_venue_member(public.session_venue_id(session_id)));

create policy "Public can read session_players for live sessions"
  on public.session_players for select to anon, authenticated
  using (
    exists (
      select 1 from public.sessions s
      where s.id = session_id and s.status in ('live', 'completed', 'scheduled')
    )
  );

create policy "Public can self check-in to live sessions"
  on public.session_players for insert to anon, authenticated
  with check (
    exists (
      select 1 from public.sessions s
      where s.id = session_id and s.status = 'live'
    )
  );

create policy "Members manage matches"
  on public.matches for all to authenticated
  using (public.is_venue_member(public.session_venue_id(session_id)))
  with check (public.is_venue_member(public.session_venue_id(session_id)));

create policy "Public can read matches"
  on public.matches for select to anon, authenticated
  using (
    exists (
      select 1 from public.sessions s
      where s.id = session_id and s.status in ('live', 'completed', 'scheduled')
    )
  );

create policy "Members manage pairing_history"
  on public.pairing_history for all to authenticated
  using (public.is_venue_member(public.session_venue_id(session_id)))
  with check (public.is_venue_member(public.session_venue_id(session_id)));

create policy "Public can read pairing_history"
  on public.pairing_history for select to anon, authenticated
  using (
    exists (
      select 1 from public.sessions s
      where s.id = session_id and s.status in ('live', 'completed', 'scheduled')
    )
  );

create policy "Members manage session_events"
  on public.session_events for all to authenticated
  using (public.is_venue_member(public.session_venue_id(session_id)))
  with check (public.is_venue_member(public.session_venue_id(session_id)));

-- Realtime
alter publication supabase_realtime add table public.sessions;
alter publication supabase_realtime add table public.session_players;
alter publication supabase_realtime add table public.matches;
