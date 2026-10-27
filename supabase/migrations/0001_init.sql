-- J4U 찬양팀 라인업 관리: 초기 스키마
-- Supabase SQL Editor에 그대로 붙여 넣거나 `supabase db push`로 적용합니다.

-- ---------------------------------------------------------------------------
-- Enum
-- ---------------------------------------------------------------------------
create type public.session_type as enum (
  'leader',       -- 인도자
  'sub_leader',   -- 서브 인도자(견습). 배정에서만 사용
  'vocal',        -- 보컬
  'main_keys',    -- 메인 건반
  'second_keys',  -- 세컨 건반
  'bass',         -- 베이스
  'electric',     -- 일렉
  'acoustic',     -- 어쿠스틱
  'drums'         -- 드럼
);

create type public.member_role as enum ('member', 'admin');
create type public.member_status as enum ('pending', 'approved', 'inactive');
create type public.round_status as enum ('open', 'closed');
create type public.event_type as enum ('weekend', 'retreat', 'special');
create type public.event_day_kind as enum ('practice', 'service');
create type public.lineup_status as enum ('draft', 'confirmed');

-- 주말 세트: both(토·일 가능) / sun_only(토 불가) / none(불가)
-- 비주말 일정: available(가능) / none(불가)
create type public.availability_status as enum ('both', 'sun_only', 'available', 'none');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.members (
  id uuid primary key references auth.users (id) on delete cascade,
  kakao_id text,
  name text not null,
  birth_date date,
  phone text,
  email text,
  district text,           -- 구
  dong text,               -- 동
  role public.member_role not null default 'member',
  status public.member_status not null default 'pending',
  privacy_agreed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.invite_codes (
  code text primary key,
  created_by uuid references public.members (id) on delete set null,
  expires_at timestamptz,
  max_uses int,
  used_count int not null default 0,
  created_at timestamptz not null default now()
);

create table public.member_sessions (
  member_id uuid not null references public.members (id) on delete cascade,
  session public.session_type not null,
  primary key (member_id, session)
);

-- 일정당 세션 정원 기본값. max가 null이면 제한 없음
create table public.session_rules (
  session public.session_type primary key,
  min int not null default 0,
  max int
);

insert into public.session_rules (session, min, max) values
  ('leader', 1, 1),
  ('sub_leader', 0, 1),
  ('vocal', 0, null),
  ('main_keys', 1, 1),
  ('second_keys', 1, 1),
  ('bass', 1, 1),
  ('electric', 0, 1),
  ('acoustic', 0, 1),
  ('drums', 1, 1);

create table public.availability_rounds (
  id uuid primary key default gen_random_uuid(),
  target_month date not null unique,  -- 그 달 1일 (예: 2026-12-01)
  opens_at timestamptz not null default now(),
  closes_at timestamptz,
  status public.round_status not null default 'open',
  created_at timestamptz not null default now(),
  check (extract(day from target_month) = 1)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  round_id uuid references public.availability_rounds (id) on delete cascade, -- 비주말 일정은 null
  type public.event_type not null,
  title text not null,
  note text,
  start_date date not null,
  end_date date not null,
  lineup_status public.lineup_status not null default 'draft',
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index events_start_date_idx on public.events (start_date);

create table public.event_days (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  date date not null,
  kind public.event_day_kind not null,
  start_time time
);
create index event_days_event_idx on public.event_days (event_id);

create table public.availabilities (
  member_id uuid not null references public.members (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  status public.availability_status not null,
  sessions public.session_type[] not null default '{}',
  comment text,
  updated_at timestamptz not null default now(),
  primary key (member_id, event_id)
);

create table public.lineup_assignments (
  event_id uuid not null references public.events (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  session public.session_type not null,
  sat_absent boolean not null default false,  -- 토 연습 불참(일요일만 섬김)
  primary key (event_id, member_id, session)
);

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.members
    where id = auth.uid() and role = 'admin' and status = 'approved'
  );
$$;

create or replace function public.is_approved() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.members where id = auth.uid() and status = 'approved'
  );
$$;

-- 응답을 받을 수 있는 일정인지: 라인업 미확정 + (비주말 일정이거나 회차가 열려 있고 마감 전)
create or replace function public.event_accepting_responses(p_event_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.events e
    left join public.availability_rounds r on r.id = e.round_id
    where e.id = p_event_id
      and e.lineup_status = 'draft'
      and (
        e.round_id is null
        or (r.status = 'open' and (r.closes_at is null or now() < r.closes_at))
      )
  );
$$;

-- 일반 팀원이 자기 role/status를 바꾸지 못하게 막음.
-- security invoker라 current_user가 실제 호출자다. SQL Editor(postgres)나
-- register_member/redeem_invite 같은 security definer 함수 안에서는 통과한다.
create or replace function public.protect_member_privileges() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and not public.is_admin() then
    new.role := old.role;
    new.status := old.status;
  end if;
  return new;
end;
$$;

create trigger members_protect_privileges
  before update on public.members
  for each row execute function public.protect_member_privileges();

-- 가입: 프로필 + 기본 세션 저장, 유효한 초대코드면 바로 approved
create or replace function public.register_member(
  p_name text,
  p_birth_date date,
  p_phone text,
  p_email text,
  p_district text,
  p_dong text,
  p_sessions public.session_type[],
  p_invite_code text default null
) returns public.member_status
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_kakao_id text;
  v_status public.member_status := 'pending';
  v_code text := nullif(upper(trim(coalesce(p_invite_code, ''))), '');
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if exists (select 1 from public.members where id = v_uid) then
    raise exception 'already registered';
  end if;

  select raw_user_meta_data ->> 'provider_id' into v_kakao_id
  from auth.users where id = v_uid;

  if v_code is not null then
    update public.invite_codes
       set used_count = used_count + 1
     where code = v_code
       and (expires_at is null or expires_at > now())
       and (max_uses is null or used_count < max_uses);
    if found then
      v_status := 'approved';
    else
      raise exception 'invalid invite code';
    end if;
  end if;

  insert into public.members (id, kakao_id, name, birth_date, phone, email, district, dong, status, privacy_agreed_at)
  values (v_uid, v_kakao_id, p_name, p_birth_date, p_phone, p_email, p_district, p_dong, v_status, now());

  insert into public.member_sessions (member_id, session)
  select v_uid, s from unnest(p_sessions) as s
  where s <> 'sub_leader'
  on conflict do nothing;

  return v_status;
end;
$$;

-- 승인 대기 중인 팀원이 나중에 초대코드를 입력하는 경우
create or replace function public.redeem_invite(p_code text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.members where id = auth.uid() and status = 'pending') then
    return false;
  end if;
  update public.invite_codes
     set used_count = used_count + 1
   where code = upper(trim(p_code))
     and (expires_at is null or expires_at > now())
     and (max_uses is null or used_count < max_uses);
  if not found then
    return false;
  end if;
  update public.members set status = 'approved' where id = auth.uid();
  return true;
end;
$$;

-- 다른 팀원에게는 이름만 공개 (연락처·생년월일은 members RLS로 본인/관리자만)
create or replace view public.member_directory as
  select id, name from public.members where status = 'approved';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.members enable row level security;
alter table public.invite_codes enable row level security;
alter table public.member_sessions enable row level security;
alter table public.session_rules enable row level security;
alter table public.availability_rounds enable row level security;
alter table public.events enable row level security;
alter table public.event_days enable row level security;
alter table public.availabilities enable row level security;
alter table public.lineup_assignments enable row level security;

-- members: 본인과 관리자만 조회/수정. 가입은 register_member()로만
create policy members_select on public.members for select
  using (id = auth.uid() or public.is_admin());
create policy members_update on public.members for update
  using (id = auth.uid() or public.is_admin());
create policy members_delete on public.members for delete
  using (id = auth.uid() or public.is_admin());

-- invite_codes: 관리자만
create policy invite_codes_admin on public.invite_codes for all
  using (public.is_admin()) with check (public.is_admin());

-- member_sessions: 승인된 팀원은 조회, 본인/관리자 수정
create policy member_sessions_select on public.member_sessions for select
  using (member_id = auth.uid() or public.is_approved());
create policy member_sessions_write on public.member_sessions for all
  using (member_id = auth.uid() or public.is_admin())
  with check (member_id = auth.uid() or public.is_admin());

-- session_rules: 로그인 사용자 조회, 관리자 수정
create policy session_rules_select on public.session_rules for select
  using (auth.uid() is not null);
create policy session_rules_admin on public.session_rules for all
  using (public.is_admin()) with check (public.is_admin());

-- 회차·일정: 승인된 팀원 조회, 관리자 수정
create policy rounds_select on public.availability_rounds for select
  using (public.is_approved());
create policy rounds_admin on public.availability_rounds for all
  using (public.is_admin()) with check (public.is_admin());

create policy events_select on public.events for select
  using (public.is_approved());
create policy events_admin on public.events for all
  using (public.is_admin()) with check (public.is_admin());

create policy event_days_select on public.event_days for select
  using (public.is_approved());
create policy event_days_admin on public.event_days for all
  using (public.is_admin()) with check (public.is_admin());

-- availabilities: 본인 응답은 마감 전까지 작성/수정, 관리자는 전체
create policy availabilities_select on public.availabilities for select
  using (member_id = auth.uid() or public.is_admin());
create policy availabilities_insert on public.availabilities for insert
  with check (
    (member_id = auth.uid() and public.is_approved() and public.event_accepting_responses(event_id))
    or public.is_admin()
  );
create policy availabilities_update on public.availabilities for update
  using (
    (member_id = auth.uid() and public.event_accepting_responses(event_id))
    or public.is_admin()
  );
create policy availabilities_delete on public.availabilities for delete
  using (public.is_admin());

-- lineup_assignments: 확정된 일정만 팀원에게 공개, 관리자는 전체
create policy lineup_select on public.lineup_assignments for select
  using (
    public.is_admin()
    or (
      public.is_approved()
      and exists (
        select 1 from public.events e
        where e.id = event_id and e.lineup_status = 'confirmed'
      )
    )
  );
create policy lineup_admin on public.lineup_assignments for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on public.member_directory from anon;
grant select on public.member_directory to authenticated;
grant execute on function public.register_member to authenticated;
grant execute on function public.redeem_invite to authenticated;
