-- Open play setup: format, match rules, and the extra matchmaking modes.
-- New enum values are not inserted in this migration, so they can be added
-- in the same transaction on Postgres 12+.

alter type public.session_mode add value if not exists 'all_random';
alter type public.session_mode add value if not exists 'rated';
alter type public.session_mode add value if not exists 'court_kings';
alter type public.session_mode add value if not exists 'social_shuffle';
alter type public.session_mode add value if not exists 'couple_hunt';

alter table public.sessions
  add column if not exists game_format text not null default 'doubles';

alter table public.sessions
  add column if not exists score_tracking text not null default 'winner';

alter table public.sessions
  add column if not exists player_game_limit int;

alter table public.sessions
  add column if not exists matching text not null default 'manual';

alter table public.sessions
  alter column max_game_minutes drop not null;

alter table public.sessions
  drop constraint if exists sessions_max_game_minutes_check;

alter table public.sessions
  add constraint sessions_max_game_minutes_check
  check (max_game_minutes is null or max_game_minutes between 1 and 60);

alter table public.sessions
  drop constraint if exists sessions_game_format_check;

alter table public.sessions
  add constraint sessions_game_format_check
  check (game_format in ('doubles', 'singles'));

alter table public.sessions
  drop constraint if exists sessions_score_tracking_check;

alter table public.sessions
  add constraint sessions_score_tracking_check
  check (score_tracking in ('winner', 'scores'));

alter table public.sessions
  drop constraint if exists sessions_player_game_limit_check;

alter table public.sessions
  add constraint sessions_player_game_limit_check
  check (player_game_limit is null or player_game_limit between 1 and 30);

alter table public.sessions
  drop constraint if exists sessions_matching_check;

alter table public.sessions
  add constraint sessions_matching_check
  check (matching in ('auto', 'manual'));

alter table public.session_players
  add column if not exists gender text;

alter table public.session_players
  add column if not exists last_result text;

alter table public.session_players
  drop constraint if exists session_players_gender_check;

alter table public.session_players
  add constraint session_players_gender_check
  check (gender is null or gender in ('man', 'woman'));

alter table public.session_players
  drop constraint if exists session_players_last_result_check;

alter table public.session_players
  add constraint session_players_last_result_check
  check (last_result is null or last_result in ('win', 'loss'));

alter table public.matches
  add column if not exists score_a int;

alter table public.matches
  add column if not exists score_b int;

alter table public.matches
  drop constraint if exists matches_scores_check;

alter table public.matches
  add constraint matches_scores_check
  check (
    (score_a is null and score_b is null)
    or (
      score_a is not null
      and score_b is not null
      and score_a >= 0
      and score_b >= 0
      and score_a <> score_b
    )
  );
