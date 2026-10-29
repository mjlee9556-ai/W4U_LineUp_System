// 앱이 처음 DB에 연결될 때 실행하는 스키마. 여러 번 실행해도 안전하게 if not exists로 쓴다.
export const SCHEMA_SQL = `
create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null unique,          -- 숫자만 저장 (로그인 아이디)
  pin_hash text not null,
  birth_date date,
  email text,
  district text,
  dong text,
  role text not null default 'member' check (role in ('member', 'admin')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'inactive')),
  privacy_agreed_at timestamptz,
  failed_logins int not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists auth_sessions (
  token_hash text primary key,
  member_id uuid not null references members (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists invite_codes (
  code text primary key,
  created_by uuid references members (id) on delete set null,
  expires_at timestamptz,
  max_uses int,
  used_count int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists member_sessions (
  member_id uuid not null references members (id) on delete cascade,
  session text not null,
  primary key (member_id, session)
);

create table if not exists availability_rounds (
  id uuid primary key default gen_random_uuid(),
  target_month date not null unique,    -- 그 달 1일
  opens_at timestamptz not null default now(),
  closes_at timestamptz,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  round_id uuid references availability_rounds (id) on delete cascade,  -- 비주말 일정은 null
  type text not null check (type in ('weekend', 'retreat', 'special')),
  title text not null,
  note text,
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  lineup_status text not null default 'draft' check (lineup_status in ('draft', 'confirmed')),
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists events_start_date_idx on events (start_date);

create table if not exists event_days (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  date date not null,
  kind text not null check (kind in ('practice', 'service')),
  start_time time
);
create index if not exists event_days_event_idx on event_days (event_id);

-- 주말: both(토·일 가능) / sun_only(토 불가) / none(불가), 비주말: available / none
create table if not exists availabilities (
  member_id uuid not null references members (id) on delete cascade,
  event_id uuid not null references events (id) on delete cascade,
  status text not null check (status in ('both', 'sun_only', 'available', 'none')),
  sessions text[] not null default '{}',
  comment text,
  updated_at timestamptz not null default now(),
  primary key (member_id, event_id)
);

create table if not exists lineup_assignments (
  event_id uuid not null references events (id) on delete cascade,
  member_id uuid not null references members (id) on delete cascade,
  session text not null,
  sat_absent boolean not null default false,
  primary key (event_id, member_id, session)
);

-- 팀원이 아닌 사람(게스트)을 이름만으로 라인업에 넣는다
create table if not exists lineup_guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  session text not null,
  name text not null
);
create index if not exists lineup_guests_event_idx on lineup_guests (event_id);

-- 주차별 콘티(곡 목록)
create table if not exists setlist_songs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  position int not null default 0,
  title text not null,
  youtube_url text,
  song_key text,          -- 키 (예: G, A→B)
  sheet_url text,         -- 악보 링크 (구글 드라이브 등)
  created_at timestamptz not null default now()
);
create index if not exists setlist_songs_event_idx on setlist_songs (event_id, position);

-- 곡에 올린 악보 파일 (사진·PDF). 따로 저장소 없이 DB에 둔다
create table if not exists sheet_files (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references setlist_songs (id) on delete cascade,
  filename text not null,
  content_type text not null,
  size int not null,
  data bytea not null,
  created_at timestamptz not null default now()
);
create index if not exists sheet_files_song_idx on sheet_files (song_id);

-- 관리자가 고치는 문구 (예: 성찬식 공지)
create table if not exists app_settings (
  key text primary key,
  value text not null
);
`;
