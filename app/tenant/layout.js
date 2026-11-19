import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Shell from "@/components/Shell";

export default async function TenantLayout({ children }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "Tenant") redirect("/landlord");

  return (
    <Shell role="Tenant" name={session.name}>
      {children}
    </Shell>
  );
}
