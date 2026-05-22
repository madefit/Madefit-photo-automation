import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

export async function middleware(request: NextRequest) {
  const supabaseResponse = await updateSession(request);
  const dashboardToken = process.env.DASHBOARD_AUTH_TOKEN;

  if (!dashboardToken || !request.nextUrl.pathname.startsWith("/dashboard")) {
    return supabaseResponse;
  }

  const cookieToken = request.cookies.get("madefit_dashboard_token")?.value;
  const queryToken = request.nextUrl.searchParams.get("token");

  if (queryToken === dashboardToken) {
    const cleanUrl = request.nextUrl.clone();
    cleanUrl.searchParams.delete("token");
    const response = NextResponse.redirect(cleanUrl);
    response.cookies.set("madefit_dashboard_token", queryToken, {
      httpOnly: true,
      sameSite: "strict",
      secure: true,
      path: "/dashboard",
      maxAge: 60 * 60 * 12
    });
    return response;
  }

  if (cookieToken === dashboardToken) {
    return supabaseResponse;
  }

  return new NextResponse("Unauthorized dashboard. Open /dashboard?token=YOUR_DASHBOARD_AUTH_TOKEN.", {
    status: 401,
    headers: {
      "content-type": "text/plain; charset=utf-8"
    }
  });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
  ]
};
