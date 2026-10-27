import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/signup"];

// 쿠키가 없으면 로그인 화면으로. 세션이 유효한지는 각 화면의 requireMember()가 DB로 확인한다
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (!request.cookies.has("j4u_session") && !PUBLIC_PATHS.some((p) => path.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
