import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Shell from "@/components/Shell";

// Page-level role check (FR1.4): tenants cannot open landlord pages, and vice versa.
export default async function LandlordLayout({ children }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "Landlord") redirect("/tenant");

  return (
    <Shell role="Landlord" name={session.name}>
      {children}
    </Shell>
  );
}
