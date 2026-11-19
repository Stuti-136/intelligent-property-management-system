"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { Field } from "@/components/ui";

export default function LoginForm() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { user } = await api("/api/auth/login", { method: "POST", body: form });
      router.replace(user.role === "Landlord" ? "/landlord" : "/tenant");
      router.refresh();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Sign in</h1>
      <p className="page-sub">Use the email and password you registered with.</p>

      <form onSubmit={submit}>
        {error && <div className="form-error" role="alert">{error}</div>}
        <Field label="Email">
          <input
            className="input"
            type="email"
            autoComplete="email"
            required
            autoFocus
            value={form.email}
            onChange={set("email")}
          />
        </Field>
        <Field label="Password">
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            required
            value={form.password}
            onChange={set("password")}
          />
        </Field>
        <div style={{ marginTop: 20 }}>
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </div>
      </form>

      <p className="auth-alt">
        New here? <Link href="/register">Create an account</Link>
      </p>
    </>
  );
}
