"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function ScrollToTopOnHome() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/") return;

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

  useEffect(() => {
    const handlePageShow = () => {
      if (window.location.pathname !== "/") return;

      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    };

    window.addEventListener("pageshow", handlePageShow);

    return () => {
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  return null;
}
