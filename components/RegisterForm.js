"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { Field } from "@/components/ui";

export default function RegisterForm() {
  const router = useRouter();
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", password: "", role: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!form.role) {
      setError("Choose whether you are a landlord or a tenant.");
      return;
    }
    setBusy(true);
    try {
      const body = { ...form, phone: form.phone.trim() || undefined };
      const { user } = await api("/api/auth/register", { method: "POST", body });
      router.replace(user.role === "Landlord" ? "/landlord" : "/tenant");
      router.refresh();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Create your account</h1>
      <p className="page-sub">Landlords manage properties. Tenants see their rent, repairs and lease.</p>

      <form onSubmit={submit}>
        {error && <div className="form-error" role="alert">{error}</div>}

        <div className="choice-grid" role="radiogroup" aria-label="Account type">
          <label className="choice">
            <input
              type="radio"
              name="role"
              value="Landlord"
              checked={form.role === "Landlord"}
              onChange={set("role")}
            />
            <span className="choice-title">Landlord</span>
            <span className="choice-text">I own or manage properties</span>
          </label>
          <label className="choice">
            <input
              type="radio"
              name="role"
              value="Tenant"
              checked={form.role === "Tenant"}
              onChange={set("role")}
            />
            <span className="choice-title">Tenant</span>
            <span className="choice-text">I rent a property</span>
          </label>
        </div>

        <div style={{ marginTop: 14 }}>
          <Field label="Full name">
            <input
              className="input"
              autoComplete="name"
              required
              maxLength={100}
              value={form.full_name}
              onChange={set("full_name")}
            />
          </Field>
          <Field label="Email">
            <input
              className="input"
              type="email"
              autoComplete="email"
              required
              maxLength={100}
              value={form.email}
              onChange={set("email")}
            />
          </Field>
          <Field label="Phone" hint="Optional. Your landlord or tenant can use it to reach you.">
            <input
              className="input"
              type="tel"
              autoComplete="tel"
              maxLength={15}
              value={form.phone}
              onChange={set("phone")}
            />
          </Field>
          <Field label="Password" hint="At least 8 characters.">
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={form.password}
              onChange={set("password")}
            />
          </Field>
        </div>

        <div style={{ marginTop: 20 }}>
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? "Creating account…" : "Create account"}
          </button>
        </div>
      </form>

      <p className="auth-alt">
        Already registered? <Link href="/login">Sign in</Link>
      </p>
    </>
  );
}
