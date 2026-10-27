import { NextResponse } from "next/server";
import { endSession } from "@/lib/auth";

export async function POST(request: Request) {
  await endSession();
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
