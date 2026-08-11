create index checklist_groups_trip_owner_idx on checklist_groups(trip_id, owner_user_id, position);
create index checklist_items_group_position_idx on checklist_items(group_id, position);

with trip_context as (
  select t.id as trip_id, t.created_by as organizer_id
  from trips t
  where not exists (select 1 from checklist_groups cg where cg.trip_id = t.id)
), groups_to_insert as (
  select trip_id, organizer_id, group_key, title, owner_user_id, position
  from trip_context
  cross join lateral (
    values
      ('documents', 'Documentos importantes', null::uuid, 0),
      ('preparation', 'Preparação', null::uuid, 1),
      ('backpack', 'Mochila', organizer_id, 0),
      ('suitcase', 'Mala', organizer_id, 1)
  ) as seed(group_key, title, owner_user_id, position)
), inserted_groups as (
  insert into checklist_groups (id, trip_id, owner_user_id, title, position)
  select md5(trip_id::text || ':checklist-group:' || group_key)::uuid,
         trip_id, owner_user_id, title, position
  from groups_to_insert
  returning id, trip_id, title
), items_to_insert as (
  select id as group_id, trip_id, item_key, item_title, item_position
  from inserted_groups
  cross join lateral (
    select item_key, item_title, item_position
    from (values
      ('identity', 'Passaportes e cartões', 0),
      ('insurance', 'Seguro de viagem', 1),
      ('train-tickets', 'Bilhetes de comboio', 2),
      ('offline-bookings', 'Guardar reservas offline', 3)
    ) as documents(item_key, item_title, item_position)
    where inserted_groups.title = 'Documentos importantes'
    union all
    select item_key, item_title, item_position
    from (values
      ('flight-checkin', 'Fazer check-in do voo', 0),
      ('hotel-confirmation', 'Confirmar hospedagens', 1),
      ('offline-maps', 'Baixar mapas offline', 2),
      ('roaming', 'Verificar roaming dos telemóveis', 3)
    ) as preparation(item_key, item_title, item_position)
    where inserted_groups.title = 'Preparação'
    union all
    select item_key, item_title, item_position
    from (values
      ('charger', 'Carregador e cabo', 0),
      ('power-bank', 'Power bank', 1),
      ('headphones', 'Fones', 2),
      ('medication', 'Medicamentos pessoais', 3)
    ) as backpack(item_key, item_title, item_position)
    where inserted_groups.title = 'Mochila'
    union all
    select item_key, item_title, item_position
    from (values
      ('clothes', 'Roupa para 7 dias', 0),
      ('shoes', 'Sapatos confortáveis', 1),
      ('sleepwear', 'Pijama', 2),
      ('toiletries', 'Higiene pessoal', 3)
    ) as suitcase(item_key, item_title, item_position)
    where inserted_groups.title = 'Mala'
  ) seeded_items
)
insert into checklist_items (id, group_id, title, position)
select md5(trip_id::text || ':checklist-item:' || item_key)::uuid,
       group_id, item_title, item_position
from items_to_insert;
