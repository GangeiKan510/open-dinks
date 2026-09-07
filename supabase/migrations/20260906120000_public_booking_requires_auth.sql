-- Require a signed-in Supabase Auth user for public court/coaching requests.
-- Sets created_by from auth.uid() so staff can see who submitted the request.
-- Revokes anon execute so unauthenticated clients cannot call these RPCs.

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
    coalesce(
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'name', ''),
      nullif(new.raw_user_meta_data->>'display_name', ''),
      split_part(new.email, '@', 1),
      'Guest'
    )
  );
  return new;
end;
$$;

create or replace function public.request_booking(
  p_venue_id uuid,
  p_court_id uuid,
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
  v_user uuid := auth.uid();
  v_email text;
begin
  if v_user is null then
    raise exception 'Sign in required to request a booking' using errcode = '42501';
  end if;

  if p_ends_at <= p_starts_at then
    raise exception 'Booking must end after it starts' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.courts
    where id = p_court_id and venue_id = p_venue_id
  ) then
    raise exception 'Court does not belong to this venue' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.bookings
    where court_id = p_court_id
      and status = 'confirmed'
      and ends_at > p_starts_at
      and starts_at < p_ends_at
  ) then
    raise exception 'That court is already booked for the selected time'
      using errcode = '23P01';
  end if;

  if exists (
    select 1 from public.coaching_bookings
    where court_id = p_court_id
      and status = 'confirmed'
      and ends_at > p_starts_at
      and starts_at < p_ends_at
  ) then
    raise exception 'That court is already booked for the selected time'
      using errcode = '23P01';
  end if;

  v_email := nullif(trim(coalesce(p_contact_email, '')), '');
  if v_email is null then
    select email into v_email from auth.users where id = v_user;
  end if;

  insert into public.bookings (
    venue_id, court_id, starts_at, ends_at, status,
    booked_by_name, contact_email, contact_phone, notes, source, created_by
  )
  values (
    p_venue_id, p_court_id, p_starts_at, p_ends_at, 'pending',
    p_booked_by_name, v_email, p_contact_phone, p_notes, 'public', v_user
  )
  returning public_token into v_token;

  return v_token;
end;
$$;

create or replace function public.request_coaching_booking(
  p_venue_id uuid,
  p_coach_id uuid,
  p_court_id uuid,
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
  v_user uuid := auth.uid();
  v_email text;
begin
  if v_user is null then
    raise exception 'Sign in required to request a booking' using errcode = '42501';
  end if;

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

  if not exists (
    select 1 from public.courts
    where id = p_court_id and venue_id = p_venue_id
  ) then
    raise exception 'Court does not belong to this venue' using errcode = '22023';
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

  if exists (
    select 1 from public.bookings
    where court_id = p_court_id
      and status = 'confirmed'
      and ends_at > p_starts_at
      and starts_at < p_ends_at
  )
  or exists (
    select 1 from public.coaching_bookings
    where court_id = p_court_id
      and status = 'confirmed'
      and ends_at > p_starts_at
      and starts_at < p_ends_at
  ) then
    raise exception 'That court is already booked for the selected time'
      using errcode = '23P01';
  end if;

  v_hours := greatest(
    1,
    round(extract(epoch from (p_ends_at - p_starts_at)) / 3600.0)::int
  );

  v_email := nullif(trim(coalesce(p_contact_email, '')), '');
  if v_email is null then
    select email into v_email from auth.users where id = v_user;
  end if;

  insert into public.coaching_bookings (
    venue_id, coach_id, court_id, starts_at, ends_at, status,
    booked_by_name, contact_email, contact_phone, notes,
    price_cents, payment_status, source, created_by
  )
  values (
    p_venue_id, p_coach_id, p_court_id, p_starts_at, p_ends_at, 'pending',
    p_booked_by_name, v_email, p_contact_phone, p_notes,
    v_rate * v_hours, 'unpaid', 'public', v_user
  )
  returning public_token into v_token;

  return v_token;
end;
$$;

revoke execute on function public.request_booking(
  uuid, uuid, timestamptz, timestamptz, text, text, text, text
) from anon;

revoke execute on function public.request_coaching_booking(
  uuid, uuid, uuid, timestamptz, timestamptz, text, text, text, text
) from anon;

grant execute on function public.request_booking(
  uuid, uuid, timestamptz, timestamptz, text, text, text, text
) to authenticated;

grant execute on function public.request_coaching_booking(
  uuid, uuid, uuid, timestamptz, timestamptz, text, text, text, text
) to authenticated;
