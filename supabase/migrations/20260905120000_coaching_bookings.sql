-- Coaching: staff manage coaches (rate + weekly availability) and book
-- 1-hour coaching sessions against a coach's calendar.
--
-- Confirmed coaching_bookings exclusive-lock the coach for that window.
-- Court rentals are separate — a coaching session does not take a court
-- unless staff also create a court booking.

create table if not exists public.coaches (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  name text not null,
  -- Hourly rate in minor currency units (cents).
  rate_cents int not null default 0 check (rate_cents >= 0),
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coaches_name_len check (char_length(name) between 1 and 120),
  constraint coaches_notes_len check (notes is null or char_length(notes) <= 1000)
);

create index if not exists coaches_venue_active_idx
  on public.coaches (venue_id, active);

-- Weekly availability windows in venue-local wall-clock hours.
-- day_of_week: 0 = Sunday … 6 = Saturday (matches JS Date#getDay).
-- end_hour is exclusive (same convention as venue booking_close_hour).
create table if not exists public.coach_availability (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_hour smallint not null check (start_hour between 0 and 23),
  end_hour smallint not null check (end_hour between 1 and 24),
  created_at timestamptz not null default now(),
  constraint coach_availability_window check (end_hour > start_hour)
);

create index if not exists coach_availability_coach_idx
  on public.coach_availability (coach_id, day_of_week);

create table if not exists public.coaching_bookings (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  coach_id uuid not null references public.coaches(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.booking_status not null default 'confirmed',
  booked_by_name text not null,
  contact_email text,
  contact_phone text,
  notes text,
  -- Snapshot of the charged amount (usually coach rate × hours). Cents.
  price_cents int check (price_cents is null or price_cents >= 0),
  payment_status public.booking_payment_status not null default 'unpaid',
  source text not null default 'staff' check (source in ('staff', 'public')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Same token style as court bookings; avoids gen_random_bytes (pgcrypto
  -- schema / search_path quirks on some hosted projects).
  public_token uuid not null default gen_random_uuid(),
  constraint coaching_bookings_time_valid check (ends_at > starts_at),
  constraint coaching_bookings_name_len check (char_length(booked_by_name) between 1 and 120),
  constraint coaching_bookings_notes_len check (notes is null or char_length(notes) <= 1000)
);

create unique index if not exists coaching_bookings_public_token_uidx
  on public.coaching_bookings (public_token);

create index if not exists coaching_bookings_venue_starts_idx
  on public.coaching_bookings (venue_id, starts_at);

create index if not exists coaching_bookings_coach_starts_idx
  on public.coaching_bookings (coach_id, starts_at);

do $$ begin
  alter table public.coaching_bookings
    add constraint coaching_bookings_no_overlap
    exclude using gist (
      coach_id with =,
      tstzrange(starts_at, ends_at) with &&
    ) where (status = 'confirmed');
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;

alter table public.coaches enable row level security;
alter table public.coach_availability enable row level security;
alter table public.coaching_bookings enable row level security;

grant select, insert, update, delete on public.coaches to authenticated;
grant select, insert, update, delete on public.coach_availability to authenticated;
grant select, insert, update, delete on public.coaching_bookings to authenticated;

drop policy if exists "Members manage coaches" on public.coaches;
create policy "Members manage coaches"
  on public.coaches for all to authenticated
  using (public.is_venue_member(venue_id))
  with check (public.is_venue_member(venue_id));

drop policy if exists "Members manage coach availability" on public.coach_availability;
create policy "Members manage coach availability"
  on public.coach_availability for all to authenticated
  using (
    exists (
      select 1 from public.coaches c
      where c.id = coach_id and public.is_venue_member(c.venue_id)
    )
  )
  with check (
    exists (
      select 1 from public.coaches c
      where c.id = coach_id and public.is_venue_member(c.venue_id)
    )
  );

drop policy if exists "Members manage coaching bookings" on public.coaching_bookings;
create policy "Members manage coaching bookings"
  on public.coaching_bookings for all to authenticated
  using (public.is_venue_member(venue_id))
  with check (public.is_venue_member(venue_id));
