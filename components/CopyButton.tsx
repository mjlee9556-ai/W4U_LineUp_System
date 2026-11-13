"use client";

import { useState } from "react";
import { CopyIcon } from "@/components/icons";

/** 이 사이트 주소 + path를 클립보드에 복사하는 작은 버튼 */
export function CopyButton({ path, label = "복사", className = "" }: { path: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = window.location.origin + path;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // 클립보드를 못 쓰는 브라우저: 직접 복사하도록 보여 준다
      window.prompt("이 주소를 복사해 주세요", url);
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button type="button" onClick={copy} className={`inline-flex shrink-0 items-center justify-center gap-1 ${className}`}>
      <CopyIcon size={14} />
      {copied ? "복사됨" : label}
    </button>
  );
}
