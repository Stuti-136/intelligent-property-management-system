import neo4j from "neo4j-driver";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { runRead } from "@/lib/neo4j";

// GET /api/graph   (FR6.3)
// Returns the network of Landlords, Properties, Tenants and maintenance requests as
// { nodes: [{ id, type, label, props }], edges: [{ id, source, target, type, props }] }
//   Landlord: everything around the properties they own
//   Tenant:   their own property, its landlord and the requests they submitted
//
// NOTE: these are plain MATCH queries so the page works out of the box. If your teammate writes
// more advanced traversal queries, add them as extra routes or swap the Cypher below.

const plain = (value) => {
  if (neo4j.isInt(value)) return value.toNumber();
  if (Array.isArray(value)) return value.map(plain);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]));
  }
  return value;
};

function collector() {
  const nodes = new Map();
  const edges = new Map();

  return {
    node(n) {
      if (!n || nodes.has(n.elementId)) return;
      const props = plain(n.properties);
      let type = "Tenant";
      let label = `User ${props.user_id}`;
      if (n.labels.includes("Property")) {
        type = "Property";
        label = props.name ?? `Property ${props.property_id}`;
      } else if (n.labels.includes("MaintenanceRequest")) {
        type = "Request";
        label = props.title ?? `Request ${props.request_id}`;
      } else {
        type = props.role === "Landlord" ? "Landlord" : "Tenant";
        label = props.full_name ?? label;
      }
      nodes.set(n.elementId, { id: n.elementId, type, label, props });
    },
    edge(r) {
      if (!r || edges.has(r.elementId)) return;
      edges.set(r.elementId, {
        id: r.elementId,
        source: r.startNodeElementId,
        target: r.endNodeElementId,
        type: r.type,
        props: plain(r.properties),
      });
    },
    result() {
      const list = [...nodes.values()];
      return {
        nodes: list,
        edges: [...edges.values()].filter((e) => nodes.has(e.source) && nodes.has(e.target)),
      };
    },
  };
}

export async function GET() {
  const { session, error } = await requireAuth(["Landlord", "Tenant"]);
  if (error) return error;

  const uid = neo4j.int(session.userId);
  const graph = collector();

  try {
    if (session.role === "Landlord") {
      const [owned, rented, requests] = await Promise.all([
        runRead(
          `MATCH (l:User {user_id: $uid})-[o:OWNS]->(p:Property) RETURN l, o, p`,
          { uid }
        ),
        runRead(
          `MATCH (:User {user_id: $uid})-[:OWNS]->(p:Property)<-[r:RENTS]-(t:User) RETURN t, r, p`,
          { uid }
        ),
        runRead(
          `MATCH (:User {user_id: $uid})-[:OWNS]->(p:Property)<-[f:FOR_PROPERTY]-(m:MaintenanceRequest)
           OPTIONAL MATCH (s:User)-[sub:SUBMITTED|REPORTED]->(m)
           RETURN m, f, p, s, sub`,
          { uid }
        ),
      ]);
      for (const r of owned.records) { graph.node(r.get("l")); graph.node(r.get("p")); graph.edge(r.get("o")); }
      for (const r of rented.records) { graph.node(r.get("t")); graph.node(r.get("p")); graph.edge(r.get("r")); }
      for (const r of requests.records) {
        graph.node(r.get("m")); graph.node(r.get("p")); graph.node(r.get("s"));
        graph.edge(r.get("f")); graph.edge(r.get("sub"));
      }
    } else {
      const [rented, requests] = await Promise.all([
        runRead(
          `MATCH (t:User {user_id: $uid})-[r:RENTS]->(p:Property)
           OPTIONAL MATCH (l:User)-[o:OWNS]->(p)
           RETURN t, r, p, l, o`,
          { uid }
        ),
        runRead(
          `MATCH (t:User {user_id: $uid})-[sub:SUBMITTED|REPORTED]->(m:MaintenanceRequest)-[f:FOR_PROPERTY]->(p:Property)
           RETURN t, sub, m, f, p`,
          { uid }
        ),
      ]);
      for (const r of rented.records) {
        graph.node(r.get("t")); graph.node(r.get("p")); graph.node(r.get("l"));
        graph.edge(r.get("r")); graph.edge(r.get("o"));
      }
      for (const r of requests.records) {
        graph.node(r.get("t")); graph.node(r.get("m")); graph.node(r.get("p"));
        graph.edge(r.get("sub")); graph.edge(r.get("f"));
      }
    }

    return NextResponse.json(graph.result());
  } catch (err) {
    console.error("Graph query failed:", err.message);
    return NextResponse.json(
      { error: "The graph database could not be reached. Check that Neo4j is running and the NEO4J_* values in .env.local are correct." },
      { status: 503 }
    );
  }
}
