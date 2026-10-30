"use client";

import { useRef, useState, useTransition } from "react";
import { lookupYoutube } from "@/app/events/[id]/actions";

export type SongDefaults = {
  title?: string;
  youtube_url?: string | null;
  song_key?: string | null;
  sheet_url?: string | null;
  song_form?: string | null;
  memo?: string | null;
};

/** 곡 입력칸: 유튜브 링크를 새로 넣거나 바꾸면 그 영상 제목으로 곡 제목을 채운다. 채운 제목은 고칠 수 있다 */
export function SongFields({ defaults }: { defaults?: SongDefaults }) {
  const titleRef = useRef<HTMLInputElement>(null);
  const lastUrl = useRef(defaults?.youtube_url ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [pending, start] = useTransition();

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
      <input name="song_key" defaultValue={defaults?.song_key ?? ""} placeholder="키 (예: G)" aria-label="키" maxLength={20} className="input" />
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
    </div>
  );
}
