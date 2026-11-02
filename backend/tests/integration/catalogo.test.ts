import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";
import { getDbPool, closeDbPool } from "../../src/config/database";

describe("Módulo de Catálogo de Productos y Categorías ", () => {
  const app = createApp();

  let adminAccessToken: string;
  let clienteAccessToken: string;
  let idCategoriaCreada: number;
  let idProductoCreado: number;
  let idVarianteCreada: number;
  let idAtributoCreado: number;
  let idValorAtributoCreado: number;
  let slugProductoCreado: string;

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
        apellido: "Catalogo",
        correo: `cliente.catalogo.${timestamp}@shopcart.com`,
        password: "Password123!",
        telefono: "+50255551234",
      });

    expect(resCliente.status).toBe(201);
    clienteAccessToken = resCliente.body.datos.accessToken;
  });

  afterAll(async () => {
    await closeDbPool();
  });

  /* =========================================================================
     1. PRUEBAS DE CATEGORÍAS
     ========================================================================= */

  it("1. Debe listar categorías públicamente sin necesidad de token (200)", async () => {
    const res = await request(app).get("/api/v1/catalogo/categorias");
    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
    expect(Array.isArray(res.body.datos)).toBe(true);
  });

  it("2. Debe rechazar la creación de categorías a usuarios no autorizados (401/403)", async () => {
    // Sin token -> 401
    const res401 = await request(app)
      .post("/api/v1/catalogo/categorias")
      .send({ nombre: "Intruso Cat" });
    expect(res401.status).toBe(401);

    // Con rol Cliente -> 403
    const res403 = await request(app)
      .post("/api/v1/catalogo/categorias")
      .set("Authorization", `Bearer ${clienteAccessToken}`)
      .send({ nombre: "Intruso Cat" });
    expect(res403.status).toBe(403);
  });

  it("3. Debe crear una categoría correctamente con rol Administrador (201)", async () => {
    const res = await request(app)
      .post("/api/v1/catalogo/categorias")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        nombre: `Electrónica Test ${timestamp}`,
        slug: `electronica-test-${timestamp}`,
        descripcion: "Categoría de prueba automatizada",
        ordenVisual: 1,
      });

    expect(res.status).toBe(201);
    expect(res.body.exito).toBe(true);
    expect(res.body.datos.idCategoria).toBeDefined();
    expect(res.body.datos.nombre).toBe(`Electrónica Test ${timestamp}`);
    idCategoriaCreada = res.body.datos.idCategoria;
  });

  it("4. Debe rechazar categoría con slug duplicado (409)", async () => {
    const res = await request(app)
      .post("/api/v1/catalogo/categorias")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        nombre: `Otra Electrónica ${timestamp}`,
        slug: `electronica-test-${timestamp}`, // Mismo slug
        descripcion: "Debe fallar por unicidad",
      });

    expect(res.status).toBe(409);
    expect(res.body.exito).toBe(false);
  });

  it("5. Debe actualizar datos de una categoría existente (200)", async () => {
    const res = await request(app)
      .put(`/api/v1/catalogo/categorias/${idCategoriaCreada}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        nombre: `Electrónica Actualizada ${timestamp}`,
        slug: `electronica-act-${timestamp}`,
        descripcion: "Descripción actualizada",
        ordenVisual: 2,
      });

    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
    expect(res.body.datos.nombre).toBe(`Electrónica Actualizada ${timestamp}`);
  });

  it("6. Debe cambiar el estado activo/inactivo de una categoría (200)", async () => {
    const res = await request(app)
      .patch(`/api/v1/catalogo/categorias/${idCategoriaCreada}/estado`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ estaActiva: false });

    expect(res.status).toBe(200);
    expect(res.body.datos.estaActiva).toBe(false);

    // Reactivar para asociar productos en pruebas posteriores
    const resReactivar = await request(app)
      .patch(`/api/v1/catalogo/categorias/${idCategoriaCreada}/estado`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ estaActiva: true });

    expect(resReactivar.status).toBe(200);
    expect(resReactivar.body.datos.estaActiva).toBe(true);
  });

  /* =========================================================================
     2. PRUEBAS DE ATRIBUTOS Y VALORES
     ========================================================================= */

  it("7. Debe registrar un atributo y un valor para variantes (201)", async () => {
    const resAtr = await request(app)
      .post("/api/v1/catalogo/atributos")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ nombre: `Talla Test ${timestamp}` });

    expect(resAtr.status).toBe(201);
    idAtributoCreado = resAtr.body.datos.idAtributo;

    const resVal = await request(app)
      .post(`/api/v1/catalogo/atributos/${idAtributoCreado}/valores`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ valor: "M", ordenVisual: 1 });

    expect(resVal.status).toBe(201);
    idValorAtributoCreado = resVal.body.datos.idValorAtributo;
  });

  it("8. Debe listar atributos con sus valores estructurados (200)", async () => {
    const res = await request(app).get("/api/v1/catalogo/atributos");
    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
    const encontrado = res.body.datos.find((a: any) => a.idAtributo === idAtributoCreado);
    expect(encontrado).toBeDefined();
    expect(encontrado.valores.length).toBeGreaterThanOrEqual(1);
  });

  /* =========================================================================
     3. PRUEBAS DE PRODUCTOS Y VARIANTES
     ========================================================================= */

  it("9. Debe crear un producto con variantes e imágenes (201)", async () => {
    const sku1 = `SKU-TST-${timestamp}-A`;
    const sku2 = `SKU-TST-${timestamp}-B`;
    slugProductoCreado = `laptop-pro-test-${timestamp}`;

    const res = await request(app)
      .post("/api/v1/catalogo/productos")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        idCategoria: idCategoriaCreada,
        nombre: `Laptop Pro Test ${timestamp}`,
        slug: slugProductoCreado,
        descripcion: "Laptop ultrabook de alta gama para desarrollo",
        marca: "ShopBrand",
        variantes: [
          {
            sku: sku1,
            precio: 8500.5,
            costo: 6500.0,
            pesoGramos: 1400,
            atributos: [
              { idAtributo: idAtributoCreado, idValorAtributo: idValorAtributoCreado },
            ],
          },
          {
            sku: sku2,
            precio: 9200.0,
            costo: 7200.0,
            pesoGramos: 1450,
            atributos: [],
          },
        ],
        imagenes: [
          {
            url: "https://shopcart.com/img/laptop-1.jpg",
            ordenVisual: 1,
            esPrincipal: true,
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.exito).toBe(true);
    expect(res.body.datos.idProducto).toBeDefined();
    expect(res.body.datos.variantes.length).toBe(2);
    expect(res.body.datos.imagenes.length).toBe(1);

    idProductoCreado = res.body.datos.idProducto;
    idVarianteCreada = res.body.datos.variantes[0].idVariante;
  });

  it("10. Debe rechazar la creación de producto con SKU duplicado (409)", async () => {
    const res = await request(app)
      .post("/api/v1/catalogo/productos")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        idCategoria: idCategoriaCreada,
        nombre: `Laptop Clon ${timestamp}`,
        slug: `laptop-clon-${timestamp}`,
        variantes: [
          {
            sku: `SKU-TST-${timestamp}-A`, // SKU ya existente
            precio: 5000,
          },
        ],
      });

    expect(res.status).toBe(409);
    expect(res.body.exito).toBe(false);
  });

  it("11. Debe obtener detalle de producto por ID y por Slug (200)", async () => {
    // Por ID
    const resPorId = await request(app).get(`/api/v1/catalogo/productos/${idProductoCreado}`);
    expect(resPorId.status).toBe(200);
    expect(resPorId.body.datos.idProducto).toBe(idProductoCreado);
    expect(resPorId.body.datos.variantes[0].sku).toBe(`SKU-TST-${timestamp}-A`);

    // Por Slug
    const resPorSlug = await request(app).get(`/api/v1/catalogo/productos/${slugProductoCreado}`);
    expect(resPorSlug.status).toBe(200);
    expect(resPorSlug.body.datos.slug).toBe(slugProductoCreado);
  });

  it("12. Debe listar el catálogo paginado con filtros de búsqueda y categoría (200)", async () => {
    const res = await request(app).get(
      `/api/v1/catalogo/productos?busqueda=Laptop&idCategoria=${idCategoriaCreada}&pagina=1&limite=10`
    );

    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
    expect(res.body.paginacion.totalRegistros).toBeGreaterThanOrEqual(1);

    const prod = res.body.datos.find((p: any) => p.idProducto === idProductoCreado);
    expect(prod).toBeDefined();
    expect(prod.precioMinimo).toBe(8500.5);
    expect(prod.precioMaximo).toBe(9200.0);
    expect(prod.totalVariantes).toBe(2);
  });

  it("13. Debe actualizar la información general de un producto (200)", async () => {
    const res = await request(app)
      .put(`/api/v1/catalogo/productos/${idProductoCreado}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        idCategoria: idCategoriaCreada,
        nombre: `Laptop Pro Test Modificada ${timestamp}`,
        slug: slugProductoCreado,
        descripcion: "Descripción actualizada para pruebas",
        marca: "ShopBrand Ultra",
      });

    expect(res.status).toBe(200);
    expect(res.body.datos.nombre).toBe(`Laptop Pro Test Modificada ${timestamp}`);
    expect(res.body.datos.marca).toBe("ShopBrand Ultra");
  });

  it("14. Debe actualizar precio y costo de una variante (200)", async () => {
    const res = await request(app)
      .patch(`/api/v1/catalogo/variantes/${idVarianteCreada}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        precio: 8999.99,
        costo: 6800.0,
        pesoGramos: 1420,
        estaActiva: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.datos.precio).toBe(8999.99);
    expect(res.body.datos.costo).toBe(6800.0);
  });

  it("15. Debe rechazar precio de variante menor o igual a 0 (422/400)", async () => {
    const res = await request(app)
      .patch(`/api/v1/catalogo/variantes/${idVarianteCreada}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        precio: -10,
      });

    expect([400, 422]).toContain(res.status);
    expect(res.body.exito).toBe(false);
  });

  it("16. Debe realizar borrado lógico (desactivar producto) y reflejarlo en bitácora (200)", async () => {
    const res = await request(app)
      .patch(`/api/v1/catalogo/productos/${idProductoCreado}/estado`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ estaActivo: false });

    expect(res.status).toBe(200);
    expect(res.body.datos.estaActivo).toBe(false);

    // Al filtrar soloActivos=true, no debe aparecer en catálogo público
    const resCatalogoPublico = await request(app).get(
      `/api/v1/catalogo/productos?idCategoria=${idCategoriaCreada}&soloActivos=true`
    );
    const encontrado = resCatalogoPublico.body.datos.find((p: any) => p.idProducto === idProductoCreado);
    expect(encontrado).toBeUndefined();

    // Pero con soloActivos=false (consola administrativa) sí aparece
    const resAdminCatalogo = await request(app).get(
      `/api/v1/catalogo/productos?idCategoria=${idCategoriaCreada}&soloActivos=false`
    );
    const encontradoAdmin = resAdminCatalogo.body.datos.find((p: any) => p.idProducto === idProductoCreado);
    expect(encontradoAdmin).toBeDefined();
    expect(encontradoAdmin.estaActivo).toBe(false);
  });

  it("17. Debe subir y optimizar una imagen convirtiéndola a WebP (201)", async () => {
    // 1x1 píxel PNG válido en Base64
    const pngBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );

    const res = await request(app)
      .post("/api/v1/catalogo/imagenes/subir")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .attach("imagen", pngBuffer, "foto-prueba.png");

    expect(res.status).toBe(201);
    expect(res.body.exito).toBe(true);
    expect(res.body.datos.url).toBeDefined();
    expect(res.body.datos.url).toMatch(/^\/uploads\/productos\/[a-f0-9-]+\.webp$/);
  });
});
