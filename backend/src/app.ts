import express, { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import path from "path";
import fs from "fs";
import { env } from "./config/env";
import { apiRouter } from "./routes";
import { manejarErrores } from "./shared/middlewares/manejarErrores";

export function createApp(): Express {
  const app = express();

  // Asegurar existencia del directorio de uploads para portabilidad
  const carpetaUploads = path.resolve(process.cwd(), "uploads");
  if (!fs.existsSync(carpetaUploads)) {
    fs.mkdirSync(carpetaUploads, { recursive: true });
  }

  // Servir archivos estáticos subidos (/uploads)
  app.use("/uploads", express.static(carpetaUploads, { maxAge: "7d" }));

  // Cabeceras de seguridad y CORS
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );
  const origenesPermitidos = [
    env.CORS_ORIGIN,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ];

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || origenesPermitidos.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error("Origen bloqueado por política de CORS"));
        }
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Idempotency-Key"],
    })
  );

  // Parseo de body y cookies
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Rutas principales con prefijo
  app.use(env.API_PREFIX, apiRouter);

  // Manejador centralizado de errores
  app.use(manejarErrores);

  return app;
}
