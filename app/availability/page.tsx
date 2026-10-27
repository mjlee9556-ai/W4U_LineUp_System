import { requireMember } from "@/lib/auth";
import { getOpenEvents } from "@/lib/queries";
import { formatMonth, formatShort } from "@/lib/dates";
import { SESSION_LABELS, SESSIONS, type Session } from "@/lib/sessions";
import { EVENT_TYPE_LABELS, statusOptionsFor, type Availability } from "@/lib/types";
import { AppShell } from "@/components/AppShell";
import { Notice } from "@/components/Notice";
import { SubmitButton } from "@/components/SubmitButton";
import { saveAvailability } from "./actions";

const ERRORS: Record<string, string> = {
  empty: "응답을 하나 이상 골라 주세요.",
  save: "저장하지 못했어요. 마감됐거나 라인업이 이미 확정된 일정이 있을 수 있어요.",
};

export default async function AvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { supabase, member, sessions: mySessions } = await requireMember();
  const { saved, error } = await searchParams;
  const { rounds, events } = await getOpenEvents(supabase);

  const { data: answers } = events.length
    ? await supabase
        .from("availabilities")
        .select("*")
        .eq("member_id", member.id)
        .in("event_id", events.map((e) => e.id))
    : { data: [] };
  const answerByEvent = new Map((answers as Availability[]).map((a) => [a.event_id, a]));

  // 기본 세션이 아닌 것도 추가로 고를 수 있게 전체 목록을 보여준다(서브 인도자 제외)
  const selectable = SESSIONS.filter((s) => s !== "sub_leader");

  return (
    <AppShell member={member}>
      <h1 className="text-xl font-bold">가능일자 제출</h1>
      <p className="mt-1 text-sm text-stone-600">
        {rounds.length
          ? rounds
              .map((r) => `${formatMonth(r.target_month.slice(0, 7))}${r.closes_at ? ` · ${formatShort(r.closes_at.slice(0, 10))} 마감` : ""}`)
              .join(", ")
          : "지금 받고 있는 수집 회차가 없어요."}
      </p>

      <div className="mt-4">
        <Notice message={saved ? "저장했어요. 마감 전까지 언제든 고칠 수 있어요." : undefined} />
        <Notice tone="error" message={error ? ERRORS[error] : undefined} />
      </div>

      {events.length > 0 && (
        <form action={saveAvailability} className="space-y-3">
          {events.map((event) => {
            const answer = answerByEvent.get(event.id);
            const chosen = new Set<Session>(answer && answer.status !== "none" ? answer.sessions : mySessions);
            const days = event.event_days ?? [];
            return (
              <section key={event.id} className="card">
                <input type="hidden" name="event_id" value={event.id} />
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="font-semibold">
                    {event.type === "weekend" ? formatShort(event.end_date) : event.title}
                  </h2>
                  <span className="text-xs text-stone-500">
                    {event.type === "weekend"
                      ? `토 ${formatShort(event.start_date)} 연습`
                      : `${EVENT_TYPE_LABELS[event.type]} · ${days.map((d) => formatShort(d.date)).join(", ")}`}
                  </span>
                </div>
                {event.note && <p className="mt-1 text-xs text-stone-500">{event.note}</p>}

                <div className="mt-3 flex flex-wrap gap-2">
                  {statusOptionsFor(event.type).map((opt) => (
                    <label key={opt.value}>
                      <input
                        type="radio"
                        name={`status_${event.id}`}
                        value={opt.value}
                        defaultChecked={answer?.status === opt.value}
                        className="peer sr-only"
                      />
                      <span className="chip">{opt.label}</span>
                    </label>
                  ))}
                </div>

                <details className="mt-3" open={!answer}>
                  <summary className="cursor-pointer text-xs text-stone-500">
                    섬길 세션: {[...chosen].map((s) => SESSION_LABELS[s]).join(", ") || "없음"}
                  </summary>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selectable.map((s) => (
                      <label key={s}>
                        <input
                          type="checkbox"
                          name={`sessions_${event.id}`}
                          value={s}
                          defaultChecked={chosen.has(s)}
                          className="peer sr-only"
                        />
                        <span className="chip px-2.5 py-1 text-xs">{SESSION_LABELS[s]}</span>
                      </label>
                    ))}
                  </div>
                  <input
                    name={`comment_${event.id}`}
                    defaultValue={answer?.comment ?? ""}
                    placeholder="메모 (예: 예배 후 바로 이동해야 해요)"
                    maxLength={200}
                    className="input mt-2"
                  />
                </details>
              </section>
            );
          })}
          <div className="sticky bottom-4">
            <SubmitButton className="btn-primary w-full py-3 shadow-lg">제출하기</SubmitButton>
          </div>
        </form>
      )}
    </AppShell>
  );
}
