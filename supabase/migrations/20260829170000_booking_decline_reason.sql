-- Public booking status links and decline reasons for requester notification.

alter table public.bookings
  add column if not exists public_token uuid not null default gen_random_uuid();

alter table public.bookings
  add column if not exists decline_reason text;

do $$ begin
  alter table public.bookings
    add constraint bookings_decline_reason_len
    check (decline_reason is null or char_length(decline_reason) between 1 and 500);
exception when duplicate_object then null;
end $$;

create unique index if not exists bookings_public_token_idx
  on public.bookings (public_token);

-- Return the public token so the request page can link to status tracking.
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
begin
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

  insert into public.bookings (
    venue_id, court_id, starts_at, ends_at, status,
    booked_by_name, contact_email, contact_phone, notes, source
  )
  values (
    p_venue_id, p_court_id, p_starts_at, p_ends_at, 'pending',
    p_booked_by_name, p_contact_email, p_contact_phone, p_notes, 'public'
  )
  returning public_token into v_token;

  return v_token;
end;
$$;

-- Anon-safe status lookup by token. No table grants required.
create or replace function public.get_booking_request_status(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select jsonb_build_object(
    'status', b.status,
    'declineReason', b.decline_reason,
    'bookedByName', b.booked_by_name,
    'startsAt', b.starts_at,
    'endsAt', b.ends_at,
    'venueName', v.name,
    'venueSlug', v.slug,
    'venueTimezone', v.timezone,
    'courtName', c.name
  )
  from public.bookings b
  join public.venues v on v.id = b.venue_id
  join public.courts c on c.id = b.court_id
  where b.public_token = p_token
    and b.source = 'public';
$$;

grant execute on function public.get_booking_request_status(uuid) to anon, authenticated;
