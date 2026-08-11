alter table activities add column source_key text;

create unique index activities_trip_day_source_key_key
  on activities (trip_day_id, source_key)
  where source_key is not null;

create table document_activities (
  document_id uuid not null references documents(id) on delete cascade,
  activity_id uuid not null references activities(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (document_id, activity_id)
);

insert into document_activities (document_id, activity_id)
select id, activity_id
from documents
where activity_id is not null
on conflict do nothing;

alter table documents drop column activity_id;

create index document_activities_activity_id_idx on document_activities(activity_id);
