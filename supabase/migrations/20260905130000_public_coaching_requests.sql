-- Public coaching request surface (anon via SECURITY DEFINER RPCs only).
-- Pending coaching rows do not hold the coach; confirmed ones exclusive-lock.

-- Active coaches + weekly availability + rate for the public booking page.
create or replace function public.get_public_coaches(p_venue_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select coalesce(jsonb_agg(coach_row order by coach_row->>'name'), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'rateCents', c.rate_cents,
      'availability', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'dayOfWeek', a.day_of_week,
            'startHour', a.start_hour,
            'endHour', a.end_hour
          )
          order by a.day_of_week, a.start_hour
        )
        from public.coach_availability a
        where a.coach_id = c.id
      ), '[]'::jsonb)
    ) as coach_row
    from public.coaches c
    where c.venue_id = p_venue_id
      and c.active = true
  ) coaches;
$$;

-- Confirmed coaching windows only (no names / contacts).
create or replace function public.get_coach_busy_ranges(
  p_venue_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (coach_id uuid, starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select b.coach_id, b.starts_at, b.ends_at
  from public.coaching_bookings b
  where b.venue_id = p_venue_id
    and b.status = 'confirmed'
    and b.ends_at > p_from
    and b.starts_at < p_to
  order by b.starts_at;
$$;

-- Public coaching request. Always pending; price snapshot from coach rate.
create or replace function public.request_coaching_booking(
  p_venue_id uuid,
  p_coach_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_booked_by_name text,
  p_contact_email text default null,
  p_contact_phone text default null,
  p_notes text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
set row_security = off
as $$
declare
  v_token uuid;
  v_rate int;
  v_hours int;
begin
  if p_ends_at <= p_starts_at then
    raise exception 'Booking must end after it starts' using errcode = '22023';
  end if;

  select rate_cents into v_rate
  from public.coaches
  where id = p_coach_id
    and venue_id = p_venue_id
    and active = true;

  if v_rate is null then
    raise exception 'Coach does not belong to this venue' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.coaching_bookings
    where coach_id = p_coach_id
      and status = 'confirmed'
      and ends_at > p_starts_at
      and starts_at < p_ends_at
  ) then
    raise exception 'That coach is already booked for the selected time'
      using errcode = '23P01';
  end if;

  v_hours := greatest(
    1,
    round(extract(epoch from (p_ends_at - p_starts_at)) / 3600.0)::int
  );

  insert into public.coaching_bookings (
    venue_id, coach_id, starts_at, ends_at, status,
    booked_by_name, contact_email, contact_phone, notes,
    price_cents, payment_status, source
  )
  values (
    p_venue_id, p_coach_id, p_starts_at, p_ends_at, 'pending',
    p_booked_by_name, p_contact_email, p_contact_phone, p_notes,
    v_rate * v_hours, 'unpaid', 'public'
  )
  returning public_token into v_token;

  return v_token;
end;
$$;

create or replace function public.get_coaching_request_status(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select jsonb_build_object(
    'kind', 'coaching',
    'status', b.status,
    'bookedByName', b.booked_by_name,
    'startsAt', b.starts_at,
    'endsAt', b.ends_at,
    'venueName', v.name,
    'venueSlug', v.slug,
    'venueTimezone', v.timezone,
    'coachName', c.name,
    'priceCents', b.price_cents
  )
  from public.coaching_bookings b
  join public.venues v on v.id = b.venue_id
  join public.coaches c on c.id = b.coach_id
  where b.public_token = p_token
    and b.source = 'public';
$$;

grant execute on function public.get_public_coaches(uuid) to anon, authenticated;
grant execute on function public.get_coach_busy_ranges(uuid, timestamptz, timestamptz) to anon, authenticated;
grant execute on function public.request_coaching_booking(uuid, uuid, timestamptz, timestamptz, text, text, text, text) to anon, authenticated;
grant execute on function public.get_coaching_request_status(uuid) to anon, authenticated;

do $$ begin
  alter publication supabase_realtime add table public.coaching_bookings;
exception when duplicate_object then null;
end $$;
