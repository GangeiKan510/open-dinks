-- Court bookings: staff-created reservations plus public booking requests.
--
-- A confirmed booking takes the court out of open play for its time window.
-- Pending rows are requests only and do NOT hold the slot, so two people can
-- request the same time; whichever staff confirm first wins and the other
-- confirmation is rejected by bookings_no_overlap.
--
-- Written idempotently because migrations are often pasted into the Supabase
-- SQL editor rather than applied through the CLI.

-- Needed for an exclusion constraint mixing equality (court_id) with a range.
create extension if not exists btree_gist;

do $$ begin
  create type public.booking_status as enum ('pending', 'confirmed', 'cancelledx');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.booking_payment_status as enum ('unpaid', 'paid', 'refunded');
exception when duplicate_object then null;
end $$;

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  court_id uuid not null references public.courts(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.booking_status not null default 'pending',
  booked_by_name text not null,
  contact_email text,
  contact_phone text,
  notes text,
  -- Minor currency units (cents). Nothing in this app stores booking price in
  -- dollars; do not divide/multiply by 100 anywhere but the display layer.
  price_cents int check (price_cents is null or price_cents >= 0),
  payment_status public.booking_payment_status not null default 'unpaid',
  -- 'public' rows arrive from the unauthenticated request page and start pending.
  source text not null default 'staff' check (source in ('staff', 'public')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_time_valid check (ends_at > starts_at),
  constraint bookings_name_len check (char_length(booked_by_name) between 1 and 120),
  constraint bookings_notes_len check (notes is null or char_length(notes) <= 1000)
);

create index if not exists bookings_venue_starts_idx
  on public.bookings (venue_id, starts_at);
create index if not exists bookings_court_starts_idx
  on public.bookings (court_id, starts_at);
create index if not exists bookings_venue_status_idx
  on public.bookings (venue_id, status);

-- Only confirmed bookings reserve the court, so only they may not overlap.
do $$ begin
  alter table public.bookings
    add constraint bookings_no_overlap
    exclude using gist (
      court_id with =,
      tstzrange(starts_at, ends_at) with &&
    ) where (status = 'confirmed');
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;

alter table public.bookings enable row level security;

grant select, insert, update, delete on public.bookings to authenticated;
-- anon deliberately gets no table grant; the public page goes through the
-- SECURITY DEFINER functions below so contact details are never readable.

drop policy if exists "Members manage bookings" on public.bookings;
create policy "Members manage bookings"
  on public.bookings for all to authenticated
  using (public.is_venue_member(venue_id))
  with check (public.is_venue_member(venue_id));

-- Public read surface: venue + court names only, no booking data.
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

-- Availability without leaking who booked it or how much they paid.
create or replace function public.get_court_busy_ranges(
  p_venue_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (court_id uuid, starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select b.court_id, b.starts_at, b.ends_at
  from public.bookings b
  where b.venue_id = p_venue_id
    and b.status = 'confirmed'
    and b.ends_at > p_from
    and b.starts_at < p_to
  order by b.starts_at;
$$;

-- Public request entry point. Always lands as 'pending' with no price, so an
-- unauthenticated caller can never self-confirm or set payment fields.
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
  v_id uuid;
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
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.get_public_booking_venue(text) to anon, authenticated;
grant execute on function public.get_court_busy_ranges(uuid, timestamptz, timestamptz) to anon, authenticated;
grant execute on function public.request_booking(uuid, uuid, timestamptz, timestamptz, text, text, text, text) to anon, authenticated;

-- Wallboard needs live updates when a booking is confirmed or cancelled.
do $$ begin
  alter publication supabase_realtime add table public.bookings;
exception when duplicate_object then null;
end $$;
