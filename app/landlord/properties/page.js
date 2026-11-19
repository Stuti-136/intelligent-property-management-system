"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import {
  Badge,
  ConfirmDialog,
  Empty,
  ErrorNote,
  Field,
  Loading,
  Modal,
  PageHeader,
  Segmented,
  useToast,
} from "@/components/ui";
import { money } from "@/lib/format";

function PropertyModal({ property, onClose, onSaved }) {
  const toast = useToast();
  const isNew = !property;
  const [form, setForm] = useState({
    name: property?.name ?? "",
    address: property?.address ?? "",
    city: property?.city ?? "",
    rent_amt: property?.rent_amt ?? "",
    description: property?.description ?? "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = { ...form, rent_amt: Number(form.rent_amt) };
      const res = isNew
        ? await api("/api/properties", { method: "POST", body })
        : await api(`/api/properties/${property.property_id}`, { method: "PATCH", body });

      if (res.graph_synced === false) {
        toast("Saved, but the network graph could not be updated, so it may be out of date.", "warn");
      } else {
        toast(isNew ? "Property added" : "Changes saved");
      }
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title={isNew ? "Add a property" : "Edit property"}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="property-form" className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : isNew ? "Add property" : "Save changes"}
          </button>
        </>
      }
    >
      <form id="property-form" onSubmit={submit}>
        {error && <div className="form-error" role="alert">{error}</div>}
        <Field label="Name">
          <input className="input" required maxLength={100} autoFocus value={form.name} onChange={set("name")} />
        </Field>
        <Field label="Address">
          <input className="input" required maxLength={255} value={form.address} onChange={set("address")} />
        </Field>
        <div className="field-row">
          <Field label="City">
            <input className="input" required maxLength={100} value={form.city} onChange={set("city")} />
          </Field>
          <Field label="Monthly rent">
            <input
              className="input"
              type="number"
              required
              min="0"
              step="0.01"
              value={form.rent_amt}
              onChange={set("rent_amt")}
            />
          </Field>
        </div>
        <Field label="Description" hint="Optional. Bedrooms, amenities, anything a tenant should know.">
          <textarea className="textarea" value={form.description} onChange={set("description")} />
        </Field>
      </form>
    </Modal>
  );
}

export default function PropertiesPage() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("All");
  const [editing, setEditing] = useState(null); // null | "new" | property
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const params = new URLSearchParams();
  if (status !== "All") params.set("status", status);
  if (debounced) params.set("q", debounced);
  const { data, error, loading, reload } = useApi(`/api/properties?${params}`);
  const properties = data?.properties ?? [];
  const filtered = status !== "All" || debounced !== "";

  async function remove() {
    setBusy(true);
    try {
      const res = await api(`/api/properties/${deleting.property_id}`, { method: "DELETE" });
      toast(res.graph_synced === false ? "Deleted. The network graph could not be updated." : "Property deleted", res.graph_synced === false ? "warn" : "ok");
      setDeleting(null);
      reload();
    } catch (err) {
      toast(
        err.status === 409
          ? "This property has tenants, payments or repair requests linked to it, so it cannot be deleted."
          : err.message,
        "error"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Properties" sub="Everything you own, with its rent and who lives there.">
        <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}>
          Add a property
        </button>
      </PageHeader>

      <div className="toolbar">
        <input
          className="input input-search"
          type="search"
          placeholder="Search by name or address"
          aria-label="Search properties"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Segmented
          label="Filter by status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "All", label: "All" },
            { value: "Available", label: "Available" },
            { value: "Occupied", label: "Occupied" },
          ]}
        />
      </div>

      <div className="panel">
        {loading && !data ? (
          <Loading />
        ) : error ? (
          <ErrorNote error={error} onRetry={reload} />
        ) : properties.length === 0 ? (
          filtered ? (
            <Empty title="No properties match">Try a different search or status.</Empty>
          ) : (
            <Empty
              title="No properties yet"
              action={
                <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}>
                  Add your first property
                </button>
              }
            >
              Add a property to start assigning tenants and tracking rent.
            </Empty>
          )
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Property</th>
                  <th className="num">Rent per month</th>
                  <th>Status</th>
                  <th>Tenant</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {properties.map((p) => (
                  <tr key={p.property_id}>
                    <td>
                      <div className="cell-title">{p.name}</div>
                      <div className="cell-sub">
                        {p.address}, {p.city}
                      </div>
                    </td>
                    <td className="num">{money(p.rent_amt)}</td>
                    <td>
                      <Badge value={p.status} />
                    </td>
                    <td>{p.tenant_name ?? <span className="muted">Vacant</span>}</td>
                    <td>
                      <div className="actions">
                        <button type="button" className="btn btn-link" onClick={() => setEditing(p)}>
                          Edit
                        </button>
                        <button type="button" className="btn btn-link btn-link-danger" onClick={() => setDeleting(p)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <PropertyModal
          property={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete this property?"
          confirmLabel="Delete property"
          danger
          busy={busy}
          onConfirm={remove}
          onClose={() => setDeleting(null)}
        >
          <p>
            <strong>{deleting.name}</strong> will be removed. A property that has tenants, payments or repair
            requests linked to it cannot be deleted.
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}
