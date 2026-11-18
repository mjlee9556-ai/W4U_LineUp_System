import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { getMemberNames, withDays } from "@/lib/queries";
import { buildBoardCells } from "@/lib/board";
import { formatMonth, isValidMonth, monthStart, parseISODate, shiftMonth, todayKST } from "@/lib/dates";
import { mainDate } from "@/lib/week";
import { hasSaturdayPractice, type Assignment, type Availability, type Guest, type LineupEvent, type Round } from "@/lib/types";
import { AppShell } from "@/components/AppShell";
import { LineupBoardGrid, type BoardWeek } from "@/components/LineupBoardGrid";
import { ChevronLeftIcon, ChevronRightIcon, InfoIcon, SparklesIcon, TableIcon } from "@/components/icons";

/** 기본으로 보여 줄 달: 아직 편성 중인 주가 남은 가장 가까운 회차(이번 달 이후), 없으면 이번 달 */
async function defaultMonth(): Promise<string> {
  const current = todayKST().slice(0, 7);
  const row = await queryOne<{ target_month: string }>(
    `select r.target_month from availability_rounds r
      where r.target_month >= $1
        and exists (select 1 from events e where e.round_id = r.id and e.lineup_status = 'draft')
      order by r.target_month limit 1`,
    [monthStart(current)],
  );
  return row ? row.target_month.slice(0, 7) : current;
}

export default async function LineupBoardPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { member } = await requireAdmin();
  const { month: wanted } = await searchParams;
  const month = isValidMonth(wanted) ? wanted : await defaultMonth();

  const round = await queryOne<Round>(`select * from availability_rounds where target_month = $1`, [monthStart(month)]);
  const events = round
    ? await query<LineupEvent>(`select * from events where round_id = $1 and type = 'weekend' order by start_date`, [round.id]).then(withDays)
    : [];
  const ids = events.map((e) => e.id);
  const [answers, assignments, guests] = ids.length
    ? await Promise.all([
        query<Availability>(`select * from availabilities where event_id = any($1::uuid[])`, [ids]),
        query<Assignment>(`select * from lineup_assignments where event_id = any($1::uuid[])`, [ids]),
        query<Guest>(`select * from lineup_guests where event_id = any($1::uuid[]) order by name`, [ids]),
      ])
    : [[], [], []];
  const names = await getMemberNames([...answers.map((a) => a.member_id), ...assignments.map((a) => a.member_id)]);

  const weeks: BoardWeek[] = events.map((e, i) => {
    const d = parseISODate(mainDate(e));
    return {
      id: e.id,
      label: `${i + 1}주`,
      date: `${d.getUTCMonth() + 1}/${d.getUTCDate()}`,
      practice: hasSaturdayPractice(e),
      confirmed: e.lineup_status === "confirmed",
      cells: buildBoardCells(e, answers, assignments, guests, names),
    };
  });
  const draftCount = weeks.filter((w) => !w.confirmed).length;

  return (
    <AppShell member={member} wide back={{ href: "/lineup", label: "라인업" }} title="월간 배정표">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/lineup/board?month=${shiftMonth(month, -1)}`}
            aria-label="이전 달"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-white hover:bg-stone-50"
          >
            <ChevronLeftIcon size={18} />
          </Link>
          <h1 className="flex items-center gap-1.5 text-[20px] font-extrabold tracking-tight text-ink-900">
            <TableIcon size={19} />
            {formatMonth(month)} 라인업
          </h1>
          <Link
            href={`/lineup/board?month=${shiftMonth(month, 1)}`}
            aria-label="다음 달"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-white hover:bg-stone-50"
          >
            <ChevronRightIcon size={18} />
          </Link>
        </div>

        {!round || weeks.length === 0 ? (
          <div className="panel py-10 text-center text-sm text-stone-500">
            {formatMonth(month)} 회차가 아직 없어요.
            <br />
            <Link href="/admin" className="mt-2 inline-block font-semibold text-ink-900 underline">
              관리 화면에서 회차 만들기
            </Link>
          </div>
        ) : (
          <>
            <section className="panel">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-stone-600">
                <span className="flex items-center gap-1.5">
                  <span className="rounded-md border border-dashed border-stone-200 bg-white px-1.5 py-0.5 font-medium text-stone-400">이름</span>
                  가능하다고 체크함
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="rounded-md border border-ink-200 bg-ink-50 px-1.5 py-0.5 font-extrabold text-ink-900">이름</span>
                  배정됨
                </span>
                <span>
                  <b className="text-red-600">토✕</b> 토 연습 불참
                </span>
                <span>오른쪽 작은 글씨: 그 주 다른 세션에 이미 배정</span>
              </div>
              <p className="mt-2 flex items-start gap-1.5 border-t border-stone-100 pt-2 text-xs leading-relaxed text-stone-500">
                <InfoIcon size={14} className="mt-0.5 shrink-0" />
                이름을 누르면 바로 배정되고, 다시 누르면 해제돼요. 저장 버튼은 없어요. 확정된 주는 잠겨 있어요. 서브 인도자·어쿠스틱·게스트는 주차를 눌러 수동 배정
                화면에서 넣어 주세요.
              </p>
              {draftCount > 0 && (
                <Link
                  href={`/admin/rounds/${round.id}#auto`}
                  className="mt-3 flex h-10 items-center justify-center gap-1.5 rounded-xl border border-stone-300 bg-white text-[13px] font-bold text-ink-900 hover:bg-stone-50"
                >
                  <SparklesIcon size={15} />
                  자동 배정으로 먼저 채우기
                </Link>
              )}
            </section>

            <section className="panel">
              <LineupBoardGrid weeks={weeks} />
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
