-- New facilities do not start the 7-day trial on insert.
-- The host picks a trial, a club month, or a tournament pass first.
-- Clubs that already have a billing row keep the trial they were given.

alter table public.facility_billing
  alter column trial_ends_at drop not null;

alter table public.facility_billing
  add column if not exists choice_made_at timestamptz;

comment on column public.facility_billing.choice_made_at is
  'When the host started the trial or a payment was confirmed. Null keeps the dashboard on the plan choice.';

update public.facility_billing
set choice_made_at = coalesce(updated_at, now())
where choice_made_at is null;

create or replace function public.start_facility_trial()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.facility_billing (facility_id, trial_ends_at, choice_made_at)
  values (new.id, null, null)
  on conflict (facility_id) do nothing;
  return new;
end;
$$;
