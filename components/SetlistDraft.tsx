"use client";

import { useRef, useState } from "react";
import { SongFields } from "@/components/SongFields";
import { SubmitButton } from "@/components/SubmitButton";

/** 콘티 작성 폼: 빈 곡 칸을 여러 개 미리 띄워 두고 한 번에 저장한다. 비워 둔 칸은 저장하지 않는다 */
export function SetlistDraft({
  eventId,
  initialRows,
  action,
}: {
  eventId: string;
  initialRows: number;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const nextKey = useRef(initialRows);
  const [rows, setRows] = useState(() => Array.from({ length: initialRows }, (_, i) => i));

  return (
    <form id="add-song" action={action} className="card mt-3 scroll-mt-4 space-y-3">
      <h3 className="text-sm font-semibold">곡 추가</h3>
      <input type="hidden" name="event_id" value={eventId} />
      <ol className="space-y-3">
        {rows.map((key, i) => (
          <li key={key} className="rounded-lg border border-stone-200 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-500">{i + 1}번째 곡</span>
              <button
                type="button"
                onClick={() => setRows((r) => r.filter((k) => k !== key))}
                className="px-1 text-xs text-stone-500 hover:text-red-700 hover:underline"
                aria-label={`${i + 1}번째 칸 삭제`}
              >
                칸 삭제
              </button>
            </div>
            <SongFields />
          </li>
        ))}
      </ol>
      <button type="button" onClick={() => {
          const key = nextKey.current++;
          setRows((r) => [...r, key]);
        }} className="btn-secondary w-full py-1.5">
        + 칸 추가
      </button>
      <p className="text-xs text-stone-500">
        비워 둔 칸은 저장하지 않아요. 악보 사진·PDF는 곡을 추가한 뒤 &apos;악보 올리기&apos;로 붙일 수 있어요 (파일 하나 4MB까지).
      </p>
      <SubmitButton pendingText="저장 중…">
        콘티에 추가
      </SubmitButton>
    </form>
  );
}
