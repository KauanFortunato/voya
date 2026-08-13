alter table activities
  add column is_important boolean not null default false;

create index activities_important_idx
  on activities (trip_day_id, starts_at)
  where is_important;
