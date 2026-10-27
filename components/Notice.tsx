export function Notice({ message, tone = "info" }: { message?: string; tone?: "info" | "error" }) {
  if (!message) return null;
  const color = tone === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800";
  return <p className={`mb-4 rounded-lg border px-3 py-2 text-sm ${color}`}>{message}</p>;
}
