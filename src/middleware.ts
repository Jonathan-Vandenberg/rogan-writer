import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const { nextUrl } = req
  const isLoggedIn = !!req.auth

  // Allow access to auth pages without authentication
  if (nextUrl.pathname.startsWith("/auth/")) {
    if (isLoggedIn) {
      // Redirect logged-in users away from auth pages
      return NextResponse.redirect(new URL("/", nextUrl))
    }
    return NextResponse.next()
  }

  // For all other pages, require authentication
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/auth/signin", nextUrl))
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (NextAuth API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|public).*)",
  ],
} 