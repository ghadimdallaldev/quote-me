import fs from "fs";

const path = "backend/src/app.ts";
let s = fs.readFileSync(path, "utf8");

s = s.replace(/import bcrypt from "bcryptjs";\r?\n/, "");
s = s.replace(/import jwt from "jsonwebtoken";\r?\n/, "");

s = s.replace(
  /type AuthUser = \{ id: string; role: string; email: string \};\r?\n\r?\nfunction signToken\(user: AuthUser\) \{\r?\n[\s\S]*?\r?\n\}\r?\n\r?\nfunction auth\(\r?\n[\s\S]*?\r?\n\}\r?\n\r?\n/,
  "",
);

s = s.replace(
  /app\.get\("\/api\/health", \(_req, res\) => res\.json\(\{ ok: true \}\);\r?\n\r?\napp\.post\("\/api\/auth\/login", async \(req, res\) => \{[\s\S]*?\}\);\r?\n\r?\napp\.get\("\/api\/auth\/me", auth, async \(req, res\) => \{[\s\S]*?\}\);\r?\n\r?\n/,
  `app.get("/api/health", (_req, res) => res.json({ ok: true, app: "quote-me" }));

async function getSystemUserId() {
  const email = env.seedOpsEmail;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing.id;
  const created = await prisma.user.create({
    data: {
      name: "Quote Me Ops",
      email,
      passwordHash: "no-auth",
      role: "OPS_MANAGER",
    },
  });
  return created.id;
}

`,
);

s = s.replace(/", auth, /g, '", ');
s = s.replace(
  /const userId = \(req as express\.Request & \{ user: AuthUser \}\)\.user\.id;/g,
  "const userId = await getSystemUserId();",
);

fs.writeFileSync(path, s);
const leftovers = [...s.matchAll(/\bauth\b|jwt\.|bcrypt|AuthUser|\/api\/auth/g)].map((m) => m[0]);
console.log("leftover count", leftovers.length, leftovers.slice(0, 30));
