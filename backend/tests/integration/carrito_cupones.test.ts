import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";
import { getDbPool, closeDbPool } from "../../src/config/database";

describe("Módulo de Carrito de Compras y Cupones ", () => {
  const app = createApp();

  let adminAccessToken: string;
  let clienteAccessToken: string;
  let idVariantePrueba: number;
  let idCategoriaPrueba: number;
  let codigoCuponValido: string;
  let codigoCuponMinimoAlto: string;
  let guestCookie: string;

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

    // 2. Registrar cliente de prueba
    const resCliente = await request(app)
      .post("/api/v1/auth/registro")
      .send({
        nombre: "Cliente",
        apellido: "Carrito",
        correo: `cliente.carrito.${timestamp}@shopcart.com`,
        password: "Password123!",
        telefono: "+50255557890",
      });

    expect(resCliente.status).toBe(201);
    clienteAccessToken = resCliente.body.datos.accessToken;

    // 3. Crear Categoría y Producto con Variante
    const resCat = await request(app)
      .post("/api/v1/catalogo/categorias")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        nombre: `Cat Carrito ${timestamp}`,
        slug: `cat-cart-${timestamp}`,
      });
    idCategoriaPrueba = resCat.body.datos.idCategoria;

    const resProd = await request(app)
      .post("/api/v1/catalogo/productos")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        idCategoria: idCategoriaPrueba,
        nombre: `Producto Test Carrito ${timestamp}`,
        slug: `prod-cart-${timestamp}`,
        marca: "ShopCart Essentials",
        variantes: [
          {
            sku: `SKU-CART-${timestamp}`,
            precio: 100.0, // Q100.00
            costo: 50.0,
            pesoGramos: 300,
            atributos: [],
          },
        ],
      });

    idVariantePrueba = resProd.body.datos.variantes[0].idVariante;

    // 4. Dotar de existencia en Kardex: 5 unidades disponibles exactamente
    await request(app)
      .post("/api/v1/inventario/entrada")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        idVariante: idVariantePrueba,
        cantidad: 5,
        motivo: "Stock inicial para pruebas de carrito",
      });

    // 5. Crear Cupones de prueba
    codigoCuponValido = `DESC10_${timestamp}`;
    await request(app)
      .post("/api/v1/cupones")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        codigo: codigoCuponValido,
        descripcion: "10% de descuento sin mínimo",
        tipoDescuento: "PORCENTAJE",
        valorDescuento: 10,
        alcance: "CARRITO",
        montoMinimoCompra: 0,
        fechaInicio: new Date(Date.now() - 3600000).toISOString(),
        fechaFin: new Date(Date.now() + 86400000).toISOString(),
      });

    codigoCuponMinimoAlto = `MIN500_${timestamp}`;
    await request(app)
      .post("/api/v1/cupones")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        codigo: codigoCuponMinimoAlto,
        descripcion: "Descuento con mínimo de Q500",
        tipoDescuento: "MONTO",
        valorDescuento: 50,
        alcance: "CARRITO",
        montoMinimoCompra: 500,
        fechaInicio: new Date(Date.now() - 3600000).toISOString(),
        fechaFin: new Date(Date.now() + 86400000).toISOString(),
      });
  });

  afterAll(async () => {
    await closeDbPool();
  });

  /* =========================================================================
     1. GESTIÓN DE CARRITO (INVITADO Y CLIENTE)
     ========================================================================= */

  it("1. Debe obtener o inicializar carrito de invitado y emitir cookie HttpOnly (200)", async () => {
    const res = await request(app).get("/api/v1/carrito");

    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
    expect(res.body.datos.items).toEqual([]);
    expect(res.body.datos.total).toBe(0);

    // Verificar cookie de invitado
    const cookies = res.headers["set-cookie"];
    expect(cookies).toBeDefined();
    const cookiesArray = Array.isArray(cookies) ? cookies : [cookies as string];
    const cartCookie = cookiesArray.find((c: string) => c.includes("shopcart_cart_token"));
    expect(cartCookie).toBeDefined();
    guestCookie = cartCookie!.split(";")[0];
  });

  it("2. Debe agregar un producto al carrito de invitado con existencia disponible (201)", async () => {
    const res = await request(app)
      .post("/api/v1/carrito/items")
      .set("Cookie", guestCookie)
      .send({
        idVariante: idVariantePrueba,
        cantidad: 2,
      });

    expect(res.status).toBe(201);
    expect(res.body.exito).toBe(true);
    expect(res.body.datos.items.length).toBe(1);
    expect(res.body.datos.items[0].idVariante).toBe(idVariantePrueba);
    expect(res.body.datos.items[0].cantidad).toBe(2);
    expect(res.body.datos.subtotal).toBe(200); // 2 * Q100
    expect(res.body.datos.total).toBe(200);
  });

  it("3. Debe rechazar agregar más cantidad que la existencia disponible (409)", async () => {
    // Tenemos 5 unidades en total, 2 ya en el carrito. Intentar agregar 4 más (total 6 > 5)
    const res = await request(app)
      .post("/api/v1/carrito/items")
      .set("Cookie", guestCookie)
      .send({
        idVariante: idVariantePrueba,
        cantidad: 4,
      });

    expect(res.status).toBe(409);
    expect(res.body.mensaje).toMatch(/existencia disponible/i);
  });

  it("4. Debe modificar la cantidad respetando la existencia disponible (200)", async () => {
    const res = await request(app)
      .put(`/api/v1/carrito/items/${idVariantePrueba}`)
      .set("Cookie", guestCookie)
      .send({
        cantidad: 3,
      });

    expect(res.status).toBe(200);
    expect(res.body.datos.items[0].cantidad).toBe(3);
    expect(res.body.datos.subtotal).toBe(300); // 3 * Q100
  });

  it("5. Debe rechazar modificar cantidad si supera la existencia disponible (409)", async () => {
    // Intentar cambiar a 10 unidades cuando solo hay 5
    const res = await request(app)
      .put(`/api/v1/carrito/items/${idVariantePrueba}`)
      .set("Cookie", guestCookie)
      .send({
        cantidad: 10,
      });

    expect(res.status).toBe(409);
    expect(res.body.mensaje).toMatch(/existencia disponible/i);
  });

  /* =========================================================================
     2. APLICACIÓN DE CUPONES Y DESCUENTOS 
     ========================================================================= */

  it("6. Debe aplicar un cupón válido y calcular descuento y total sin errores de redondeo (200)", async () => {
    const res = await request(app)
      .post("/api/v1/carrito/cupon")
      .set("Cookie", guestCookie)
      .send({
        codigo: codigoCuponValido,
      });

    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
    expect(res.body.datos.codigoCupon).toBe(codigoCuponValido);
    expect(res.body.datos.subtotal).toBe(300);
    expect(res.body.datos.descuento).toBe(30); // 10% de Q300 = Q30
    expect(res.body.datos.total).toBe(270); // Q300 - Q30 = Q270
  });

  it("7. Debe rechazar un cupón si no cumple el monto mínimo de compra (409)", async () => {
    const res = await request(app)
      .post("/api/v1/carrito/cupon")
      .set("Cookie", guestCookie)
      .send({
        codigo: codigoCuponMinimoAlto, // Exige Q500, el carrito tiene Q300
      });

    expect(res.status).toBe(409);
    expect(res.body.mensaje).toMatch(/monto mínimo/i);
  });

  it("8. Debe rechazar un cupón inexistente (409)", async () => {
    const res = await request(app)
      .post("/api/v1/carrito/cupon")
      .set("Cookie", guestCookie)
      .send({
        codigo: "CUPON_FANTASMA_123",
      });

    expect(res.status).toBe(409);
    expect(res.body.mensaje).toMatch(/no existe/i);
  });

  it("9. Debe remover el cupón del carrito exitosamente (200)", async () => {
    const res = await request(app)
      .delete("/api/v1/carrito/cupon")
      .set("Cookie", guestCookie);

    expect(res.status).toBe(200);
    expect(res.body.datos.codigoCupon).toBeNull();
    expect(res.body.datos.descuento).toBe(0);
    expect(res.body.datos.total).toBe(300);
  });

  /* =========================================================================
     3. ELIMINACIÓN Y MIGRACIÓN DE INVITADO A USUARIO
     ========================================================================= */

  it("10. Debe eliminar un producto específico del carrito (200)", async () => {
    const res = await request(app)
      .delete(`/api/v1/carrito/items/${idVariantePrueba}`)
      .set("Cookie", guestCookie);

    expect(res.status).toBe(200);
    expect(res.body.datos.items.length).toBe(0);
    expect(res.body.datos.total).toBe(0);
  });

  it("11. Debe migrar un carrito de invitado al autenticarse el cliente (200)", async () => {
    // 1. Agregar ítem en carrito de invitado
    const tokenInvitado = "token_invitado_temporal_123456";
    await request(app)
      .post("/api/v1/carrito/items")
      .set("x-cart-token", tokenInvitado)
      .send({
        idVariante: idVariantePrueba,
        cantidad: 1,
      });

    // 2. Migrarlo a la cuenta del cliente
    const resMigrar = await request(app)
      .post("/api/v1/carrito/migrar")
      .set("Authorization", `Bearer ${clienteAccessToken}`)
      .send({
        tokenInvitado,
      });

    expect(resMigrar.status).toBe(200);
    expect(resMigrar.body.datos.items.length).toBe(1);
    expect(resMigrar.body.datos.items[0].cantidad).toBe(1);
  });
});
