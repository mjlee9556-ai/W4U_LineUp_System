"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_LENGTH = 300;

const back = (date: string, extra = "") => `/calendar?month=${date.slice(0, 7)}&date=${date}${extra}#notes`;

/** 관리자가 캘린더 날짜에 공지·메모를 남긴다. 모든 팀원에게 보인다 */
export async function addCalendarNote(formData: FormData) {
  const { member } = await requireAdmin();
  const date = String(formData.get("date") ?? "");
  const content = String(formData.get("content") ?? "").trim().slice(0, MAX_LENGTH);
  if (!DATE.test(date) || Number.isNaN(Date.parse(date))) redirect("/calendar");
  if (!content) redirect(back(date, "&note=empty"));

  await query(`insert into calendar_notes (date, content, created_by) values ($1, $2, $3)`, [date, content, member.id]);
  revalidatePath("/calendar");
  redirect(back(date));
}

export async function deleteCalendarNote(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("note_id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect("/calendar");
  const row = await queryOne<{ date: string }>(`delete from calendar_notes where id = $1 returning date`, [id]);
  revalidatePath("/calendar");
  redirect(row ? back(row.date) : "/calendar");
}
