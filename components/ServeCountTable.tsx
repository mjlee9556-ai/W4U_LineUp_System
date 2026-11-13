import { SESSION_SHORT, SESSIONS, type Session } from "@/lib/sessions";

/**
 * 파트별·사람별 섬김 횟수 표. 칸은 "배정 횟수 / 가능한 주 수"
 * (가능한 주를 넘겨주지 않으면 횟수만)
 */
export function ServeCountTable({
  members,
  assignments,
  availableWeeks,
}: {
  members: { id: string; name: string }[];
  assignments: { member_id: string; session: Session }[];
  availableWeeks?: Map<string, number>; // `${memberId}:${session}` → 주 수
}) {
  const count = new Map<string, number>();
  for (const a of assignments) {
    const k = `${a.member_id}:${a.session}`;
    count.set(k, (count.get(k) ?? 0) + 1);
  }
  const has = (k: string) => (count.get(k) ?? 0) > 0 || (availableWeeks?.get(k) ?? 0) > 0;
  const sessions = SESSIONS.filter((s) => members.some((m) => has(`${m.id}:${s}`)));
  const rows = members
    .filter((m) => sessions.some((s) => has(`${m.id}:${s}`)))
    .map((m) => ({ ...m, total: sessions.reduce((n, s) => n + (count.get(`${m.id}:${s}`) ?? 0), 0) }));

  if (!rows.length) return <p className="text-sm text-stone-500">아직 응답이나 배정이 없어요.</p>;

  return (
    <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
      <table className="w-full text-center text-[13px]">
        <thead className="border-b border-stone-200 bg-stone-50 text-[11px] font-bold text-stone-500">
          <tr>
            <th className="whitespace-nowrap px-3 py-2.5 text-left">팀원 이름</th>
            {sessions.map((s) => (
              <th key={s} className="whitespace-nowrap px-2 py-2.5">{SESSION_SHORT[s]}</th>
            ))}
            <th className="whitespace-nowrap px-3 py-2.5 text-right text-stone-700">월간 합계</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {rows.map((m) => (
            <tr key={m.id}>
              <td className="whitespace-nowrap px-3 py-2.5 text-left">
                <span className="flex items-center gap-2 font-semibold text-ink-900">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-900 text-[10px] font-bold text-white">
                    {m.name.trim().slice(0, 1)}
                  </span>
                  {m.name}
                </span>
              </td>
              {sessions.map((s) => {
                const k = `${m.id}:${s}`;
                const n = count.get(k) ?? 0;
                const avail = availableWeeks?.get(k);
                if (!n && !avail) return <td key={s} className="px-2 py-2.5 text-stone-300">-</td>;
                return (
                  <td key={s} className="whitespace-nowrap px-2 py-2.5">
                    <span className={n ? "font-extrabold text-ink-900" : "text-stone-400"}>{n}</span>
                    {avail !== undefined && <span className="text-[11px] text-stone-400">/{avail}</span>}
                  </td>
                );
              })}
              <td className="whitespace-nowrap px-3 py-2.5 text-right font-extrabold text-ink-900">{m.total}회</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
