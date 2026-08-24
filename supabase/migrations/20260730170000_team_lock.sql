alter table public.session_players
  add column if not exists team_lock_group_id text;
