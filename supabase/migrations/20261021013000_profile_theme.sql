-- Per-account color theme. Default is the court palette.
alter table public.profiles
  add column if not exists theme text not null default 'court';

alter table public.profiles
  drop constraint if exists profiles_theme_check;

alter table public.profiles
  add constraint profiles_theme_check
  check (theme in ('court', 'blue', 'green', 'red', 'mono'));
