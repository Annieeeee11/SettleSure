import { useEffect, useState } from "react";

export function isDashboardRoute(pathname: string) {
  return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
}

export function goToDashboard() {
  if (window.location.pathname === "/dashboard") return;
  window.history.pushState(null, "", "/dashboard");
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function goToLanding() {
  if (window.location.pathname === "/") return;
  window.history.pushState(null, "", "/");
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function useRoute() {
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  return pathname;
}
