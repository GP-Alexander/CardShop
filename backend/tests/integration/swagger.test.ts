import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";

describe("Documentación Interactiva Swagger / OpenAPI", () => {
  const app = createApp();

  it("Debe servir la especificación OpenAPI en formato JSON (/api/docs.json)", async () => {
    const res = await request(app).get("/api/docs.json");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/json");
    expect(res.body.openapi).toBe("3.0.3");
    expect(res.body.info.title).toContain("ShopCart API");
    expect(res.body.paths).toHaveProperty("/auth/login");
    expect(res.body.paths).toHaveProperty("/catalogo/productos");
  });

  it("Debe servir la interfaz HTML de Swagger UI (/api/docs/)", async () => {
    const res = await request(app).get("/api/docs/");
    expect(res.status).toBe(200);
    expect(res.text).toContain("swagger-ui");
  });

  it("Debe redirigir /docs hacia /api/docs", async () => {
    const res = await request(app).get("/docs");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/api/docs");
  });
});
