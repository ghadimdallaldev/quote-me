const login = await fetch("http://localhost:4000/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "ops@darines.local",
    password: "ChangeMe123!",
  }),
}).then((r) => r.json());

const clients = await fetch("http://localhost:4000/api/clients", {
  headers: { Authorization: `Bearer ${login.token}` },
}).then((r) => r.json());

console.log(
  clients.map((c) => ({
    name: c.name,
    quotes: c.stats?.quotationCount,
    value: c.stats?.totalValueCents,
    last: c.stats?.lastQuotationNumber,
  })),
);
