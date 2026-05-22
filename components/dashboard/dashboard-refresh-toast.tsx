"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export function DashboardRefreshToast() {
  useEffect(() => {
    const id = window.setInterval(() => {
      toast.info("Monitoring data refreshed automatically.");
      window.location.reload();
    }, 120000);

    return () => window.clearInterval(id);
  }, []);

  return null;
}
