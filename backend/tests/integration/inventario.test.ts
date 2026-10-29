import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";
import { getDbPool, closeDbPool } from "../../src/config/database";

describe("Módulo de Control de Inventario y Kardex (RF-03, RF-09)", () => {
  const app = createApp();

  let adminAccessToken: string;
  let clienteAccessToken: string;
  let idVariantePrueba: number;

  const timestamp = Date.now();

  beforeAll(async () => {
    await getDbPool();

    // 1. Obtener token de Administrador
    const resAdmin = await request(app)
      .post("/api/v1/auth/login")
      .send({
        correo: "admin@shopcart.com",
        password: "Admin1234!",
      });

    expect(resAdmin.status).toBe(200);
    adminAccessToken = resAdmin.body.datos.accessToken;

    // 2. Registrar y obtener token de Cliente
    const resCliente = await request(app)
      .post("/api/v1/auth/registro")
      .send({
        nombre: "Cliente",
        apellido: "Inventario",
        correo: `cliente.inventario.${timestamp}@shopcart.com`,
        password: "Password123!",
        telefono: "+50255554321",
      });

    expect(resCliente.status).toBe(201);
    clienteAccessToken = resCliente.body.datos.accessToken;

    // 3. Crear una categoría y un producto con variante para pruebas aisladas
    const resCat = await request(app)
      .post("/api/v1/catalogo/categorias")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        nombre: `Cat Inv ${timestamp}`,
        slug: `cat-inv-${timestamp}`,
        descripcion: "Categoría para pruebas de inventario",
      });
    const idCategoria = resCat.body.datos.idCategoria;

    const resProd = await request(app)
      .post("/api/v1/catalogo/productos")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        idCategoria,
        nombre: `Producto Test Inventario ${timestamp}`,
        slug: `prod-inv-${timestamp}`,
        descripcion: "Producto de prueba para kardex",
        marca: "ShopCart Lab",
        variantes: [
          {
            sku: `SKU-INV-${timestamp}`,
            precio: 150.0,
            costo: 80.0,
            pesoGramos: 500,
            atributos: [],
          },
        ],
      });

    expect(resProd.status).toBe(201);
    idVariantePrueba = resProd.body.datos.variantes[0].idVariante;
    expect(idVariantePrueba).toBeDefined();
  });

  afterAll(async () => {
    await closeDbPool();
  });

  /* =========================================================================
     1. CONTROL DE ACCESO Y SEGURIDAD POR ROL
     ========================================================================= */

  it("1. Debe rechazar consulta de inventario a usuarios sin autenticación (401)", async () => {
    const res = await request(app).get("/api/v1/inventario");
    expect(res.status).toBe(401);
  });

  it("2. Debe denegar acceso a clientes en módulo administrativo de inventario (403)", async () => {
    const res = await request(app)
      .get("/api/v1/inventario")
      .set("Authorization", `Bearer ${clienteAccessToken}`);
    expect(res.status).toBe(403);
  });

  /* =========================================================================
     2. GESTIÓN DE EXISTENCIAS Y ENTRADAS (COMPRAS)
     ========================================================================= */

  it("3. Debe consultar existencias paginadas con token de Administrador (200)", async () => {
    const res = await request(app)
      .get("/api/v1/inventario")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .query({ pagina: 1, limite: 10 });

    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
    expect(Array.isArray(res.body.datos)).toBe(true);
    expect(res.body.paginacion).toBeDefined();
  });

  it("4. Debe consultar el detalle de stock de una variante específica (200)", async () => {
    const res = await request(app)
      .get(`/api/v1/inventario/variante/${idVariantePrueba}`)
      .set("Authorization", `Bearer ${adminAccessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
    expect(res.body.datos.idVariante).toBe(idVariantePrueba);
    expect(res.body.datos.existencia).toBe(0);
    expect(res.body.datos.cantidadDisponible).toBe(0);
    expect(res.body.datos.estadoStock).toBe("AGOTADO");
  });

  it("5. Debe registrar una entrada de mercancía exitosa en kardex (201)", async () => {
    const res = await request(app)
      .post("/api/v1/inventario/entrada")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        idVariante: idVariantePrueba,
        cantidad: 50,
        motivo: "Recepción de compra inicial de lote de prueba",
      });

    expect(res.status).toBe(201);
    expect(res.body.exito).toBe(true);
    expect(res.body.datos.existencia).toBe(50);
    expect(res.body.datos.cantidadDisponible).toBe(50);
    expect(res.body.datos.cantidadReservada).toBe(0);
  });

  it("6. Debe rechazar entrada con cantidad menor o igual a cero (422)", async () => {
    const res = await request(app)
      .post("/api/v1/inventario/entrada")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        idVariante: idVariantePrueba,
        cantidad: 0,
        motivo: "Cantidad inválida",
      });

    expect(res.status).toBe(422);
  });

  /* =========================================================================
     3. AJUSTES MANUALES Y REGLAS DE NEGOCIO (RF-03)
     ========================================================================= */

  it("7. Debe registrar un ajuste manual positivo con motivo obligatorio (200)", async () => {
    const res = await request(app)
      .post("/api/v1/inventario/ajuste")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        idVariante: idVariantePrueba,
        cantidad: 10,
        motivo: "Ajuste por conteo físico: se encontraron 10 unidades adicionales",
      });

    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
    expect(res.body.datos.existencia).toBe(60); // 50 previas + 10
    expect(res.body.datos.cantidadDisponible).toBe(60);
  });

  it("8. Debe registrar un ajuste manual negativo válido (200)", async () => {
    const res = await request(app)
      .post("/api/v1/inventario/ajuste")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        idVariante: idVariantePrueba,
        cantidad: -5,
        motivo: "Merma por daño de empaque durante inspección",
      });

    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
    expect(res.body.datos.existencia).toBe(55); // 60 - 5
  });

  it("9. CRITERIO CRÍTICO RF-03: Debe rechazar un ajuste que deje la existencia en negativo (409)", async () => {
    const res = await request(app)
      .post("/api/v1/inventario/ajuste")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        idVariante: idVariantePrueba,
        cantidad: -100, // Intentar restar 100 teniendo solo 55
        motivo: "Intento de ajuste excedente",
      });

    expect(res.status).toBe(409);
    expect(res.body.mensaje).toMatch(/negativo/i);
  });

  it("10. Debe rechazar ajuste sin motivo justificado (422)", async () => {
    const res = await request(app)
      .post("/api/v1/inventario/ajuste")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        idVariante: idVariantePrueba,
        cantidad: 5,
        motivo: "",
      });

    expect(res.status).toBe(422);
  });

  /* =========================================================================
     4. PUNTO DE REORDEN Y KARDEX HISTÓRICO
     ========================================================================= */

  it("11. Debe actualizar el punto de reorden y recalcular alerta de stock (200)", async () => {
    const res = await request(app)
      .put("/api/v1/inventario/punto-reorden")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        idVariante: idVariantePrueba,
        puntoReorden: 60, // Existencia actual es 55, por lo tanto <= 60 => BAJO_STOCK
      });

    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
    expect(res.body.datos.puntoReorden).toBe(60);
    expect(res.body.datos.estadoStock).toBe("BAJO_STOCK");
  });

  it("12. Debe consultar el kardex y validar que la existencia coincide con movimientos (200)", async () => {
    const res = await request(app)
      .get("/api/v1/inventario/kardex")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .query({ idVariante: idVariantePrueba });

    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
    expect(res.body.datos.length).toBe(3); // Entrada (+50), Ajuste (+10), Ajuste (-5)

    const movimientos = res.body.datos;
    // El orden es cronológico descendente (último primero)
    expect(movimientos[0].tipoMovimiento).toBe("AJUSTE_NEGATIVO");
    expect(movimientos[0].cantidad).toBe(-5);
    expect(movimientos[0].existenciaPosterior).toBe(55);

    expect(movimientos[1].tipoMovimiento).toBe("AJUSTE_POSITIVO");
    expect(movimientos[1].cantidad).toBe(10);
    expect(movimientos[1].existenciaPosterior).toBe(60);

    expect(movimientos[2].tipoMovimiento).toBe("ENTRADA_COMPRA");
    expect(movimientos[2].cantidad).toBe(50);
    expect(movimientos[2].existenciaPosterior).toBe(50);

    // Suma de movimientos coincide con la existencia final (50 + 10 - 5 = 55)
    const sumaMovimientos = movimientos.reduce((acc: number, m: any) => acc + m.cantidad, 0);
    expect(sumaMovimientos).toBe(55);
  });
});
