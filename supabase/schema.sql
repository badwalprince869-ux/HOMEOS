-- Run this once in the Supabase SQL editor (Project -> SQL Editor -> New query -> Run)

create extension if not exists "pgcrypto";

-- One row per signed-up user, keyed to Supabase's built-in auth.users
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  contact text,
  city text,
  members text,
  created_at timestamptz default now()
);

create table appliances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  category text not null,
  brand text not null,
  model text,
  purchase_date date not null,
  warranty_months int default 12,
  note text,
  last_service_date date,
  created_at timestamptz default now()
);

create table service_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  appliance_id uuid references appliances(id) on delete cascade not null,
  date date not null,
  activity text not null,
  created_at timestamptz default now()
);

create table service_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  appliance_id uuid references appliances(id) on delete cascade not null,
  issue text,
  status text default 'Pending',
  created_at timestamptz default now()
);

-- Row Level Security: every user can only read/write their own rows
alter table profiles enable row level security;
alter table appliances enable row level security;
alter table service_history enable row level security;
alter table service_requests enable row level security;

-- Newer Supabase projects no longer expose public-schema tables to the
-- Data API by default, so these grants are required (harmless if already granted).
grant usage on schema public to authenticated, anon;
grant select, insert, update, delete on profiles to authenticated;
grant select, insert, update, delete on appliances to authenticated;
grant select, insert, update, delete on service_history to authenticated;
grant select, insert, update, delete on service_requests to authenticated;

create policy "own profile" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "own appliances" on appliances
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own service history" on service_history
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own requests" on service_requests
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
