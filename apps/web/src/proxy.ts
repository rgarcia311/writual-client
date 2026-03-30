import { NextResponse } from "next/server";

export default function proxy(request) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get("firebase-token");
  const userId = request.cookies.get("user-id")?.value;

  // Redirect authenticated users away from the landing page
  if (userId && pathname === "/") {
    return NextResponse.redirect(new URL("/projects", request.url));
  }

  // Define which routes you want to protect
  const protectedRoutes = ["/projects", "/project"];
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (isProtectedRoute && !session) {
    // Redirect unauthenticated users to the login page
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/projects", "/project/:id*"],
};