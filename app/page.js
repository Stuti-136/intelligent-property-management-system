import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Facade, { BrandMark } from "@/components/Facade";

const SHOWPIECE = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  occupied: [0, 1, 2, 4, 6, 7, 9, 10, 11, 13, 15, 16, 18].includes(i),
}));

export default async function Home() {
  const session = await getSession();
  if (session) redirect(session.role === "Landlord" ? "/landlord" : "/tenant");

  return (
    <div className="landing">
      <main className="landing-copy">
        <div className="brand landing-brand">
          <BrandMark />
          <span className="brand-name">Property Management</span>
        </div>

        <h1 className="landing-title">Rent, repairs and leases for every unit.</h1>
        <p className="landing-lede">
          Landlords keep track of properties, tenants and payments. Tenants see what they owe,
          report problems and download their lease.
        </p>

        <div className="landing-actions">
          <Link href="/register" className="btn btn-primary">
            Create an account
          </Link>
          <Link href="/login" className="btn btn-secondary">
            Sign in
          </Link>
        </div>
      </main>

      <aside className="landing-art">
        <Facade units={SHOWPIECE} cols={5} caption="Each window is a unit. A lit window means it is occupied." />
      </aside>
    </div>
  );
}
