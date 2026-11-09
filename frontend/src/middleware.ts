import { NextResponse, type NextRequest } from "next/server";

/**
 * Cheap edge check: no session cookie -> go to /login. This is only UX; the
 * real authorisation happens in Django on every API call.
 */
export function middleware(req: NextRequest) {
  const hasSession = req.cookies.has("sessionid");
  const { pathname, search } = req.nextUrl;
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/student/:path*", "/lecturer/:path*", "/admin/:path*", "/account/:path*", "/print/:path*"],
};
