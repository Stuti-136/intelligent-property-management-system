"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { ToastProvider } from "@/components/ui";
import { BrandMark } from "@/components/Facade";
import { api } from "@/lib/api";

const NAV = {
  Landlord: [
    { href: "/landlord", label: "Overview" },
    { href: "/landlord/properties", label: "Properties" },
    { href: "/landlord/tenants", label: "Tenants" },
    { href: "/landlord/payments", label: "Payments" },
    { href: "/landlord/maintenance", label: "Maintenance" },
    { href: "/landlord/graph", label: "Network" },
  ],
  Tenant: [
    { href: "/tenant", label: "Overview" },
    { href: "/tenant/payments", label: "Payments" },
    { href: "/tenant/maintenance", label: "Maintenance" },
    { href: "/tenant/network", label: "My network" },
  ],
};

export default function Shell({ role, name, children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const items = NAV[role];
  const home = items[0].href;

  async function signOut() {
    setLeaving(true);
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      /* the cookie is cleared on the server; carry on to the sign in page */
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <ToastProvider>
      <div className="shell">
        <aside className="sidebar">
          <Link href={home} className="brand">
            <BrandMark />
            <span className="brand-name">
              Property Management
              <span className="brand-role">{role === "Landlord" ? "Landlord workspace" : "Tenant portal"}</span>
            </span>
          </Link>

          <nav className="nav" aria-label="Main">
            {items.map((item) => {
              const active = item.href === home ? pathname === home : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-link ${active ? "active" : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="sidebar-foot">
            <div className="who">{name}</div>
            <div className="who-role">{role}</div>
            <button type="button" className="signout" onClick={signOut} disabled={leaving}>
              {leaving ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </aside>

        <main className="main">{children}</main>
      </div>
    </ToastProvider>
  );
}
