import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import AuthShell from "@/components/AuthShell";
import RegisterForm from "@/components/RegisterForm";

export const metadata = { title: "Create account" };

export default async function RegisterPage() {
  const session = await getSession();
  if (session) redirect(session.role === "Landlord" ? "/landlord" : "/tenant");

  return (
    <AuthShell>
      <RegisterForm />
    </AuthShell>
  );
}
