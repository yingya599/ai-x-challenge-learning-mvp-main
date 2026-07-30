import { redirect } from "next/navigation";
import { getPrincipal } from "@/lib/server/principal";
import AdminConsole from "@/components/admin/AdminConsole";

export default async function AdminPage() {
  const principal = await getPrincipal();
  if (!principal) redirect("/login");
  if (principal.role !== "admin" && principal.role !== "system") redirect("/dashboard");
  return <AdminConsole />;
}
