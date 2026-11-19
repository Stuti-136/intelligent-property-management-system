import Link from "next/link";
import Facade, { BrandMark } from "@/components/Facade";

const DEMO_UNITS = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  occupied: [0, 1, 3, 4, 6, 7, 9, 10].includes(i),
}));

// Two-column frame shared by the sign in and register pages.
export default function AuthShell({ children }) {
  return (
    <div className="auth">
      <aside className="auth-side">
        <Link href="/" className="brand">
          <BrandMark />
          <span className="brand-name">Property Management</span>
        </Link>
        <p className="auth-quote">Rent, repairs and leases, kept in one place.</p>
        <Facade units={DEMO_UNITS} cols={4} caption={null} />
      </aside>
      <main className="auth-main">
        <div className="auth-card">{children}</div>
      </main>
    </div>
  );
}
