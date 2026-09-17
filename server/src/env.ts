import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL fehlt"),
  DISCORD_CLIENT_ID: z.string().min(1, "DISCORD_CLIENT_ID fehlt"),
  DISCORD_CLIENT_SECRET: z.string().min(1, "DISCORD_CLIENT_SECRET fehlt"),
  DISCORD_REDIRECT_URI: z.string().url("DISCORD_REDIRECT_URI muss eine vollständige URL sein"),
  DISCORD_BOT_TOKEN: z.string().min(1, "DISCORD_BOT_TOKEN fehlt"),
  DISCORD_GUILD_ID: z.string().min(1, "DISCORD_GUILD_ID fehlt"),
  ADMIN_ROLE_IDS: z
    .string()
    .default("")
    .transform((value) =>
      value
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  SESSION_SECRET: z.string().min(16, "SESSION_SECRET muss mindestens 16 Zeichen haben"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Ungültige Umgebungskonfiguration:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
