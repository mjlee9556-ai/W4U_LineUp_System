"use client";

import { useRouter } from "next/navigation";
import { CalendarIcon, ChevronDownIcon } from "@/components/icons";

/** 주차 고르기: 고르면 basePath?event=<id>로, basePath가 /로 끝나면 basePath<id>로 이동한다 */
export function EventPicker({
  options,
  value,
  basePath,
}: {
  options: { id: string; label: string }[];
  value: string;
  basePath: string;
}) {
  const router = useRouter();
  return (
    <label className="relative flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-stone-200 bg-white pl-3 pr-9 text-sm font-bold text-stone-900 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <CalendarIcon size={18} className="shrink-0 text-stone-700" />
      <span className="truncate">{options.find((o) => o.id === value)?.label}</span>
      <ChevronDownIcon size={18} className="pointer-events-none absolute right-3 text-stone-500" />
      <select
        aria-label="주차 고르기"
        value={value}
        onChange={(e) => {
          const id = e.currentTarget.value;
          router.push(basePath.endsWith("/") ? `${basePath}${id}` : `${basePath}?event=${id}`);
        }}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
