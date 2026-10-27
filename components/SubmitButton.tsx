"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingText = "저장 중…",
  className = "btn-primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className} {...props}>
      {pending ? pendingText : children}
    </button>
  );
}
