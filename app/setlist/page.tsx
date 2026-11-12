import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { getSelectableEvents, pickCurrent } from "@/lib/week";
import { AppShell } from "@/components/AppShell";
import { ListMusicIcon } from "@/components/icons";

/** 콘티 탭: 다가오는 주차의 콘티 화면으로 보낸다 */
export default async function SetlistTab() {
  const { member } = await requireMember();
  const event = pickCurrent(await getSelectableEvents(member));
  if (event) redirect(`/events/${event.id}`);
  return (
    <AppShell member={member}>
      <h1 className="text-[22px] font-extrabold tracking-tight text-stone-900">예배 콘티</h1>
      <div className="panel mt-4 py-10 text-center text-sm text-stone-500">
        <ListMusicIcon size={28} className="mx-auto mb-2 text-stone-300" />
        라인업이 확정되면 그 주의 콘티와 악보가 여기에 보여요.
      </div>
    </AppShell>
  );
}
