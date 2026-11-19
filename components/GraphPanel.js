"use client";

import { useState } from "react";
import { useApi } from "@/lib/hooks";
import { Empty, ErrorNote, Loading } from "@/components/ui";
import GraphView, { NODE_STYLE } from "@/components/GraphView";
import { money } from "@/lib/format";

const VERB = {
  OWNS: "owns",
  RENTS: "rents",
  SUBMITTED: "submitted",
  REPORTED: "submitted",
  FOR_PROPERTY: "is about",
};

function Details({ node, nodes, edges }) {
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const links = edges.filter((e) => e.source === node.id || e.target === node.id);
  const p = node.props;

  const facts = [];
  if (node.type === "Landlord" || node.type === "Tenant") {
    facts.push(["Role", p.role ?? node.type]);
  } else if (node.type === "Property") {
    facts.push(["Address", p.address], ["City", p.city], ["Rent", p.rent_amt != null ? money(p.rent_amt) : null], ["Status", p.status]);
  } else {
    facts.push(["Priority", p.priority], ["Status", p.status]);
  }

  return (
    <>
      <p className="detail-title">{node.label}</p>
      <p className="muted">{NODE_STYLE[node.type].name}</p>
      <dl className="facts" style={{ marginTop: 12 }}>
        {facts
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} style={{ display: "contents" }}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
      </dl>
      {links.length > 0 && (
        <ul className="detail-list">
          {links.map((e) => (
            <li key={e.id}>
              {byId[e.source].label} {VERB[e.type] ?? e.type.toLowerCase()} {byId[e.target].label}
              {e.props?.status === "Ended" && <span className="muted"> (lease ended)</span>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function GraphPanel() {
  const { data, error, loading, reload } = useApi("/api/graph");
  const [selectedId, setSelectedId] = useState(null);

  if (loading && !data) {
    return (
      <div className="panel">
        <Loading text="Reading the graph…" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="panel">
        <ErrorNote error={error} onRetry={reload} />
      </div>
    );
  }

  const nodes = data?.nodes ?? [];
  const edges = data?.edges ?? [];

  if (nodes.length === 0) {
    return (
      <div className="panel">
        <Empty title="Nothing in the graph yet">
          Properties, tenants and repair requests appear here once they are saved through the app. To copy records that
          were added straight into the database, run <code>npm run sync-graph</code>.
        </Empty>
      </div>
    );
  }

  const counts = {};
  for (const n of nodes) counts[n.type] = (counts[n.type] ?? 0) + 1;
  const selected = nodes.find((n) => n.id === selectedId);

  return (
    <>
      <div className="toolbar">
        <div className="legend">
          {Object.entries(NODE_STYLE)
            .filter(([type]) => counts[type])
            .map(([type, style]) => (
              <span className="legend-item" key={type}>
                <span className="legend-dot" style={{ background: style.fill }} />
                {style.name} ({counts[type]})
              </span>
            ))}
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={reload}>
          Refresh
        </button>
      </div>

      <div className="graph-layout">
        <div className="graph-canvas">
          <GraphView nodes={nodes} edges={edges} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
        <aside className="panel">
          <div className="panel-body">
            {selected ? (
              <Details node={selected} nodes={nodes} edges={edges} />
            ) : (
              <p className="muted">Select a node to see its details and connections. Drag a node to move it.</p>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
