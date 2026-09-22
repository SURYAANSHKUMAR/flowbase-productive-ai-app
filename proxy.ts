import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { type NextFetchEvent, type NextRequest, NextResponse } from "next/server";

import { isLocalMode, localSessionCookie } from "@/lib/app-mode";

const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);

function localModeProxy(request: NextRequest) {
  const hasLocalSession = Boolean(request.cookies.get(localSessionCookie)?.value);

  if (isPublicRoute(request)) {
    return hasLocalSession ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();
  }

  if (!hasLocalSession) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  return NextResponse.next();
}

const cloudModeProxy = clerkMiddleware(async (auth, request) => {
  const { userId } = await auth();

  if (isPublicRoute(request)) {
    if (userId) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.next();
  }

  await auth.protect();
});

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (isLocalMode()) {
    return localModeProxy(request);
  }

  return cloudModeProxy(request, event);
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html|css|js|gif|svg|jpg|jpeg|png|woff|woff2|ico|csv|docx|xlsx|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
