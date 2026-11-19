import neo4j from "neo4j-driver";

// One driver for the whole app (reused across hot reloads in dev).
const g = globalThis;

export function getDriver() {
  if (!g.neo4jDriver) {
    const { NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD } = process.env;
    if (!NEO4J_URI || !NEO4J_USER || !NEO4J_PASSWORD) {
      throw new Error("NEO4J_URI / NEO4J_USER / NEO4J_PASSWORD are not set in .env.local");
    }
    // Short timeouts: if Neo4j is down, a request should give up after a few seconds
    // (the default is to keep retrying for 30 seconds or more) and the app carries on.
    g.neo4jDriver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD), {
      connectionTimeout: 3000,
      connectionAcquisitionTimeout: 5000,
      maxTransactionRetryTime: 3000,
    });
  }
  return g.neo4jDriver;
}

function openSession(mode) {
  const config = { defaultAccessMode: mode };
  if (process.env.NEO4J_DATABASE) config.database = process.env.NEO4J_DATABASE;
  return getDriver().session(config);
}

export async function runWrite(cypher, params = {}) {
  const session = openSession(neo4j.session.WRITE);
  try {
    return await session.executeWrite((tx) => tx.run(cypher, params));
  } finally {
    await session.close();
  }
}

export async function runRead(cypher, params = {}) {
  const session = openSession(neo4j.session.READ);
  try {
    return await session.executeRead((tx) => tx.run(cypher, params));
  } finally {
    await session.close();
  }
}
