import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";
import { getDbPool, closeDbPool } from "../../src/config/database";

describe("Módulo de Autenticación y Autorización (RF-01)", () => {
  const app = createApp();
  const testEmail = `test.cliente.${Date.now()}@shopcart.com`;
  const testPassword = "Password123!";
  let accessToken: string;
  let refreshTokenCookie: string;
  let firstRefreshTokenValue: string;

  beforeAll(async () => {
    // Asegurar conexión a SQL Server
    await getDbPool();
  });

  afterAll(async () => {
    // Cerrar conexión
    await closeDbPool();
  });

  it("1. Debe registrar un nuevo cliente exitosamente (201)", async () => {
    const res = await request(app)
      .post("/api/v1/auth/registro")
      .send({
        nombre: "Carlos",
        apellido: "Mendoza",
        correo: testEmail,
        password: testPassword,
        telefono: "+50255554444",
      });

    expect(res.status).toBe(201);
    expect(res.body.exito).toBe(true);
    expect(res.body.datos.usuario.correo).toBe(testEmail);
    expect(res.body.datos.usuario.rol).toBe("Cliente");
    expect(res.body.datos.accessToken).toBeDefined();

    // Debe incluir la cookie HttpOnly del refresh token
    const cookies = res.headers["set-cookie"];
    expect(cookies).toBeDefined();
    const cookieHeader = Array.isArray(cookies) ? cookies.join(";") : cookies;
    expect(cookieHeader).toContain("refreshToken=");
    expect(cookieHeader).toContain("HttpOnly");
  });

  it("2. Debe rechazar el registro si el correo ya existe (409)", async () => {
    const res = await request(app)
      .post("/api/v1/auth/registro")
      .send({
        nombre: "Carlos",
        apellido: "Mendoza",
        correo: testEmail,
        password: testPassword,
      });

    expect(res.status).toBe(409);
    expect(res.body.exito).toBe(false);
  });

  it("3. Debe iniciar sesión correctamente y emitir tokens (200)", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({
        correo: testEmail,
        password: testPassword,
      });

    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
    expect(res.body.datos.accessToken).toBeDefined();
    expect(res.body.datos.usuario.correo).toBe(testEmail);

    accessToken = res.body.datos.accessToken;

    const cookies = res.headers["set-cookie"];
    expect(cookies).toBeDefined();
    const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
    refreshTokenCookie = cookieArray.find((c: string) => c.startsWith("refreshToken=")) || "";
    expect(refreshTokenCookie).toBeDefined();

    // Guardar valor del primer refresh token para probar ataque de reuso después
    const match = refreshTokenCookie.match(/refreshToken=([^;]+)/);
    firstRefreshTokenValue = match ? match[1] : "";
  });

  it("4. Debe rechazar login con contraseña incorrecta (401)", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({
        correo: testEmail,
        password: "WrongPassword999!",
      });

    expect(res.status).toBe(401);
    expect(res.body.exito).toBe(false);
  });

  it("5. Debe permitir acceder al perfil /yo con token válido (200)", async () => {
    const res = await request(app)
      .get("/api/v1/auth/yo")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
    expect(res.body.datos.correo).toBe(testEmail);
    expect(res.body.datos.rol).toBe("Cliente");
  });

  it("6. Debe rechazar /yo si no se envía token (401)", async () => {
    const res = await request(app).get("/api/v1/auth/yo");
    expect(res.status).toBe(401);
  });

  it("7. Debe rotar el refresh token y emitir nuevo accessToken (200)", async () => {
    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", [refreshTokenCookie]);

    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
    expect(res.body.datos.accessToken).toBeDefined();

    // El nuevo access token debe ser diferente
    expect(res.body.datos.accessToken).not.toBe(accessToken);

    // Debe haber entregado una cookie con un refresh token nuevo
    const newCookies = res.headers["set-cookie"];
    expect(newCookies).toBeDefined();

    // 7b. Simulación de múltiples recargas (F5) consecutivas en el navegador
    let cookieActual = newCookies;
    for (let i = 1; i <= 3; i++) {
      const reloadRes = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", cookieActual);
      expect(reloadRes.status).toBe(200);
      expect(reloadRes.body.exito).toBe(true);
      cookieActual = reloadRes.headers["set-cookie"];
    }
  });

  it("8. SEGURIDAD: Debe detectar REUSO del refresh token anterior y revocar la familia", async () => {
    // Intentamos reutilizar el primer refresh token que ya fue rotado
    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: firstRefreshTokenValue });

    // La base de datos detecta el reuso (RF-01) y revoca toda la familia
    expect([401, 403]).toContain(res.status);
    expect(res.body.exito).toBe(false);
  });

  it("9. Debe cerrar sesión correctamente con logout (200)", async () => {
    const res = await request(app)
      .post("/api/v1/auth/logout")
      .set("Cookie", [refreshTokenCookie]);

    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
  });
});
