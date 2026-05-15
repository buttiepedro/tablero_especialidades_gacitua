import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("access_token")?.value;
  const { pathname } = request.nextUrl;
  const isLogin = pathname === "/login";

  if (!token && !isLogin) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (token && isLogin) {
    return NextResponse.redirect(new URL("/general", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
