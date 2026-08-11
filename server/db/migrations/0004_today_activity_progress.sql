alter table trips add column timezone text not null default 'UTC';

update trips
set timezone = 'Europe/Rome'
where title = 'Itália 2026';

create table activity_completions (
  activity_id uuid primary key references activities(id) on delete cascade,
  completed_by uuid not null references users(id) on delete cascade,
  completed_at timestamptz not null default now()
);

insert into activity_completions (activity_id, completed_by, completed_at)
select a.id, t.created_by, a.updated_at
from activities a
join trip_days td on td.id = a.trip_day_id
join trips t on t.id = td.trip_id
where a.status = 'completed'
on conflict do nothing;

create index activity_completions_completed_by_idx on activity_completions(completed_by);
