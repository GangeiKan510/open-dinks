-- The first bookings migration created booking_status with the label
-- 'cancelledx'. The app reads and writes 'cancelled'. PostgREST rejects a
-- filter for a label the enum does not have, and the dashboard then treats
-- that error as an empty schedule.

do $$
begin
  if exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'booking_status'
      and e.enumlabel = 'cancelledx'
  ) and not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'booking_status'
      and e.enumlabel = 'cancelled'
  ) then
    alter type public.booking_status rename value 'cancelledx' to 'cancelled';
  end if;
end $$;
