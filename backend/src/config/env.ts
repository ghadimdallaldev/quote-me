import "dotenv/config";

export const env = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  seedAdminEmail: process.env.SEED_ADMIN_EMAIL ?? "admin@darines.local",
  seedOpsEmail: process.env.SEED_OPS_EMAIL ?? "ops@darines.local",
  seedPassword: process.env.SEED_PASSWORD ?? "ChangeMe123!",
  companyName: process.env.COMPANY_NAME ?? "Darine's Catering",
  companyAddress:
    process.env.COMPANY_ADDRESS ?? "Beirut, Badaro, next to Sweet Industry & AUCE",
  companyPhone: process.env.COMPANY_PHONE ?? "",
  companyInstagram: process.env.COMPANY_INSTAGRAM ?? "@DarinesCatering",
};
