import { redirect } from "next/navigation";
import { HttpError, requirePermission } from "@/lib/guard";
import DashboardClientLayout from "./dashboard-client-layout";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  try {
    await requirePermission("panel.access");
  } catch (error) {
    if (error instanceof HttpError) {
      if (error.status === 401) redirect("/auth/signin");
      if (error.status === 403) redirect("/auth/not-admin");
    }
    throw error;
  }

  return <DashboardClientLayout>{children}</DashboardClientLayout>;
}
