alter table activities
  add column reminder_lead_minutes integer
    check (reminder_lead_minutes in (15, 30, 60, 1440));

create table activity_reminder_recipients (
  activity_id uuid not null references activities(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (activity_id, user_id)
);

create index activity_reminder_recipients_user_idx
  on activity_reminder_recipients (user_id);
