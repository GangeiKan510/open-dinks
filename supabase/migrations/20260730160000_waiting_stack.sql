-- Host-controlled waiting stack order
alter table public.session_players
  add column if not exists queue_order int;
