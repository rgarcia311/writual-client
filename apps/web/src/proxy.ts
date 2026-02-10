import { NextResponse } from "next/server";

export default function proxy(request) {
console.log("middleware hit");
  const session = request.cookies.get("firebase-token");

  // Define which routes you want to protect
  const protectedRoutes = ["/projects", "/project",];
  const isProtectedRoute = protectedRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  );

  console.log({ isProtectedRoute });

  if (isProtectedRoute && !session) {
    // Redirect unauthenticated users to the login page
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/projects", "/project/:id*"],
};