import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Clerk needs its middleware running for auth() to resolve in route handlers and server components.
// Next 16 deprecated this file convention in favor of proxy.ts (codemod:
// `npx @next/codemod middleware-to-proxy .`), but middleware.ts is still supported and is what
// Clerk v7 expects, so keep it until Clerk documents the proxy.ts path. When no Clerk key is set
// the app is local-only, so this degrades to a passthrough and adds no auth behavior.
export default process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  ? clerkMiddleware()
  : function middleware() {
      return NextResponse.next();
    };

export const config = {
  matcher: [
    // Skip Next internals and static files unless found in search params.
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes.
    '/(api|trpc)(.*)',
  ],
};
