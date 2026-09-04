const res = await fetch("http://localhost:4000/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "ops@darines.local",
    password: "ChangeMe123!",
  }),
});
const login = await res.json();
console.log("login", res.status, login.user?.email, login.user?.role);
const headers = { Authorization: `Bearer ${login.token}` };
const menu = await fetch("http://localhost:4000/api/menu", { headers }).then((r) =>
  r.json(),
);
console.log("catalogs", menu.length, "packages", menu.reduce((n, c) => n + c.packages.length, 0));
const dash = await fetch("http://localhost:4000/api/dashboard", { headers }).then((r) =>
  r.json(),
);
console.log("dashboard", dash);
