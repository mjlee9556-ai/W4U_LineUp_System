# W4U_LineUp_System

J4U 찬양팀 라인업 관리 웹앱입니다. 팀원은 카카오로 로그인해 매달 가능일자를 내고, 관리자가 라인업을 확정하면 모두가 캘린더에서 날짜별로 누가 어느 세션인지 볼 수 있습니다.

- 화면: Next.js 15 (App Router) + Tailwind CSS 4
- DB·로그인: Supabase (Postgres + Auth의 Kakao 연동, RLS로 권한 관리)
- 배포: Vercel

## 화면

| 경로 | 사용자 | 내용 |
| --- | --- | --- |
| `/login` | 모두 | 카카오로 시작하기 |
| `/signup` | 처음 로그인한 사람 | 이름, 세션(복수), 생년월일, 전화, 이메일, 구·동, 개인정보 동의, 초대코드(선택) |
| `/pending` | 승인 대기 | 승인 대기 안내, 나중에 초대코드 입력 |
| `/availability` | 팀원 | 열린 회차의 주일마다 `토·일 가능 / 토 불가 / 불가`, 수련회·특별예배는 `가능 / 불가`. 세션은 기본 세션으로 채워지고 추가 가능, 메모 |
| `/calendar` | 팀원 | 월 캘린더. 확정된 일정은 세션별 이름, 내 섬김 날짜는 강조. 아래에 날짜별 라인업 목록(토 불참 표시 포함) |
| `/admin` | 관리자 | 수집 회차 열기(주말 세트 자동 생성), 수련회·특별예배 추가, 가입 승인, 초대코드 |
| `/admin/rounds/[id]` | 관리자 | 주일 × 세션 가능 인원표(정원 부족은 빨간색), 미제출자, 수집 마감/다시 열기 |
| `/admin/events/[id]` | 관리자 | 세션마다 가능자 중에서 선택, 정원 경고, 임시 저장 / 확정하고 공개 / 확정 풀기 |

라인업은 **확정된 일정만** 팀원에게 보입니다(RLS). 편성 중인 일정은 캘린더에 "편성 중"으로만 나옵니다.

## 처음 설정하기

### 1. Supabase

1. [supabase.com](https://supabase.com)에서 프로젝트를 만듭니다.
2. SQL Editor에 `supabase/migrations/0001_init.sql` 내용을 붙여 넣고 실행합니다.
3. Project Settings → API에서 URL과 anon key를 복사해 둡니다.

### 2. 카카오 로그인

1. [Kakao Developers](https://developers.kakao.com)에서 애플리케이션을 만듭니다.
2. 앱 키의 **REST API 키**, 보안 메뉴의 **Client Secret**(코드 생성 후 활성화)을 복사합니다.
3. 카카오 로그인을 활성화하고 Redirect URI에 `https://<프로젝트>.supabase.co/auth/v1/callback`을 넣습니다.
4. 동의항목에서 닉네임·프로필 사진을 켭니다. 이메일(account_email)은 비즈 앱이 아니면 필수로 받을 수 없으니 선택 동의로 둡니다.
5. Supabase → Authentication → Providers → Kakao를 켜고 REST API 키(Client ID)와 Client Secret을 넣습니다. 이메일을 선택 동의로 뒀다면 **Allow users without an email**도 켭니다.
6. Supabase → Authentication → URL Configuration의 Redirect URLs에 `http://localhost:3000/auth/callback`과 배포 주소의 `/auth/callback`을 추가합니다.

### 3. 로컬 실행

```bash
cp .env.example .env.local   # URL과 anon key 입력
npm install
npm run dev
```

### 4. 첫 관리자 지정

본인이 먼저 가입한 뒤 Supabase SQL Editor에서 실행합니다.

```sql
update public.members set role = 'admin', status = 'approved' where name = '본인 이름';
```

그 다음부터는 `/admin`에서 초대코드를 만들어 단톡방에 공유하거나 가입 신청을 승인하면 됩니다.

### 5. 배포

Vercel에서 이 저장소를 가져오고 환경 변수 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`를 넣습니다.

## 한 달 흐름

1. 20일경 관리자가 `/admin`에서 다음 달 회차를 열고 마감일을 정합니다. 그 달의 일요일마다 "토 연습 + 일 예배" 세트가 생깁니다.
2. `/availability` 링크를 단톡방에 공유합니다. 팀원은 마감 전까지 언제든 고칠 수 있습니다.
3. 마감 후 응답 현황에서 주일별로 편성 화면에 들어가 세션마다 사람을 고르고 **확정하고 공개**를 누릅니다. 토 불가로 응답한 사람은 자동으로 "토 불참"이 표시됩니다.
4. 팀원은 `/calendar`에서 확정된 라인업을 봅니다.

## 데이터 모델

`supabase/migrations/0001_init.sql`에 있습니다. 주말 세트와 수련회·특별예배를 모두 `events` 하나로 다루고, 그 단위로 응답(`availabilities`)과 배정(`lineup_assignments`)을 저장합니다.

- `members`: 연락처·생년월일은 본인과 관리자만 조회. 다른 팀원에게는 `member_directory` 뷰로 이름만 공개합니다(이 뷰는 의도적으로 RLS를 우회하므로 Supabase 린터가 경고를 띄웁니다).
- 팀원이 자기 `role`/`status`를 바꾸지 못하도록 트리거로 막습니다. 가입은 `register_member()`, 나중 초대코드 입력은 `redeem_invite()` 함수로만 합니다.
- 응답은 라인업이 확정되기 전, 회차가 열려 있고 마감 전일 때만 쓸 수 있습니다.

## 개발

```bash
npm run typecheck
npm run lint
npm test         # 날짜·라인업 계산 단위 테스트
npm run build
```
