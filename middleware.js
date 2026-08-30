import { jwtVerify } from "jose";
import { NextResponse } from "next/server";

export async function middleware(request) {
  const pathname = request.nextUrl.pathname;

  // Rotas que não precisam de autenticação
  if (
    pathname === "/login" ||
    pathname === "/api/login" ||
    pathname === "/api/logout" ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // Procurar o cookie de autenticação
  const token =
    request.cookies.get("auth_token")?.value;

  // Sem sessão
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          error: "Não autenticado."
        },
        {
          status: 401
        }
      );
    }

    return NextResponse.redirect(
      new URL("/login", request.url)
    );
  }

  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    return NextResponse.json(
      {
        error:
          "AUTH_SECRET não está configurado."
      },
      {
        status: 500
      }
    );
  }

  try {
    const secretKey = new TextEncoder().encode(
      secret
    );

    await jwtVerify(
      token,
      secretKey
    );

    return NextResponse.next();
  } catch (error) {
    console.error(
      "Sessão inválida:",
      error
    );

    if (pathname.startsWith("/api/")) {
      const response =
        NextResponse.json(
          {
            error: "Sessão inválida."
          },
          {
            status: 401
          }
        );

      response.cookies.delete(
        "auth_token"
      );

      return response;
    }

    const response =
      NextResponse.redirect(
        new URL("/login", request.url)
      );

    response.cookies.delete(
      "auth_token"
    );

    return response;
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)"
  ]
};
