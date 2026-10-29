"use client";

import { useRef, useState, useTransition } from "react";
import { lookupYoutube } from "@/app/events/[id]/actions";

/** 곡 입력칸: 유튜브 링크를 넣으면 제목을 자동으로 채우고, 채운 제목은 고칠 수 있다 */
export function SongFields({
  defaults,
}: {
  defaults?: { title?: string; youtube_url?: string | null; song_key?: string | null; sheet_url?: string | null };
}) {
  const titleRef = useRef<HTMLInputElement>(null);
  const lastAuto = useRef<string | null>(null);
  const lastUrl = useRef(defaults?.youtube_url ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function lookup(value: string) {
    const url = value.trim();
    if (!url || url === lastUrl.current) return;
    lastUrl.current = url;
    start(async () => {
      const { url: normalized, title } = await lookupYoutube(url);
      if (!normalized) return setStatus("유튜브 링크가 아닌 것 같아요.");
      if (!title) return setStatus("제목을 가져오지 못했어요. 직접 입력해 주세요.");
      const input = titleRef.current;
      // 비어 있거나 전에 자동으로 채운 제목일 때만 덮어쓴다
      if (input && (!input.value.trim() || input.value === lastAuto.current)) {
        input.value = title;
        lastAuto.current = title;
        setStatus("영상 제목을 가져왔어요. 필요하면 고쳐 주세요.");
      } else {
        setStatus(`영상 제목: ${title}`);
      }
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
    </div>
  );
}
