import dotenv from "dotenv";
import path from "path";
import { z } from "zod";

const envPath = path.resolve(__dirname, "../../../.env");
dotenv.config({ path: envPath });

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  API_PREFIX: z.string().default("/api/v1"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),

  // Base de datos SQL Server
  DB_HOST: z.string().default("localhost"),
  DB_PORT: z.coerce.number().int().positive().default(1433),
  DB_USER: z.string().default("sa"),
  DB_PASSWORD: z.string().default("ShopCart2026!StrongPwd"),
  DB_NAME: z.string().default("ShopCart"),

  // Seguridad y JWT
  JWT_SECRET: z.string().min(32, "JWT_SECRET debe tener al menos 32 caracteres"),
  JWT_ACCESS_EXPIRATION: z.string().default("15m"),
  JWT_REFRESH_EXPIRATION_DAYS: z.coerce.number().int().positive().default(7),

  // Parámetros de negocio
  RESERVA_EXPIRACION_MINUTOS: z.coerce.number().int().positive().default(15),
  IVA_PORCENTAJE: z.coerce.number().positive().default(0.12),

  // OAuth Google
  GOOGLE_CLIENT_ID: z.string().optional().default(""),
});

const parsed = EnvSchema.safeParse({
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  API_PREFIX: process.env.API_PREFIX,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  DB_HOST: process.env.DB_HOST,
  DB_PORT: process.env.DB_PORT,
  DB_USER: process.env.DB_USER,
  DB_PASSWORD: process.env.SA_PASSWORD || process.env.DB_PASSWORD,
  DB_NAME: process.env.DB_NAME,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_ACCESS_EXPIRATION: process.env.JWT_ACCESS_EXPIRATION,
  JWT_REFRESH_EXPIRATION_DAYS: process.env.JWT_REFRESH_EXPIRATION_DAYS,
  RESERVA_EXPIRACION_MINUTOS: process.env.RESERVA_EXPIRACION_MINUTOS,
  IVA_PORCENTAJE: process.env.IVA_PORCENTAJE,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || "",
});

if (!parsed.success) {
  console.error("❌ Configuración inválida en variables de entorno:");
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
