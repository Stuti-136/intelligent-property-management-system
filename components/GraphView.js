"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// SVG network diagram with a small force-directed layout (no external libraries).
// Drag a node to move it, click a node to select it.

const W = 960;
const H = 600;

export const NODE_STYLE = {
  Landlord: { r: 26, fill: "#0e4d64", name: "Landlord" },
  Property: { r: 20, fill: "#b7791f", name: "Property" },
  Tenant: { r: 16, fill: "#2e7d55", name: "Tenant" },
  Request: { r: 11, fill: "#b03a2e", name: "Repair request" },
};

function seededRandom(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function computeLayout(nodes, edges) {
  const rand = seededRandom(11);
  const pos = {};
  const cx = W / 2;
  const cy = H / 2;

  const landlords = nodes.filter((n) => n.type === "Landlord");
  const properties = nodes.filter((n) => n.type === "Property");
  const others = nodes.filter((n) => n.type === "Tenant" || n.type === "Request");

  landlords.forEach((n, i) => {
    const angle = (i / Math.max(1, landlords.length)) * 2 * Math.PI;
    const spread = landlords.length > 1 ? 70 : 0;
    pos[n.id] = { x: cx + spread * Math.cos(angle), y: cy + spread * Math.sin(angle) };
  });

  properties.forEach((n, i) => {
    const angle = (i / Math.max(1, properties.length)) * 2 * Math.PI - Math.PI / 2;
    pos[n.id] = { x: cx + 190 * Math.cos(angle), y: cy + 190 * Math.sin(angle) };
  });

  const neighbours = {};
  for (const e of edges) {
    (neighbours[e.source] ??= []).push(e.target);
    (neighbours[e.target] ??= []).push(e.source);
  }

  others.forEach((n) => {
    const anchorId = (neighbours[n.id] ?? []).find((id) => pos[id]);
    const base = anchorId ? pos[anchorId] : { x: cx, y: cy };
    const angle = rand() * 2 * Math.PI;
    pos[n.id] = { x: base.x + 90 * Math.cos(angle), y: base.y + 90 * Math.sin(angle) };
  });

  // Fruchterman-Reingold style relaxation
  const ids = nodes.map((n) => n.id);
  const k = Math.sqrt((W * H) / Math.max(ids.length, 1)) * 0.55;
  const iterations = 320;

  for (let it = 0; it < iterations; it++) {
    const temperature = 1 - it / iterations;
    const disp = {};
    for (const id of ids) disp[id] = { x: 0, y: 0 };

    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = pos[ids[i]];
        const b = pos[ids[j]];
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let d = Math.hypot(dx, dy);
        if (d < 0.01) {
          dx = rand() - 0.5;
          dy = rand() - 0.5;
          d = Math.hypot(dx, dy);
        }
        const force = (k * k) / d;
        disp[ids[i]].x += (dx / d) * force;
        disp[ids[i]].y += (dy / d) * force;
        disp[ids[j]].x -= (dx / d) * force;
        disp[ids[j]].y -= (dy / d) * force;
      }
    }

    for (const e of edges) {
      const a = pos[e.source];
      const b = pos[e.target];
      if (!a || !b) continue;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const d = Math.max(Math.hypot(dx, dy), 0.01);
      const force = ((d * d) / k) * 0.6;
      disp[e.source].x -= (dx / d) * force;
      disp[e.source].y -= (dy / d) * force;
      disp[e.target].x += (dx / d) * force;
      disp[e.target].y += (dy / d) * force;
    }

    for (const id of ids) {
      const p = pos[id];
      disp[id].x -= (p.x - cx) * 0.03;
      disp[id].y -= (p.y - cy) * 0.03;

      const len = Math.max(Math.hypot(disp[id].x, disp[id].y), 0.01);
      const step = Math.min(len, 16 * temperature + 1);
      p.x = Math.min(W - 50, Math.max(50, p.x + (disp[id].x / len) * step));
      p.y = Math.min(H - 50, Math.max(50, p.y + (disp[id].y / len) * step));
    }
  }

  return pos;
}

function edgeGeometry(edge, pos, bend) {
  const a = pos[edge.source];
  const b = pos[edge.target];
  const ra = NODE_STYLE[edge.sourceType]?.r ?? 14;
  const rb = NODE_STYLE[edge.targetType]?.r ?? 14;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy) || 1;
  const ux = dx / d;
  const uy = dy / d;

  const x1 = a.x + ux * (ra + 2);
  const y1 = a.y + uy * (ra + 2);
  const x2 = b.x - ux * (rb + 7);
  const y2 = b.y - uy * (rb + 7);

  if (!bend) {
    return { path: `M${x1},${y1} L${x2},${y2}`, lx: (x1 + x2) / 2, ly: (y1 + y2) / 2 };
  }
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const cxp = mx - uy * bend;
  const cyp = my + ux * bend;
  return {
    path: `M${x1},${y1} Q${cxp},${cyp} ${x2},${y2}`,
    lx: 0.25 * x1 + 0.5 * cxp + 0.25 * x2,
    ly: 0.25 * y1 + 0.5 * cyp + 0.25 * y2,
  };
}

