insert into places (
  id, household_id, created_by, name, category, city, address,
  latitude, longitude, status
)
select
  source.id::uuid,
  hm.household_id,
  u.id,
  source.name,
  source.category,
  source.city,
  source.address,
  source.latitude,
  source.longitude,
  source.status
from users u
join household_members hm on hm.user_id = u.id and hm.role = 'organizer'
cross join (values
  ('137c1967-3970-4c83-a3cb-7248dcf98201', 'Roscioli', 'Restaurantes', 'Roma', 'Via dei Giubbonari, 21', 41.894220, 12.474260, 'planned'),
  ('137c1967-3970-4c83-a3cb-7248dcf98202', 'Terrazza del Gianicolo', 'Miradouros', 'Roma', 'Piazzale Giuseppe Garibaldi', 41.891477, 12.461389, 'saved'),
  ('137c1967-3970-4c83-a3cb-7248dcf98203', 'Torrefazione Cannaregio', 'Cafés', 'Veneza', 'Fondamenta dei Ormesini, 2804', 45.445747, 12.327710, 'saved'),
  ('137c1967-3970-4c83-a3cb-7248dcf98204', 'Peggy Guggenheim', 'Atrações', 'Veneza', 'Dorsoduro, 701', 45.430803, 12.331541, 'planned'),
  ('137c1967-3970-4c83-a3cb-7248dcf98205', 'Mercato di Rialto', 'Mercados', 'Veneza', 'Campo de la Pescaria', 45.439637, 12.334522, 'visited'),
  ('137c1967-3970-4c83-a3cb-7248dcf98206', 'Sant''Eustachio Il Caffè', 'Cafés', 'Roma', 'Piazza di S. Eustachio, 82', 41.898252, 12.475427, 'planned')
) as source(id, name, category, city, address, latitude, longitude, status)
where lower(u.display_name) = 'kauan'
on conflict (id) do nothing;
