export const swaggerSpec = {
  openapi: "3.0.3",
  info: {
    title: "ShopCart API — Plataforma B2C E-Commerce",
    version: "1.0.0",
    description: `
## Tech Challenge 360 — Grupo Pentandra

API REST de comercio electrónico construida con **Node.js 24 LTS**, **Express**, **TypeScript (Strict Mode)** y **Microsoft SQL Server 2022**.

### Aspectos Destacados de la Arquitectura:
- **Cero ORMs y Cero SQL Dinámico sin parametrizar:** El acceso a datos se realiza exclusivamente mediante Stored Procedures (\`dbo.SP_*\`).
- **Control de Acceso Basado en Roles (RBAC):** Roles \`Administrador\`, \`Operador\` y \`Cliente\` con protección estricta contra IDOR.
- **Criptografía OWASP:** Contraseñas protegidas exclusivamente mediante **Argon2id**.
- **Sesiones Seguras:** Access Token JWT de 15 minutos y Refresh Token con rotación y persistencia.
- **Inmutabilidad:** Triggers en base de datos protegen Kardex, Bitácora y Transiciones de Pedidos contra modificaciones o eliminaciones.

---

### Credenciales de Demostración Disponibles:

| Rol | Correo Electrónico | Contraseña | Permisos |
|---|---|---|---|
| **Administrador** | \`admin@shopcart.com\` | \`Admin1234!\` | Control total: catálogo, usuarios, auditoría, reportes |
| **Operador** | \`operador@shopcart.com\` | \`Operador1234!\` | Preparación y despacho de pedidos, kardex de almacén |
| **Cliente** | \`cliente@shopcart.com\` | \`Cliente1234!\` | Carrito, pedidos propios, checkout, direcciones |

> **Instrucciones de Autorización:**
> 1. Ejecuta el endpoint **POST /auth/login** con cualquiera de las credenciales anteriores.
> 2. Copia el valor de \`accessToken\` de la respuesta.
> 3. Haz clic en el botón verde **Authorize** (arriba a la derecha), escribe el token y pulsa **Authorize**.
    `,
    contact: {
      name: "ShopCart Development Team",
    },
  },
  servers: [
    {
      url: "/api/v1",
      description: "Servidor API v1 (Local)",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Ingresa el JWT Access Token obtenido tras iniciar sesión en /auth/login",
      },
    },
    schemas: {
      RespuestaError: {
        type: "object",
        properties: {
          exito: { type: "boolean", example: false },
          mensaje: { type: "string", example: "Descripción del error ocurrido" },
          codigo: { type: "string", example: "ERROR_VALIDACION" },
          detalles: {
            type: "array",
            items: { type: "object" },
          },
        },
      },
      LoginInput: {
        type: "object",
        required: ["correo", "password"],
        properties: {
          correo: { type: "string", format: "email", example: "admin@shopcart.com" },
          password: { type: "string", format: "password", example: "Admin1234!" },
        },
      },
      RegistroClienteInput: {
        type: "object",
        required: ["nombres", "apellidos", "correo", "password"],
        properties: {
          nombres: { type: "string", example: "Carlos" },
          apellidos: { type: "string", example: "Gómez" },
          correo: { type: "string", format: "email", example: "carlos.gomez@ejemplo.com" },
          password: { type: "string", format: "password", example: "Password123!" },
          telefono: { type: "string", example: "55551234" },
        },
      },
      CrearUsuarioInternoInput: {
        type: "object",
        required: ["nombres", "apellidos", "correo", "password", "nombreRol"],
        properties: {
          nombres: { type: "string", example: "Marcos" },
          apellidos: { type: "string", example: "Alvarado" },
          correo: { type: "string", format: "email", example: "marcos.operador@shopcart.com" },
          password: { type: "string", format: "password", example: "Operador2026!" },
          nombreRol: { type: "string", enum: ["Operador", "Administrador"], example: "Operador" },
          telefono: { type: "string", example: "44445555" },
        },
      },
      CrearCategoriaInput: {
        type: "object",
        required: ["nombre"],
        properties: {
          nombre: { type: "string", example: "Calzado Deportivo" },
          slug: { type: "string", example: "calzado-deportivo" },
          descripcion: { type: "string", example: "Zapatillas y calzado para atletismo y deportes" },
          idCategoriaPadre: { type: "integer", nullable: true, example: null },
          ordenVisual: { type: "integer", example: 1 },
        },
      },
      CrearProductoInput: {
        type: "object",
        required: ["nombre", "idCategoria", "variantes"],
        properties: {
          nombre: { type: "string", example: "Zapatillas Running Pro 2026" },
          slug: { type: "string", example: "zapatillas-running-pro-2026" },
          descripcion: { type: "string", example: "Zapatillas ergonómicas con suela amortiguada" },
          idCategoria: { type: "integer", example: 1 },
          variantes: {
            type: "array",
            items: {
              type: "object",
              required: ["sku", "precio"],
              properties: {
                sku: { type: "string", example: "ZAP-RUN-42-NEG" },
                precio: { type: "number", example: 499.00, description: "Precio en Quetzales (incluye IVA 12%)" },
                costo: { type: "number", example: 250.00 },
                pesoGramos: { type: "integer", example: 350 },
                atributos: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      idAtributo: { type: "integer", example: 1 },
                      idValorAtributo: { type: "integer", example: 2 },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  tags: [
    { name: "Salud del Sistema", description: "Verificación de uptime y estado de los servicios" },
    { name: "Autenticación & Sesiones", description: "Login, registro, refresh token y perfil (Argon2id + JWT)" },
    { name: "Usuarios & Roles (RF-01)", description: "Administración de identidades, privilegios RBAC y estado de cuentas" },
    { name: "Direcciones de Entrega", description: "Gestión de direcciones de envío del cliente (Anti-IDOR)" },
    { name: "Catálogo de Productos (RF-02)", description: "Productos, variantes, categorías jerárquicas y atributos" },
    { name: "Catálogos Base", description: "Geografía (Departamentos, Municipios) y Catálogos RBAC" },
    { name: "Inventario & Kardex (RF-03)", description: "Existencias por almacén, entradas de compra y kardex inmutable" },
    { name: "Carrito de Compras (RF-04)", description: "Operaciones del carrito activo y control de cantidades" },
    { name: "Cupones & Promociones (RF-04)", description: "Validación de cupones y límites de uso" },
    { name: "Checkout & Reservas (RF-05)", description: "Reserva temporal atómica (15 min) y checkout concurrente" },
    { name: "Pedidos & Pagos (RF-06)", description: "Creación de pedido, máquina de estados y confirmación de pago idempotente" },
    { name: "Devoluciones (RF-07)", description: "Gestión de devoluciones totales/parciales con reintegro a kardex" },
    { name: "Reportes & Analítica (RF-08)", description: "Dashboard ejecutivo con métricas de ventas y carritos abandonados" },
    { name: "Bitácora de Auditoría (RF-09)", description: "Registro inmutable de mutaciones blindado por trigger SQL" },
  ],
  paths: {
    "/health": {
      get: {
        tags: ["Salud del Sistema"],
        summary: "Verificar salud del servidor",
        description: "Comprueba el estado del backend, tiempo en línea y timestamp actual.",
        responses: {
          200: {
            description: "Servicio saludable",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "healthy" },
                    uptime: { type: "number", example: 120.45 },
                    timestamp: { type: "string", example: "2026-10-29T14:00:00.000Z" },
                  },
                },
              },
            },
          },
        },
      },
    },

    /* =========================================================
       AUTENTICACIÓN
       ========================================================= */
    "/auth/registro": {
      post: {
        tags: ["Autenticación & Sesiones"],
        summary: "Registrar nuevo cliente",
        description: "Crea una cuenta con rol Cliente. La contraseña se hashea con Argon2id.",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/RegistroClienteInput" } } },
        },
        responses: {
          201: { description: "Cliente registrado con éxito" },
          409: { description: "El correo electrónico ya se encuentra registrado" },
        },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Autenticación & Sesiones"],
        summary: "Iniciar sesión (Obtener JWT Access Token)",
        description: "Valida credenciales contra Argon2id. Devuelve el Access Token (15 min) y establece el Refresh Token en cookie HttpOnly.",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/LoginInput" } } },
        },
        responses: {
          200: {
            description: "Autenticación exitosa",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    exito: { type: "boolean", example: true },
                    datos: {
                      type: "object",
                      properties: {
                        usuario: { type: "object" },
                        accessToken: { type: "string", example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." },
                      },
                    },
                  },
                },
              },
            },
          },
          401: { description: "Credenciales inválidas" },
        },
      },
    },
    "/auth/perfil": {
      get: {
        tags: ["Autenticación & Sesiones"],
        summary: "Obtener perfil del usuario autenticado",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "Perfil del usuario con datos de sesión" },
          401: { description: "Token no proporcionado o expirado" },
        },
      },
    },
    "/auth/logout": {
      post: {
        tags: ["Autenticación & Sesiones"],
        summary: "Cerrar sesión segura",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "Sesión cerrada y refresh token revocado" },
        },
      },
    },

    /* =========================================================
       USUARIOS (RF-01)
       ========================================================= */
    "/usuarios": {
      get: {
        tags: ["Usuarios & Roles (RF-01)"],
        summary: "Listar usuarios paginados con filtros",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "pagina", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limite", in: "query", schema: { type: "integer", default: 10 } },
          { name: "busqueda", in: "query", schema: { type: "string" } },
          { name: "rol", in: "query", schema: { type: "string", enum: ["Cliente", "Operador", "Administrador"] } },
          { name: "estaActivo", in: "query", schema: { type: "boolean" } },
        ],
        responses: {
          200: { description: "Lista paginada de usuarios" },
          403: { description: "Acceso denegado (Requiere rol Operador o Administrador)" },
        },
      },
      post: {
        tags: ["Usuarios & Roles (RF-01)"],
        summary: "Dar de alta personal interno (Operador o Administrador)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CrearUsuarioInternoInput" } } },
        },
        responses: {
          201: { description: "Usuario corporativo creado exitosamente" },
          403: { description: "Exclusivo para rol Administrador" },
        },
      },
    },
    "/usuarios/{id}": {
      get: {
        tags: ["Usuarios & Roles (RF-01)"],
        summary: "Obtener expediente y detalle de usuario",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: {
          200: { description: "Datos detallados del usuario y sus direcciones" },
          404: { description: "Usuario no encontrado" },
        },
      },
    },
    "/usuarios/{id}/estado": {
      patch: {
        tags: ["Usuarios & Roles (RF-01)"],
        summary: "Activar o desactivar cuenta de usuario",
        description: "Al desactivar una cuenta, SQL Server revoca de inmediato todas las sesiones y tokens JWT asociados.",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", properties: { estaActivo: { type: "boolean" } } } } },
        },
        responses: {
          200: { description: "Estado actualizado exitosamente" },
        },
      },
    },

    /* =========================================================
       CATÁLOGO DE PRODUCTOS (RF-02)
       ========================================================= */
    "/catalogo/productos": {
      get: {
        tags: ["Catálogo de Productos (RF-02)"],
        summary: "Listar productos del catálogo público",
        description: "Búsqueda paginada con filtros por categoría, rango de precios y ordenamiento.",
        parameters: [
          { name: "pagina", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limite", in: "query", schema: { type: "integer", default: 12 } },
          { name: "busqueda", in: "query", schema: { type: "string" } },
          { name: "idCategoria", in: "query", schema: { type: "integer" } },
          { name: "precioMin", in: "query", schema: { type: "number" } },
          { name: "precioMax", in: "query", schema: { type: "number" } },
        ],
        responses: {
          200: { description: "Lista paginada de productos con variantes y precios en Quetzales" },
        },
      },
      post: {
        tags: ["Catálogo de Productos (RF-02)"],
        summary: "Crear producto con variantes atómicas",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CrearProductoInput" } } },
        },
        responses: {
          201: { description: "Producto registrado exitosamente" },
          403: { description: "Requiere rol Operador o Administrador" },
        },
      },
    },
    "/catalogo/productos/{idOrSlug}": {
      get: {
        tags: ["Catálogo de Productos (RF-02)"],
        summary: "Obtener detalle completo de un producto",
        parameters: [{ name: "idOrSlug", in: "path", required: true, schema: { type: "string" }, example: "1" }],
        responses: {
          200: { description: "Ficha del producto con galería de fotos, variantes y atributos" },
          404: { description: "Producto no encontrado" },
        },
      },
    },
    "/catalogo/categorias": {
      get: {
        tags: ["Catálogo de Productos (RF-02)"],
        summary: "Listar árbol jerárquico de categorías",
        parameters: [{ name: "soloActivas", in: "query", schema: { type: "boolean", default: false } }],
        responses: {
          200: { description: "Lista de categorías con jerarquías y slugs" },
        },
      },
      post: {
        tags: ["Catálogo de Productos (RF-02)"],
        summary: "Crear categoría de productos",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CrearCategoriaInput" } } },
        },
        responses: {
          201: { description: "Categoría creada con éxito" },
        },
      },
    },
    "/catalogo/atributos": {
      get: {
        tags: ["Catálogo de Productos (RF-02)"],
        summary: "Listar atributos y opciones parametrizables",
        description: "Obtiene las dimensiones configuradas (Talla, Color, etc.) y sus valores correspondientes.",
        responses: {
          200: { description: "Lista de atributos con sus valores asociados" },
        },
      },
      post: {
        tags: ["Catálogo de Productos (RF-02)"],
        summary: "Crear nuevo atributo",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["nombre"], properties: { nombre: { type: "string", example: "Material" } } } } },
        },
        responses: {
          201: { description: "Atributo registrado exitosamente" },
        },
      },
    },

    /* =========================================================
       INVENTARIO & KARDEX (RF-03)
       ========================================================= */
    "/inventario": {
      get: {
        tags: ["Inventario & Kardex (RF-03)"],
        summary: "Consultar existencias consolidadas por almacén",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "Stock físico, stock disponible y alertas de punto de reorden" },
        },
      },
    },
    "/inventario/kardex": {
      get: {
        tags: ["Inventario & Kardex (RF-03)"],
        summary: "Consultar movimientos inmutables del Kardex",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "pagina", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limite", in: "query", schema: { type: "integer", default: 20 } },
          { name: "tipoMovimiento", in: "query", schema: { type: "string", enum: ["ENTRADA", "SALIDA", "AJUSTE", "DEVOLUCION"] } },
        ],
        responses: {
          200: { description: "Movimientos históricos del kardex protegidos por trigger inmutable" },
        },
      },
    },
    "/inventario/entrada": {
      post: {
        tags: ["Inventario & Kardex (RF-03)"],
        summary: "Registrar entrada de mercancía (Compra)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["idVariante", "cantidad", "costoUnitario"],
                properties: {
                  idVariante: { type: "integer", example: 1 },
                  idAlmacen: { type: "integer", default: 1 },
                  cantidad: { type: "integer", example: 50 },
                  costoUnitario: { type: "number", example: 180.00 },
                  motivo: { type: "string", example: "Entrada por orden de compra OC-1002" },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Stock ingresado y movimiento kardex asentado" },
        },
      },
    },

    /* =========================================================
       CARRITO (RF-04)
       ========================================================= */
    "/carrito": {
      get: {
        tags: ["Carrito de Compras (RF-04)"],
        summary: "Obtener carrito de compras activo",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "Artículos, subtotales, IVA del 12% y descuentos aplicados" },
        },
      },
    },
    "/carrito/items": {
      post: {
        tags: ["Carrito de Compras (RF-04)"],
        summary: "Agregar artículo al carrito",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["idVariante", "cantidad"],
                properties: {
                  idVariante: { type: "integer", example: 1 },
                  cantidad: { type: "integer", example: 2 },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Línea agregada con validación de stock disponible" },
        },
      },
    },

    /* =========================================================
       CHECKOUT & PAGOS (RF-05, RF-06)
       ========================================================= */
    "/checkout/iniciar": {
      post: {
        tags: ["Checkout & Reservas (RF-05)"],
        summary: "Iniciar checkout atómico con reserva temporal de 15 minutos",
        description: "Valida existencias, crea el pedido en estado PENDIENTE_PAGO y bloquea stock temporalmente para evitar sobreventa.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["idDireccionEnvio"],
                properties: {
                  idDireccionEnvio: { type: "integer", example: 1 },
                  codigoCupon: { type: "string", example: "BIENVENIDA2026" },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Pedido iniciado y reserva temporal creada por 15 minutos" },
        },
      },
    },
    "/checkout/confirmar-pago": {
      post: {
        tags: ["Pedidos & Pagos (RF-06)"],
        summary: "Confirmar pago del pedido (Transaccional e Idempotente)",
        description: "Acepta clave de idempotencia única. Realiza la transición de PENDIENTE_PAGO a PAGADO y asienta la salida definitiva en Kardex.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "X-Idempotency-Key",
            in: "header",
            required: false,
            schema: { type: "string" },
            description: "UUID para garantizar idempotencia y evitar doble cobro",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["idPedido", "metodoPago"],
                properties: {
                  idPedido: { type: "integer", example: 1 },
                  metodoPago: { type: "string", enum: ["TARJETA_CREDITO", "TRANSFERENCIA", "EFECTIVO_CONTRAENTREGA"], example: "TARJETA_CREDITO" },
                  referenciaPago: { type: "string", example: "AUTH-PAY-987654" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Pago aplicado, pedido confirmado y kardex actualizado" },
        },
      },
    },

    /* =========================================================
       PEDIDOS (RF-06)
       ========================================================= */
    "/pedidos/mis-pedidos": {
      get: {
        tags: ["Pedidos & Pagos (RF-06)"],
        summary: "Consultar pedidos propios del cliente (Anti-IDOR)",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "Historial de pedidos del cliente autenticado" },
        },
      },
    },
    "/pedidos/admin": {
      get: {
        tags: ["Pedidos & Pagos (RF-06)"],
        summary: "Listar pedidos con filtros para operadores y administradores",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "pagina", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limite", in: "query", schema: { type: "integer", default: 15 } },
          { name: "estado", in: "query", schema: { type: "string" } },
        ],
        responses: {
          200: { description: "Lista de pedidos en el backoffice" },
        },
      },
    },

    /* =========================================================
       REPORTES & AUDITORÍA (RF-08, RF-09)
       ========================================================= */
    "/reportes/dashboard": {
      get: {
        tags: ["Reportes & Analítica (RF-08)"],
        summary: "KPIs ejecutivos consolidados",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "Ventas netas, pedidos procesados, clientes y alertas" },
        },
      },
    },
    "/bitacora": {
      get: {
        tags: ["Bitácora de Auditoría (RF-09)"],
        summary: "Consultar bitácora inmutable de eventos",
        description: "Tabla blindada contra UPDATE y DELETE por el trigger TR_RegistroBitacora_Inmutable.",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "pagina", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limite", in: "query", schema: { type: "integer", default: 20 } },
          { name: "modulo", in: "query", schema: { type: "string" } },
        ],
        responses: {
          200: { description: "Auditoría de eventos con deltas JSON" },
        },
      },
    },
  },
};

export const swaggerUiOptions = {
  customCss: `
    .swagger-ui .topbar { background-color: #0f172a; border-bottom: 2px solid #2563eb; }
    .swagger-ui .topbar .download-url-wrapper { display: none; }
    .swagger-ui .info { margin: 20px 0; }
    .swagger-ui .info .title { font-family: sans-serif; color: #0f172a; font-weight: 800; }
    .swagger-ui .btn.authorize { background-color: #2563eb; color: #ffffff; border-color: #2563eb; }
    .swagger-ui .btn.authorize svg { fill: #ffffff; }
  `,
  customSiteTitle: "ShopCart API — Documentación Interactiva OpenAPI",
};
