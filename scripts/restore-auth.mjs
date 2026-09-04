import fs from "fs";

const path = "backend/src/app.ts";
let s = fs.readFileSync(path, "utf8");

if (!s.includes('import bcrypt')) {
  s = s.replace(
    'import compression from "compression";',
    `import bcrypt from "bcryptjs";
import compression from "compression";
import jwt from "jsonwebtoken";`,
  );
}

const authHelpers = `function setPrivateCache(res: express.Response, seconds: number) {
  res.setHeader(
    "Cache-Control",
    \`private, max-age=\${seconds}, stale-while-revalidate=\${Math.max(seconds, 60)}\`,
  );
}

type AuthUser = { id: string; role: string; email: string };

function signToken(user: AuthUser) {
  return jwt.sign(user, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as jwt.SignOptions["expiresIn"],
  });
}

function auth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const payload = jwt.verify(header.slice(7), env.jwtSecret) as AuthUser;
    (req as express.Request & { user: AuthUser }).user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

app.get("/api/health", (_req, res) => res.json({ ok: true, app: "quote-me" }));

app.post("/api/auth/login", async (req, res) => {
  const body = z
    .object({ email: z.string().email(), password: z.string().min(1) })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const user = await prisma.user.findUnique({ where: { email: body.data.email } });
  if (!user || !(await bcrypt.compare(body.data.password, user.passwordHash))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const token = signToken({ id: user.id, role: user.role, email: user.email });
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

app.get("/api/auth/me", auth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: (req as express.Request & { user: AuthUser }).user.id },
  });
  if (!user) return res.status(404).json({ error: "Not found" });
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
});
`;

// Replace from setPrivateCache through end of /api/auth/me (broken block)
s = s.replace(
  /function setPrivateCache\([\s\S]*?app\.get\("\/api\/auth\/me",[\s\S]*?\}\);\r?\n\r?\napp\.get\("\/api\/menu"/,
  authHelpers + '\n\napp.get("/api/menu"',
);

// Ensure protected routes use auth middleware (idempotent)
const protectedPrefixes = [
  'app.get("/api/menu"',
  'app.get("/api/menu/catalogs/:code"',
  'app.get("/api/clients"',
  'app.post("/api/clients"',
  'app.get("/api/clients/:id"',
  'app.put("/api/clients/:id"',
  'app.get("/api/delivery-locations"',
  'app.post("/api/delivery-locations"',
  'app.put("/api/delivery-locations/:id"',
  'app.delete("/api/delivery-locations/:id"',
  'app.get("/api/dashboard"',
  'app.post("/api/quotations/calculate"',
  'app.get("/api/quotations"',
  'app.post("/api/quotations"',
  'app.get("/api/quotations/:id"',
  'app.put("/api/quotations/:id"',
  'app.post("/api/quotations/:id/duplicate"',
  'app.post("/api/quotations/:id/status"',
  'app.get("/api/quotations/:id/pdf"',
  'app.get("/api/quotations/:id/preview"',
];

for (const prefix of protectedPrefixes) {
  // already has auth
  const withAuth = prefix + ", auth,";
  if (s.includes(withAuth)) continue;
  // without auth: prefix + ", async" or prefix + ", (req"
  s = s.replace(prefix + ", async", withAuth + " async");
  s = s.replace(prefix + ", (req", withAuth + " (req");
}

s = s.replace(
  /const userId = await getSystemUserId\(\);/g,
  "const userId = (req as express.Request & { user: AuthUser }).user.id;",
);

// remove getSystemUserId if present
s = s.replace(/async function getSystemUserId\(\) \{[\s\S]*?\}\r?\n\r?\n/, "");

fs.writeFileSync(path, s);
console.log("restored");
console.log("bcrypt", s.includes("import bcrypt"));
console.log("auth fn", s.includes("function auth("));
console.log("menu auth", s.includes('app.get("/api/menu", auth,'));
console.log("getSystemUserId", s.includes("getSystemUserId"));
console.log("userId from req", (s.match(/\(req as express\.Request & \{ user: AuthUser \}\)\.user\.id/g) || []).length);
