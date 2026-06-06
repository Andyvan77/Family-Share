-- ============================================================
-- FamilyShare — Supabase Schema
-- Run this in the Supabase SQL Editor (Database → SQL Editor)
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Families ─────────────────────────────────────────────────
create table public.families (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  color       text not null default '#7c3aed',   -- CSS hex, family's theme colour
  avatar_url  text,                               -- Supabase Storage path
  banner_url  text,
  created_at  timestamptz default now()
);

-- ── Profiles (extends auth.users 1-to-1) ─────────────────────
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  family_id   uuid references public.families(id) on delete set null,
  display_name text,
  role        text not null default 'member',    -- 'member' | 'admin'
  avatar_url  text,
  created_at  timestamptz default now()
);

-- Auto-create profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Asset categories ──────────────────────────────────────────
create table public.categories (
  id    uuid primary key default uuid_generate_v4(),
  name  text not null unique,   -- e.g. 'Console', 'Board Game', 'Bicycle'
  icon  text default '📦'
);

insert into public.categories (name, icon) values
  ('Console',     '🎮'),
  ('Game',        '🕹️'),
  ('Board Game',  '♟️'),
  ('Book',        '📚'),
  ('Bicycle',     '🚲'),
  ('Camera',      '📷'),
  ('Tool',        '🔧'),
  ('Other',       '📦');

-- ── Assets ───────────────────────────────────────────────────
create table public.assets (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  description     text,
  category_id     uuid references public.categories(id),
  photo_url       text,
  owner_family_id uuid references public.families(id) on delete set null,
  max_booking_days int not null default 7,        -- max consecutive days any family can book
  is_active       boolean not null default true,
  created_by      uuid references auth.users(id),
  created_at      timestamptz default now()
);

-- ── Bookings ─────────────────────────────────────────────────
create table public.bookings (
  id          uuid primary key default uuid_generate_v4(),
  asset_id    uuid not null references public.assets(id) on delete cascade,
  family_id   uuid not null references public.families(id) on delete cascade,
  booked_by   uuid references auth.users(id),
  start_date  date not null,
  end_date    date not null,
  status      text not null default 'confirmed',  -- 'confirmed' | 'active' | 'returned' | 'cancelled'
  notes       text,
  created_at  timestamptz default now(),
  constraint no_backwards_dates check (end_date >= start_date)
);

-- Index for fast overlap queries
create index bookings_asset_dates on public.bookings (asset_id, start_date, end_date);

-- Function to check for booking overlaps
create or replace function public.booking_overlaps(
  p_asset_id uuid,
  p_start    date,
  p_end      date,
  p_exclude_id uuid default null
) returns boolean language sql security definer as $$
  select exists (
    select 1 from public.bookings
    where asset_id = p_asset_id
      and status not in ('cancelled', 'returned')
      and (id != p_exclude_id or p_exclude_id is null)
      and (start_date, end_date + interval '1 day')
          overlaps (p_start, p_end + interval '1 day')
  );
$$;

-- ── Asset custody (who physically has it right now) ───────────
create table public.asset_custody (
  id          uuid primary key default uuid_generate_v4(),
  asset_id    uuid not null references public.assets(id) on delete cascade,
  booking_id  uuid references public.bookings(id),
  family_id   uuid not null references public.families(id),
  collected_at timestamptz default now(),
  returned_at  timestamptz,
  notes        text
);

-- ── Comments (per booking) ────────────────────────────────────
create table public.comments (
  id         uuid primary key default uuid_generate_v4(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  author_id  uuid references auth.users(id),
  body       text not null,
  created_at timestamptz default now()
);

-- ── Notifications ─────────────────────────────────────────────
create table public.notifications (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid references auth.users(id) on delete cascade,
  family_id  uuid references public.families(id),
  type       text,     -- 'booking_made' | 'booking_due' | 'item_returned' | 'new_asset'
  title      text,
  body       text,
  read       boolean default false,
  link       text,     -- hash route to navigate to
  created_at timestamptz default now()
);

-- ── Row Level Security ────────────────────────────────────────
alter table public.families       enable row level security;
alter table public.profiles       enable row level security;
alter table public.categories     enable row level security;
alter table public.assets         enable row level security;
alter table public.bookings       enable row level security;
alter table public.asset_custody  enable row level security;
alter table public.comments       enable row level security;
alter table public.notifications  enable row level security;

-- Helper: get caller's family_id
create or replace function public.my_family_id()
returns uuid language sql security definer stable as $$
  select family_id from public.profiles where id = auth.uid();
$$;

-- Helper: is caller an admin?
create or replace function public.is_admin()
returns boolean language sql security definer stable as $$
  select role = 'admin' from public.profiles where id = auth.uid();
$$;

-- Families: everyone can read; only admin can insert/update
create policy "families_read"   on public.families for select using (true);
create policy "families_insert" on public.families for insert with check (public.is_admin() or auth.uid() is not null);
create policy "families_update" on public.families for update using (public.is_admin() or id = public.my_family_id());

-- Profiles: read all; update own
create policy "profiles_read"   on public.profiles for select using (true);
create policy "profiles_update" on public.profiles for update using (id = auth.uid());
create policy "profiles_insert" on public.profiles for insert with check (id = auth.uid());

-- Categories: read-only for all
create policy "categories_read" on public.categories for select using (true);

-- Assets: read all; insert/update if authenticated
create policy "assets_read"   on public.assets for select using (true);
create policy "assets_insert" on public.assets for insert with check (auth.uid() is not null);
create policy "assets_update" on public.assets for update using (
  created_by = auth.uid() or owner_family_id = public.my_family_id() or public.is_admin()
);

-- Bookings: read all; write own family's
create policy "bookings_read"   on public.bookings for select using (true);
create policy "bookings_insert" on public.bookings for insert with check (family_id = public.my_family_id());
create policy "bookings_update" on public.bookings for update using (
  family_id = public.my_family_id() or public.is_admin()
);

-- Custody: read all; write own family's
create policy "custody_read"   on public.asset_custody for select using (true);
create policy "custody_insert" on public.asset_custody for insert with check (family_id = public.my_family_id());
create policy "custody_update" on public.asset_custody for update using (family_id = public.my_family_id());

-- Comments: read all; write own
create policy "comments_read"   on public.comments for select using (true);
create policy "comments_insert" on public.comments for insert with check (author_id = auth.uid());
create policy "comments_delete" on public.comments for delete using (author_id = auth.uid());

-- Notifications: read/update own
create policy "notif_read"   on public.notifications for select using (user_id = auth.uid() or family_id = public.my_family_id());
create policy "notif_update" on public.notifications for update using (user_id = auth.uid());
create policy "notif_insert" on public.notifications for insert with check (auth.uid() is not null);

-- ── Realtime ──────────────────────────────────────────────────
-- Enable realtime on these tables (also set in Supabase dashboard → Database → Replication)
alter publication supabase_realtime add table public.bookings;
alter publication supabase_realtime add table public.asset_custody;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.assets;
cd "C:\Users\User\Documents\Claude\Projects\Nintendo rental system"
git init
git add .
git commit -m "initial commit"
