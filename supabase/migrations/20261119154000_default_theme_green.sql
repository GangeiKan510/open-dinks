-- New accounts start on the green palette. A theme already saved on a profile stays.
alter table public.profiles
  alter column theme set default 'green';
