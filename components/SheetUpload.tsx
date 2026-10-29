"use client";

import { useRef, useState } from "react";

const MAX_SIDE = 2000;
const MAX_BYTES = 4 * 1024 * 1024;

/** 사진은 긴 변 2000px JPEG로 줄여서 올린다 (휴대폰 사진도 보통 0.5MB 안팎) */
async function shrink(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1024 * 1024) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export function SheetUpload({ songId, action }: { songId: string; action: (formData: FormData) => Promise<void> }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const picked = [...(input.files ?? [])];
    if (!picked.length) return;
    setBusy(true);
    setError(null);
    const files = await Promise.all(picked.map(shrink));
    const tooBig = files.find((f) => f.size > MAX_BYTES);
    if (tooBig) {
      setBusy(false);
      setError(`'${tooBig.name}'이(가) 4MB보다 커요. 더 작은 파일이나 악보 링크를 써 주세요.`);
      input.value = "";
      return;
    }
    const dt = new DataTransfer();
    files.forEach((f) => dt.items.add(f));
    input.files = dt.files;
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} action={action} onSubmit={() => setBusy(true)} className="inline-block">
      <input type="hidden" name="song_id" value={songId} />
      <label className={`btn-secondary cursor-pointer px-3 py-1 text-xs ${busy ? "pointer-events-none opacity-50" : ""}`}>
        {busy ? "올리는 중…" : "악보 올리기 (사진·PDF)"}
        <input type="file" name="file" accept="image/*,application/pdf" multiple className="sr-only" onChange={onChange} />
      </label>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </form>
  );
}
