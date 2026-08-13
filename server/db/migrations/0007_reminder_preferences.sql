create table user_reminder_preferences (
  user_id uuid primary key references users(id) on delete cascade,
  enabled boolean not null default false,
  default_lead_minutes integer not null default 30
    check (default_lead_minutes in (15, 30, 60, 1440)),
  updated_at timestamptz not null default now()
);
