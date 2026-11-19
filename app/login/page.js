import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import AuthShell from "@/components/AuthShell";
import LoginForm from "@/components/LoginForm";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(session.role === "Landlord" ? "/landlord" : "/tenant");

  return (
    <AuthShell>
      <LoginForm />
    </AuthShell>
  );
}
