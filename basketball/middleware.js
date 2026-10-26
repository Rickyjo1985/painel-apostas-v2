import { jwtVerify } from "jose";
import { NextResponse } from "next/server";

export async function middleware(request) {
  const pathname = request.nextUrl.pathname;

  if (
    pathname === "/login" ||
    pathname === "/api/login" ||
    pathname === "/api/logout" ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get("basketball_auth_token")?.value;

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const secret = process.env.BASKETBALL_AUTH_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "BASKETBALL_AUTH_SECRET não está configurado na Vercel." },
      { status: 500 }
    );
  }

  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
    return NextResponse.next();
  } catch (error) {
    const response = pathname.startsWith("/api/")
      ? NextResponse.json({ error: "Sessão inválida." }, { status: 401 })
      : NextResponse.redirect(new URL("/login", request.url));

    response.cookies.delete("basketball_auth_token");
    return response;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};