import { NextResponse } from "next/server";
import { isAllowedBetaUser } from "./lib/betaAllowlist";

export default function proxy(request) {
  const { pathname } = request.nextUrl;
  // Both branches below must agree on the same cookie. They used to check "user-id" for the
  // "/" branch and "firebase-token" for the protected-route branch — two cookies that are
  // supposed to always be set/cleared together (see actions/auth.ts) but aren't guaranteed to
  // travel together in the browser (e.g. one was set with `secure: true` in a production run
  // and got silently dropped over plain http://localhost, while an older non-secure cookie of
  // the other name was still sitting in the jar from a prior dev run). Whenever the two
  // disagree, "/" redirects to "/projects" while "/projects" redirects back to "/" — an
  // infinite loop the browser reports as "too many redirects". Checking the same cookie in
  // both places makes that particular class of loop structurally impossible.
  const session = request.cookies.get("firebase-token");

  // Closed-beta gate. Both branches below must derive from this ONE predicate, for exactly the
  // same reason they must read the same cookie: if "/" redirected on session alone while the
  // protected-route branch additionally required allowlist membership, a signed-in but
  // uninvited user would bounce "/" -> "/projects" -> "/" forever. Sharing `hasBetaAccess`
  // makes that loop structurally impossible — an uninvited user just stays on the landing page.
  //
  // src/app/page.tsx repeats this same "/" -> "/projects" redirect server-side (it runs after
  // the proxy) and is gated on the identical predicate. All three checks must stay in sync.
  //
  // isAllowedBetaUser() is a routing gate only — it decodes the Firebase ID token without
  // verifying its signature, because the Edge runtime can't run firebase-admin. Real
  // enforcement lives in the GraphQL API and in hocuspocus's onAuthenticate. An empty
  // allowlist disables the gate entirely. See src/lib/betaAllowlist.ts.
  const hasBetaAccess = !!session && isAllowedBetaUser(session.value);

  // Redirect authenticated users away from the landing page
  if (hasBetaAccess && pathname === "/") {
    return NextResponse.redirect(new URL("/projects", request.url));
  }

  // Define which routes you want to protect
  const protectedRoutes = ["/projects", "/project", "/screenplay"];
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (isProtectedRoute && !hasBetaAccess) {
    // Redirect unauthenticated or non-allowlisted users to the login page
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/projects", "/project/:id*", "/screenplay"],
};