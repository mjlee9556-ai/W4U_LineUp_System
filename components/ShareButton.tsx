"use client";

import { useState } from "react";

/** 휴대폰에서는 공유 창(카톡 등)을, 안 되면 링크 복사를 한다 */
export function ShareButton({ path, title, className, children }: { path: string; title: string; className?: string; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.origin + path;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // 취소했거나 막힘: 아래 복사로 넘어간다
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("이 주소를 복사해 주세요", url);
    }
  }

  return (
    <button type="button" onClick={share} className={className}>
      {copied ? "링크 복사됨" : children}
    </button>
  );
}
