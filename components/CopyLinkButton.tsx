"use client";

import { useEffect, useState } from "react";

/** 이 사이트 주소 + path를 보여 주고, 누르면 클립보드에 복사한다 */
export function CopyLinkButton({ path }: { path: string }) {
  const [url, setUrl] = useState(path);
  const [copied, setCopied] = useState(false);

  useEffect(() => setUrl(window.location.origin + path), [path]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // 클립보드를 못 쓰는 브라우저: 직접 복사하도록 주소창처럼 보여 준다
      window.prompt("이 주소를 복사해 주세요", url);
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mt-1 flex items-center gap-2">
      <span className="min-w-0 flex-1 truncate rounded bg-stone-100 px-2 py-1 font-mono text-xs text-stone-600">{url}</span>
      <button type="button" onClick={copy} className="btn-secondary shrink-0 px-3 py-1 text-xs">
        {copied ? "복사됨" : "링크 복사"}
      </button>
    </div>
  );
}
