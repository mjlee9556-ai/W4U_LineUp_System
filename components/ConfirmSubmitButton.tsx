"use client";

import { useFormStatus } from "react-dom";

/** 누르면 확인창을 먼저 띄우고, 확인했을 때만 폼을 보내는 버튼 */
export function ConfirmSubmitButton({
  children,
  confirmMessage,
  pendingText = "처리 중…",
  className = "btn-secondary",
}: {
  children: React.ReactNode;
  confirmMessage: string;
  pendingText?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={className}
      onClick={(e) => {
        if (!window.confirm(confirmMessage)) e.preventDefault();
      }}
    >
      {pending ? pendingText : children}
    </button>
  );
}
