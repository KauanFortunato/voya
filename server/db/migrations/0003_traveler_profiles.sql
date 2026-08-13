create table traveler_profiles (
  user_id uuid primary key references users(id) on delete cascade,
  travel_pace text not null default 'balanced'
    check (travel_pace in ('relaxed', 'balanced', 'intense')),
  interests text[] not null default array[]::text[],
  dietary_notes text not null default '',
  accessibility_notes text not null default '',
  emergency_contact_name text not null default '',
  emergency_contact_phone text not null default '',
  notes text not null default '',
  updated_at timestamptz not null default now()
);