const truncate = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

export default function GraphView({ nodes, edges, selectedId, onSelect }) {
  const svgRef = useRef(null);
  const drag = useRef(null);
  const [hoverId, setHoverId] = useState(null);
  const [moved, setMoved] = useState({});

  const base = useMemo(() => computeLayout(nodes, edges), [nodes, edges]);
  useEffect(() => setMoved({}), [nodes, edges]);

  const pos = (id) => moved[id] ?? base[id];
  const livePos = {};
  for (const n of nodes) livePos[n.id] = pos(n.id);

  const typeOf = Object.fromEntries(nodes.map((n) => [n.id, n.type]));

  // Spread parallel edges (for example two leases between the same tenant and property)
  const groups = {};
  for (const e of edges) {
    const key = [e.source, e.target].sort().join("|");
    (groups[key] ??= []).push(e.id);
  }
  const drawn = edges.map((e) => {
    const key = [e.source, e.target].sort().join("|");
    const group = groups[key];
    const index = group.indexOf(e.id);
    const bend = group.length > 1 ? (index - (group.length - 1) / 2) * 36 : 0;
    return { ...e, sourceType: typeOf[e.source], targetType: typeOf[e.target], bend };
  });

  const focusId = hoverId ?? selectedId;
  const near = new Set();
  if (focusId) {
    near.add(focusId);
    for (const e of edges) {
      if (e.source === focusId) near.add(e.target);
      if (e.target === focusId) near.add(e.source);
    }
  }
  const showAllLabels = edges.length <= 14;

  function toSvgPoint(event) {
    const svg = svgRef.current;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const p = point.matrixTransform(svg.getScreenCTM().inverse());
    return { x: p.x, y: p.y };
  }

  function onPointerDown(event, id) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id, startX: event.clientX, startY: event.clientY, moved: false };
  }

  function onPointerMove(event) {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(event.clientX - d.startX, event.clientY - d.startY) < 4) return;
    d.moved = true;
    const p = toSvgPoint(event);
    setMoved((m) => ({
      ...m,
      [d.id]: { x: Math.min(W - 20, Math.max(20, p.x)), y: Math.min(H - 20, Math.max(20, p.y)) },
    }));
  }

  function onPointerUp() {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved) onSelect(d.id === selectedId ? null : d.id);
  }

  return (
    <svg
      ref={svgRef}
      className="graph-svg"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Network of landlords, properties, tenants and repair requests"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="#8896a1" />
        </marker>
        <marker id="arrow-focus" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="#14212b" />
        </marker>
      </defs>

      {drawn.map((e) => {
        const { path, lx, ly } = edgeGeometry(e, livePos, e.bend);
        const focused = focusId && (e.source === focusId || e.target === focusId);
        const ended = e.props?.status === "Ended";
        return (
          <g key={e.id} opacity={focusId && !focused ? 0.15 : 1}>
            <path
              d={path}
              fill="none"
              stroke={focused ? "#14212b" : "#8896a1"}
              strokeWidth={focused ? 2 : 1.4}
              strokeDasharray={ended ? "5 4" : undefined}
              markerEnd={focused ? "url(#arrow-focus)" : "url(#arrow)"}
            />
            {(showAllLabels || focused) && (
              <text
                x={lx}
                y={ly - 4}
                textAnchor="middle"
                fontSize="11"
                fill="#44545f"
                stroke="#fbfcfd"
                strokeWidth="3"
                paintOrder="stroke"
              >
                {e.type.replace("_", " ").toLowerCase()}
                {ended ? " (ended)" : ""}
              </text>
            )}
          </g>
        );
      })}

      {nodes.map((n) => {
        const p = livePos[n.id];
        const style = NODE_STYLE[n.type];
        const selected = n.id === selectedId;
        return (
          <g
            key={n.id}
            className="graph-node"
            transform={`translate(${p.x},${p.y})`}
            opacity={focusId && !near.has(n.id) ? 0.25 : 1}
            onPointerDown={(event) => onPointerDown(event, n.id)}
            onPointerEnter={() => setHoverId(n.id)}
            onPointerLeave={() => setHoverId(null)}
          >
            <title>{n.label}</title>
            {selected && <circle r={style.r + 6} fill="none" stroke="#14212b" strokeWidth="2" />}
            <circle r={style.r} fill={style.fill} stroke="#fff" strokeWidth="2" />
            <text
              y={style.r + 15}
              textAnchor="middle"
              fontSize="12.5"
              fontWeight="600"
              fill="#14212b"
              stroke="#fbfcfd"
              strokeWidth="3.5"
              paintOrder="stroke"
            >
              {truncate(n.label, 22)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
