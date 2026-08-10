create table households (
  id uuid primary key,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table users (
  id uuid primary key,
  display_name text not null,
  email text unique,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index users_display_name_lower_key on users (lower(display_name));

create table household_members (
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null check (role in ('organizer', 'traveler')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table sessions (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index sessions_user_id_idx on sessions(user_id);
create index sessions_expires_at_idx on sessions(expires_at);

create table trips (
  id uuid primary key,
  household_id uuid not null references households(id) on delete cascade,
  created_by uuid not null references users(id),
  title text not null,
  description text,
  start_date date not null,
  end_date date not null,
  base_currency char(3) not null default 'EUR',
  budget_amount numeric(12, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index trips_household_id_idx on trips(household_id);

create table trip_members (
  trip_id uuid not null references trips(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null check (role in ('organizer', 'traveler')),
  primary key (trip_id, user_id)
);

create table trip_days (
  id uuid primary key,
  trip_id uuid not null references trips(id) on delete cascade,
  day_date date not null,
  city text not null,
  position integer not null,
  unique (trip_id, day_date),
  unique (trip_id, position)
);

create table activities (
  id uuid primary key,
  trip_day_id uuid not null references trip_days(id) on delete cascade,
  title text not null,
  category text not null,
  starts_at timestamptz,
  ends_at timestamptz,
  address text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  notes text,
  estimated_cost numeric(12, 2),
  status text not null default 'planned' check (status in ('planned', 'current', 'completed', 'cancelled')),
  position integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trip_day_id, position)
);

create table places (
  id uuid primary key,
  household_id uuid not null references households(id) on delete cascade,
  created_by uuid not null references users(id),
  name text not null,
  category text not null,
  city text,
  address text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  maps_url text,
  status text not null default 'saved' check (status in ('saved', 'planned', 'visited')),
  created_at timestamptz not null default now()
);

create table documents (
  id uuid primary key,
  trip_id uuid not null references trips(id) on delete cascade,
  uploaded_by uuid not null references users(id),
  activity_id uuid references activities(id) on delete set null,
  title text not null,
  category text not null,
  booking_code text,
  status text not null default 'confirmed' check (status in ('draft', 'confirmed', 'attention', 'expired')),
  starts_at timestamptz,
  ends_at timestamptz,
  storage_path text not null,
  original_filename text not null,
  mime_type text not null,
  file_size bigint not null check (file_size >= 0),
  created_at timestamptz not null default now()
);

create table document_travelers (
  document_id uuid not null references documents(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  primary key (document_id, user_id)
);

create table checklist_groups (
  id uuid primary key,
  trip_id uuid not null references trips(id) on delete cascade,
  owner_user_id uuid references users(id) on delete cascade,
  title text not null,
  position integer not null
);

create table checklist_items (
  id uuid primary key,
  group_id uuid not null references checklist_groups(id) on delete cascade,
  title text not null,
  completed_by uuid references users(id) on delete set null,
  completed_at timestamptz,
  position integer not null,
  unique (group_id, position)
);

create table expenses (
  id uuid primary key,
  trip_id uuid not null references trips(id) on delete cascade,
  paid_by uuid not null references users(id),
  activity_id uuid references activities(id) on delete set null,
  title text not null,
  category text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  currency char(3) not null default 'EUR',
  spent_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table expense_splits (
  expense_id uuid not null references expenses(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  amount numeric(12, 2) not null check (amount >= 0),
  primary key (expense_id, user_id)
);
