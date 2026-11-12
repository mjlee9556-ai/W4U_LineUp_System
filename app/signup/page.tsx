import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentMember } from "@/lib/auth";
import { SIGNUP_SESSIONS } from "@/lib/sessions";
import { PIN_PATTERN } from "@/lib/pin";
import { Notice } from "@/components/Notice";
import { SessionPicker } from "@/components/SessionPicker";
import { SignupPhoneField } from "@/components/SignupPhoneField";
import { SubmitButton } from "@/components/SubmitButton";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ChurchIcon,
  IdCardIcon,
  ListMusicIcon,
  MapPinIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  UserIcon,
} from "@/components/icons";
import { register } from "./actions";

const Req = () => <span className="text-accent-600"> *</span>;

function Section({
  icon,
  title,
  sub,
  aside,
  children,
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  sub?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="panel relative">
      <div className="mb-4 flex items-start justify-between gap-3 border-b border-stone-100 pb-3">
        <div>
          <h2 className="flex items-center gap-2 text-[15px] font-bold text-stone-900">
            <span className="text-stone-700">{icon}</span>
            {title}
          </h2>
          {sub && <p className="mt-0.5 text-xs text-stone-500">{sub}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string; code?: string }> }) {
  const { member } = await getCurrentMember();
  if (member) redirect(member.status === "approved" ? "/calendar" : "/pending");
  const { error, code } = await searchParams;
  const inviteCode = (code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);

  return (
    <div className="min-h-dvh bg-white">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto grid h-14 max-w-md grid-cols-[2.5rem_1fr_2.5rem] items-center px-4">
          <Link href="/login" aria-label="뒤로" className="-ml-1 p-1 text-stone-900">
            <ArrowLeftIcon size={22} />
          </Link>
          <span className="flex items-center justify-center gap-1.5 text-lg font-extrabold tracking-tight text-navy-900">
            <ChurchIcon size={20} />
            J4U Worship
          </span>
          <Link href="/login" className="justify-self-end whitespace-nowrap text-sm font-medium text-stone-800">
            로그인
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pb-8 pt-6">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-600" />
          신규 사역자 등록 · 찬양팀 사역
        </span>
        <h1 className="mt-4 text-[26px] font-extrabold tracking-tight text-stone-900">팀원 가입</h1>
        <p className="mt-1 text-sm text-stone-600">기본 세션은 매달 가능일자를 낼 때 자동으로 채워져요.</p>

        <div className="mt-5">
          <Notice tone="error" message={error} />
        </div>

        <form action={register} className="space-y-4">
          <Section
            icon={<UserIcon />}
            title="기본 인적 정보"
            aside={<span className="shrink-0 rounded-md bg-accent-50 px-2 py-0.5 text-xs font-semibold text-accent-600">필수 입력</span>}
          >
            <div className="space-y-4">
              <div>
                <label className="field-label" htmlFor="name">이름<Req /></label>
                <input id="name" name="name" required placeholder="실명을 입력해주세요 (예: 김찬양)" className="field" />
              </div>

              <div>
                <label className="field-label" htmlFor="phone">전화번호 (로그인 아이디, - 없이 숫자만)<Req /></label>
                <SignupPhoneField />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label className="field-label" htmlFor="pin">PIN 정하기<Req /></label>
                  <input id="pin" name="pin" type="password" inputMode="numeric" required pattern={PIN_PATTERN} placeholder="숫자 4~6자리" autoComplete="new-password" className="field text-center" />
                </div>
                <div className="min-w-0">
                  <label className="field-label" htmlFor="pin_confirm">PIN 확인<Req /></label>
                  <input id="pin_confirm" name="pin_confirm" type="password" inputMode="numeric" required pattern={PIN_PATTERN} placeholder="숫자 4~6자리" autoComplete="new-password" className="field text-center" />
                </div>
              </div>
            </div>
          </Section>

          <Section
            icon={<ListMusicIcon />}
            title={<>세션 (여러 개 선택 가능)<Req /></>}
            sub="사역 가능한 모든 세션을 선택해 주세요."
          >
            <SessionPicker sessions={SIGNUP_SESSIONS} />
          </Section>

          <Section
            icon={<IdCardIcon />}
            title="상세 사역자 프로필"
            aside={<span className="shrink-0 text-xs text-stone-400">필수 및 선택</span>}
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label className="field-label" htmlFor="birth_date">생년월일<Req /></label>
                  <input id="birth_date" name="birth_date" type="date" required className="field px-3" />
                </div>
                <div className="min-w-0">
                  <label className="field-label" htmlFor="email">이메일 <span className="font-normal text-stone-500">(선택)</span></label>
                  <input id="email" name="email" type="email" placeholder="example@email.com" className="field px-3" />
                </div>
              </div>

              <div>
                <div className="flex items-baseline justify-between">
                  <label className="field-label" htmlFor="address">거주지 (시·구·동까지)<Req /></label>
                  <span className="text-xs text-stone-500">카풀 배려 참고용</span>
                </div>
                <div className="relative">
                  <MapPinIcon size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input id="address" name="address" required maxLength={40} placeholder="예: 수원시 장안구 조원동" className="field pl-10" />
                </div>
                <p className="mt-2 flex items-center gap-1 text-xs font-medium text-stone-700">
                  <ShieldAlertIcon size={14} className="text-accent-600" />
                  번지나 아파트 이름 같은 상세 주소는 적지 않아요.
                </p>
              </div>

              <div>
                <div className="flex items-baseline justify-between">
                  <label className="field-label" htmlFor="invite_code">초대코드 <span className="font-normal text-stone-500">(선택)</span></label>
                  <span className="text-xs font-semibold text-accent-600">인도자/총무 지급</span>
                </div>
                <input id="invite_code" name="invite_code" defaultValue={inviteCode} placeholder="없으면 관리자 승인 후 이용" className="field uppercase placeholder:normal-case" autoComplete="off" />
                <p className="mt-2 text-xs leading-relaxed text-stone-500">
                  초대코드가 없더라도 가입 신청 후 찬양팀 디렉터 확인을 거쳐 승인됩니다.
                </p>
              </div>
            </div>
          </Section>

          <label className="flex cursor-pointer gap-3 rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <input type="checkbox" name="privacy" required className="mt-0.5 h-5 w-5 shrink-0 accent-navy-900" />
            <span className="text-[13px] leading-relaxed text-stone-700">
              <span className="mb-1 flex items-center gap-1 font-bold text-stone-900">
                <ShieldCheckIcon size={15} className="text-accent-600" />
                개인정보 수집 및 사역 공유 동의 <span className="text-accent-600">(필수)</span>
              </span>
              라인업 편성과 연락을 위해 이름, 세션, 생년월일, 전화번호, 이메일(선택), 거주지(시·구·동)를 수집합니다.{" "}
              <strong className="font-semibold text-stone-900">
                연락처와 생년월일은 본인과 관리자만 볼 수 있고, 다른 팀원에게는 이름과 세션만 보입니다.
              </strong>{" "}
              탈퇴하거나 활동을 마치면 즉시 파기 및 삭제합니다. 이에 동의합니다.
            </span>
          </label>

          <SubmitButton
            className="mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-navy-900 text-base font-bold text-white shadow-sm transition hover:bg-navy-800 disabled:opacity-60"
            pendingText="가입 중…"
          >
            가입하기 <ArrowRightIcon size={20} />
          </SubmitButton>
        </form>

        <p className="mt-5 text-center text-sm text-stone-600">
          이미 가입했나요?{" "}
          <Link href="/login" className="font-bold text-stone-900 underline underline-offset-2">로그인</Link>
        </p>
      </main>

      <footer className="border-t border-stone-200 py-6 text-center text-xs text-stone-500">
        J4U Worship 찬양팀 전용 관리 시스템 · 문의: 찬양사역위원회
      </footer>
    </div>
  );
}
