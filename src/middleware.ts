import { withAuth } from "next-auth/middleware";

// Defense in depth: unauthenticated requests never reach dashboard pages.
// (API routes additionally enforce role permissions via lib/guard.ts.)
export default withAuth({ pages: { signIn: "/auth/signin" } });

export const config = { matcher: ["/dashboard/:path*"] };
