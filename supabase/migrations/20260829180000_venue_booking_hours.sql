-- Per-venue booking window in venue-local whole hours.
-- open: 0–23 (inclusive start), close: 1–24 (exclusive end). 0–24 = 24-hour booking.

alter table public.venues
  add column if not exists booking_open_hour int not null default 6;

alter table public.venues
  add column if not exists booking_close_hour int not null default 22;

do $$ begin
  alter table public.venues
    add constraint venues_booking_open_hour_range
    check (booking_open_hour between 0 and 23);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.venues
    add constraint venues_booking_close_hour_range
    check (booking_close_hour between 1 and 24);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.venues
    add constraint venues_booking_hours_valid
    check (booking_close_hour > booking_open_hour);
exception when duplicate_object then null;
end $$;

create or replace function public.get_public_booking_venue(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select jsonb_build_object(
    'id', v.id,
    'name', v.name,
    'slug', v.slug,
    'timezone', v.timezone,
    'bookingOpenHour', v.booking_open_hour,
    'bookingCloseHour', v.booking_close_hour,
    'courts', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', c.id, 'name', c.name)
        order by c.sort_order, c.name
      )
      from public.courts c
      where c.venue_id = v.id
    ), '[]'::jsonb)
  )
  from public.venues v
  where v.slug = p_slug;
$$;
