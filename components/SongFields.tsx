"use client";

import { useRef, useState, useTransition } from "react";
import { lookupYoutube } from "@/app/events/[id]/actions";
import { chordsIn, importChart } from "@/lib/chords";

export type SongDefaults = {
  title?: string;
  youtube_url?: string | null;
  song_key?: string | null;
  sheet_url?: string | null;
  song_form?: string | null;
  memo?: string | null;
  chord_chart?: string | null;
};

/** 곡 입력칸: 유튜브 링크를 새로 넣거나 바꾸면 그 영상 제목으로 곡 제목을 채운다. 채운 제목은 고칠 수 있다 */
export function SongFields({ defaults }: { defaults?: SongDefaults }) {
  const titleRef = useRef<HTMLInputElement>(null);
  const lastUrl = useRef(defaults?.youtube_url ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const keyRef = useRef<HTMLInputElement>(null);
  const chartRef = useRef<HTMLTextAreaElement>(null);
  const [chartStatus, setChartStatus] = useState<string | null>(null);

  /** 붙여 넣은 코드 악보를 정리하고, 키·제목 칸이 비어 있으면 채운다 */
  function importText(raw: string) {
    const r = importChart(raw);
    if (chartRef.current) chartRef.current.value = r.chart;
    if (!r.chart) return setChartStatus(null);
    const notes: string[] = [];
    const count = chordsIn(r.chart).length;
    notes.push(count ? `코드 ${count}개를 읽었어요.` : "코드를 찾지 못했어요. 코드 줄이 가사 줄과 따로 있거나 [G]처럼 적혀 있어야 해요.");
    if (r.key && keyRef.current && !keyRef.current.value.trim()) {
      keyRef.current.value = r.key;
      notes.push(r.keyGuessed ? `키는 첫 코드로 ${r.key}(으)로 짐작했어요. 다르면 고쳐 주세요.` : `키 ${r.key}을(를) 채웠어요.`);
    }
    if (r.title && titleRef.current && !titleRef.current.value.trim()) titleRef.current.value = r.title;
    setChartStatus(notes.join(" "));
  }

  function lookup(value: string) {
    const url = value.trim();
    if (!url || url === lastUrl.current) return;
    lastUrl.current = url;
    start(async () => {
      const { url: normalized, title } = await lookupYoutube(url);
      if (lastUrl.current !== url) return; // 그 사이 다른 링크로 바뀜
      if (!normalized) return setStatus("유튜브 링크가 아닌 것 같아요.");
      if (!title) return setStatus("제목을 가져오지 못했어요. 직접 입력해 주세요.");
      if (titleRef.current) titleRef.current.value = title;
      setStatus("영상 제목으로 바꿨어요. 필요하면 고쳐 주세요.");
    });
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <input
          name="youtube_url"
          type="url"
          inputMode="url"
          defaultValue={defaults?.youtube_url ?? ""}
          placeholder="유튜브 링크 (붙여 넣으면 제목을 가져와요)"
          aria-label="유튜브 링크"
          onBlur={(e) => lookup(e.currentTarget.value)}
          onPaste={(e) => lookup(e.clipboardData.getData("text"))}
          className="input"
        />
        {(pending || status) && <p className="mt-1 text-xs text-stone-500">{pending ? "제목 가져오는 중…" : status}</p>}
      </div>
      <input
        ref={titleRef}
        name="title"
        defaultValue={defaults?.title ?? ""}
        placeholder="곡 제목"
        aria-label="곡 제목"
        maxLength={200}
        className="input sm:col-span-2"
      />
      <input ref={keyRef} name="song_key" defaultValue={defaults?.song_key ?? ""} placeholder="키 (예: G)" aria-label="키" maxLength={20} className="input" />
      <input
        name="sheet_url"
        defaultValue={defaults?.sheet_url ?? ""}
        placeholder="악보 링크 (선택)"
        aria-label="악보 링크"
        className="input"
      />
      <input
        name="song_form"
        defaultValue={defaults?.song_form ?? ""}
        placeholder="송폼 (예: I V1 C V2 C B C)"
        aria-label="송폼"
        maxLength={200}
        className="input sm:col-span-2"
      />
      <textarea
        name="memo"
        defaultValue={defaults?.memo ?? ""}
        placeholder="메모 (선택)"
        aria-label="메모"
        maxLength={1000}
        rows={2}
        className="input sm:col-span-2"
      />
      <details className="sm:col-span-2" open={!!defaults?.chord_chart}>
        <summary className="cursor-pointer text-xs font-semibold text-stone-600">코드 악보 붙여넣기 (선택, 화면에서 키를 바꿔 볼 수 있어요)</summary>
        <textarea
          ref={chartRef}
          name="chord_chart"
          defaultValue={defaults?.chord_chart ?? ""}
          placeholder={"코드 악보를 그대로 붙여 넣으세요. 예)\nG        D/F#      Em\n주님의 사랑 놀라워\n\n또는 [G]주님의 [D/F#]사랑"}
          aria-label="코드 악보"
          rows={8}
          wrap="off"
          spellCheck={false}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData("text");
            const el = e.currentTarget;
            // 빈 칸에 붙여 넣을 때만 통째로 정리한다 (고치는 중에는 손대지 않음)
            if (el.value.trim()) return;
            e.preventDefault();
            importText(pasted);
          }}
          onBlur={(e) => importText(e.currentTarget.value)}
          className="input mt-2 font-mono text-xs leading-5"
        />
        <label className="mt-1 inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-accent-600">
          텍스트 파일에서 불러오기
          <input
            type="file"
            accept=".txt,.cho,.chopro,.chordpro,.pro,text/plain"
            className="sr-only"
            onChange={async (e) => {
              const file = e.currentTarget.files?.[0];
              e.currentTarget.value = "";
              if (file) importText(await file.text());
            }}
          />
        </label>
        {chartStatus && <p className="mt-1 text-xs text-stone-500">{chartStatus}</p>}
      </details>
    </div>
  );
}
