create table reminder_jobs (
  id uuid primary key,
  activity_id uuid not null references activities(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  delivery_key text not null unique,
  lead_minutes integer not null check (lead_minutes in (15, 30, 60, 1440)),
  scheduled_for timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'processing', 'sent', 'cancelled', 'failed')),
  attempt_count integer not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index reminder_jobs_active_recipient_idx
  on reminder_jobs (activity_id, user_id)
  where status in ('scheduled', 'processing');

create index reminder_jobs_due_idx
  on reminder_jobs (scheduled_for)
  where status = 'scheduled';
