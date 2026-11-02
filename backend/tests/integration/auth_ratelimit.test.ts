import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";
import { getDbPool, closeDbPool } from "../../src/config/database";
import { limpiarRegistrosRateLimit } from "../../src/shared/middlewares/rateLimiter";

describe("Rate Limiting en Autenticación", () => {
  const app = createApp();

  beforeAll(async () => {
    await getDbPool();
  });

  afterAll(async () => {
    await closeDbPool();
  });

  beforeEach(() => {
    limpiarRegistrosRateLimit();
  });

  it("1. Debe permitir hasta 5 intentos fallidos y responder 401", async () => {
    for (let i = 1; i <= 5; i++) {
      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({
          correo: "admin@shopcart.com",
          password: "ContrasenaIncorrecta123!",
        });

      expect(res.status).toBe(401);
      expect(res.body.exito).toBe(false);
      expect(res.headers["x-ratelimit-limit"]).toBe("5");
      expect(res.headers["x-ratelimit-remaining"]).toBe(String(5 - i));
    }
  });

  it("2. Debe bloquear el 6to intento fallido con HTTP 429 Too Many Requests y cabecera Retry-After", async () => {
    // 5 intentos fallidos consecutivos
    for (let i = 1; i <= 5; i++) {
      await request(app)
        .post("/api/v1/auth/login")
        .send({
          correo: "admin@shopcart.com",
          password: "ContrasenaIncorrecta123!",
        });
    }

    // El 6to intento debe ser bloqueado inmediatamente sin consultar BD
    const resBloqueado = await request(app)
      .post("/api/v1/auth/login")
      .send({
        correo: "admin@shopcart.com",
        password: "Admin1234!", // Incluso con la contraseña correcta debe estar bloqueado
      });

    expect(resBloqueado.status).toBe(429);
    expect(resBloqueado.body.exito).toBe(false);
    expect(resBloqueado.body.codigoInterno).toBe("RATE_LIMIT_EXCEDIDO");
    expect(resBloqueado.body.mensaje).toContain("Demasiados intentos");
    expect(resBloqueado.headers["retry-after"]).toBeDefined();
    expect(parseInt(resBloqueado.headers["retry-after"], 10)).toBeGreaterThan(0);
  });
});
