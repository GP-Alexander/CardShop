import express, { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import { apiRouter } from "./routes";
import { manejarErrores } from "./shared/middlewares/manejarErrores";

export function createApp(): Express {
  const app = express();

  // Cabeceras de seguridad y CORS
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
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
