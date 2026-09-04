import pg from "pg";

const urls = [
  "postgresql://postgres:postgres@localhost:5432/postgres",
  "postgresql://darines:darines@localhost:5432/postgres",
  "postgresql://postgres@localhost:5432/postgres",
];

for (const u of urls) {
  const c = new pg.Client({ connectionString: u, connectionTimeoutMillis: 3000 });
  try {
    await c.connect();
    console.log("OK", u);
    const r = await c.query(
      "SELECT datname FROM pg_database WHERE datname='darines_quotes'",
    );
    if (r.rowCount === 0) {
      await c.query("CREATE DATABASE darines_quotes");
      console.log("created darines_quotes");
    } else {
      console.log("darines_quotes exists");
    }
    await c.end();
    process.exit(0);
  } catch (e) {
    console.log("FAIL", u, e.message);
    try {
      await c.end();
    } catch {}
  }
}
process.exit(1);
