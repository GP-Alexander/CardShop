# Guía Estándar para la Creación de Módulos — ShopCart

> **Documento Normativo y Operativo para Desarrolladores y Agentes de IA.**  
> Define el estándar obligatorio, la ubicación exacta de cada archivo y el flujo secuencial de 6 pasos para construir cualquier módulo funcional en el repositorio de **ShopCart**.

---

## 1. Principio Fundamental de Consistencia

Cada módulo funcional en ShopCart (Inventario, Carrito, Checkout, Pedidos, Devoluciones, etc.) debe desarrollarse **de forma vertical y ordenada**, siguiendo estrictamente una separación de capas sin omitir ninguna y sin dispersar archivos fuera de sus directorios asignados.

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Base de Datos (SQL Server 2019+ Stored Procedures)       │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ 2. Contratos Compartidos (@shopcart/contracts con Zod)      │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ 3. Backend por Capas (DAL -> Service -> Controller -> Route) │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ 4. Pruebas de Integración Automatizadas (Vitest)            │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ 5. Frontend React (API -> Componentes -> Páginas -> Rutas)  │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ 6. Verificación de Compilación (TypeScript Strict + Build)  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Mapa de Ubicación Exacta de Archivos por Módulo

Para un módulo llamado `<modulo>` (por ejemplo: `inventario`, `pedidos`, `carrito`, `devoluciones`):

| Capa | Ubicación Exacta del Archivo | Propósito Obligatorio |
|---|---|---|
| **BD Esquema** | `database/migrations/000X_<modulo>.sql` | Creación de tablas (`CREATE TABLE`), índices y llaves foráneas. Solo si agrega tablas nuevas. |
| **BD Procedimientos** | `database/programmable/02XX_sp_<modulo>.sql` | Stored Procedures (`SP_<Modulo>_<Accion>`), Vistas (`VW_...`) o Funciones (`FU_...`). |
| **Contratos** | `packages/contracts/src/<modulo>.ts` | Esquemas Zod para validar `body`, `query`, `params` y tipos TypeScript compartidos. |
| **Exportación Contratos** | `packages/contracts/src/index.ts` | Reexportar `export * from "./<modulo>";`. |
| **Backend DAL** | `backend/src/modules/<modulo>/<modulo>.dal.ts` | **Acceso exclusivo a Stored Procedures** usando `ejecutarSp`. **PROHIBIDO ORMs o sentencias SQL.** |
| **Backend Service** | `backend/src/modules/<modulo>/<modulo>.service.ts` | Lógica de negocio, reglas de validación, transacciones y registro en bitácora. |
| **Backend Controller** | `backend/src/modules/<modulo>/<modulo>.controller.ts` | Recepción de requests y emisión de respuestas HTTP JSON estandarizadas. |
| **Backend Routes** | `backend/src/modules/<modulo>/<modulo>.routes.ts` | Definición de endpoints con middlewares `validar(...)`, `autenticarJwt` y `autorizarRol(...)`. |
| **Backend Montaje** | `backend/src/routes.ts` | Montar el enrutador con su prefijo: `apiRouter.use("/<modulo>", <modulo>Router);`. |
| **Backend Tests** | `backend/tests/integration/<modulo>.test.ts` | Pruebas de integración automatizadas con Vitest contra base de datos real. |
| **Frontend API** | `frontend/src/features/<modulo>/api.ts` | Funciones `async` que consumen los endpoints usando la instancia centralizada `clienteApi`. |
| **Frontend Componentes** | `frontend/src/features/<modulo>/components/` | Componentes visuales encapsulados y específicos del módulo (tablas, cards, modales). |
| **Frontend Páginas** | `frontend/src/features/<modulo>/pages/` | Páginas principales enrutables (ej: `PedidosPage.tsx`, `InventarioAdminPage.tsx`). |
| **Frontend Router** | `frontend/src/app/router.tsx` | Registro de las rutas en React Router protegiendo por rol (`Cliente`, `Operador`, `Administrador`). |

---

## 3. Flujo Secuencial de Construcción Paso a Paso

### Paso 1: Base de Datos (SQL Server 2019+)
1. Si el módulo requiere tablas nuevas:
   * Crear el archivo numerado `database/migrations/000X_<modulo>.sql`.
   * Usar tipos de datos definidos: montos en **`DECIMAL(12,2)`** o **`DECIMAL(10,2)`**, llaves primarias autoincrementables con prefijo `ID` + PascalCase (`IDPedido`, `IDMovimiento`). **PROHIBIDO usar `FLOAT` o `REAL`**.
2. Crear los Stored Procedures en `database/programmable/02XX_sp_<modulo>.sql`:
   * Nomenclatura obligatoria: `dbo.SP_<Modulo>_<Accion>` (ej: `dbo.SP_Pedidos_CrearPedido`, `dbo.SP_Inventario_RegistrarMovimiento`).
   * Manejo de errores con `THROW 50xxx, 'Mensaje explicativo', 1;`.
   * Si requiere filtros dinámicos, usar obligatoriamente `sp_executesql` con parámetros tipados para evitar SQL Injection.
   * Usar transacciones atómicas `BEGIN TRANSACTION` / `COMMIT TRANSACTION` con bloque `BEGIN TRY / BEGIN CATCH` en operaciones críticas.
3. Ejecutar la migración con el runner:
   ```powershell
   cmd /c "npm --workspace=shopcart-database run migrate"
   ```

---

### Paso 2: Contratos Zod en `packages/contracts`
1. Crear el archivo `packages/contracts/src/<modulo>.ts`:
   * Definir los esquemas Zod para la entrada de datos: `Crear<Entidad>Schema`, `Actualizar<Entidad>Schema`, `Filtros<Entidad>Schema`.
   * Exportar los tipos inferidos:
     ```typescript
     import { z } from "zod";

     export const CrearPedidoSchema = z.object({
       idDireccionEntrega: z.number().int().positive(),
       metodoPago: z.enum(["TARJETA", "TRANSFERENCIA"]),
     });

     export type CrearPedidoInput = z.infer<typeof CrearPedidoSchema>;
     ```
2. Reexportarlo en `packages/contracts/src/index.ts`:
   ```typescript
   export * from "./<modulo>";
   ```
3. Compilar los contratos:
   ```powershell
   cmd /c "npm --workspace=@shopcart/contracts run build"
   ```

---

### Paso 3: Backend por Capas
Crear la carpeta `backend/src/modules/<modulo>/` con sus 4 archivos obligatorios:

#### 1. `<modulo>.dal.ts` (Data Access Layer)
* **Regla estricta:** Solo invoca Stored Procedures mediante `ejecutarSp` o helpers de base de datos.
* **PROHIBIDO:** Usar ORMs o escribir `SELECT`, `INSERT`, `UPDATE`, `DELETE` en crudo.
* Ejemplo:
  ```typescript
  import { ejecutarSp } from "../../shared/database/ejecutarSp";

  export const pedidosDal = {
    async crearPedido(idUsuario: number, datosJson: string) {
      const res = await ejecutarSp<{ IDPedido: number }>("dbo.SP_Pedidos_CrearPedido", {
        IDUsuario: idUsuario,
        DatosJson: datosJson,
      });
      return res.recordset[0];
    },
  };
  ```

#### 2. `<modulo>.service.ts` (Lógica de Negocio)
* Orquesta las reglas de negocio, validaciones complejas, cálculo de montos en Quetzales (Q) y llamada a la bitácora (`dbo.RegistroBitacora`).
* Lanza instancias de `AppError` o delega el mapeo de errores de SQL Server.

#### 3. `<modulo>.controller.ts` (Controlador HTTP)
* Extrae datos validados de `req.body`, `req.query`, `req.params` y el usuario autenticado de `req.usuario`.
* Emite respuestas JSON con código de estado HTTP adecuado (200, 201, 204).

#### 4. `<modulo>.routes.ts` (Rutas)
* Declara los endpoints usando `validar({ body: ..., query: ... })`.
* Aplica `autenticarJwt` y `autorizarRol("Administrador", "Operador")` según corresponda.

#### 5. Montar en `backend/src/routes.ts`
* Agregar la ruta al enrutador central:
  ```typescript
  import <modulo>Router from "./modules/<modulo>/<modulo>.routes";
  // ...
  apiRouter.use("/<modulo>", <modulo>Router);
  ```

---

### Paso 4: Pruebas de Integración Automatizadas
1. Crear `backend/tests/integration/<modulo>.test.ts`.
2. Probar el flujo completo contra la base de datos de pruebas:
   * Casos de éxito (creación, lectura, actualización).
   * Casos de error y validaciones (campos faltantes, IDs inexistentes).
   * **Prueba obligatoria de IDOR:** Comprobar que un cliente no pueda acceder ni modificar recursos de otro cliente (`403 Forbidden`).
3. Ejecutar las pruebas:
   ```powershell
   cmd /c "npm --workspace=shopcart-backend test"
   ```

---

### Paso 5: Frontend (React 18 + Tailwind CSS + shadcn/ui)
Crear la estructura dentro de `frontend/src/features/<modulo>/`:

```
frontend/src/features/<modulo>/
├── api.ts                  # Métodos HTTP llamando a /api/<modulo>
├── components/             # Componentes específicos (tablas, cards, modales)
│   ├── <Modulo>Tabla.tsx
│   └── <Modulo>Modal.tsx
└── pages/                  # Páginas enlazadas al Router
    ├── <Modulo>AdminPage.tsx
    └── <Modulo>ClientePage.tsx
```

#### Reglas de UI/UX para el Frontend:
1. **Confirmaciones Interactivas Estándar:**
   * **PROHIBIDO:** Usar `window.confirm` o `window.alert` nativos del navegador.
   * **OBLIGATORIO:** Usar el componente centralizado `@/shared/ui/ConfirmDialog` con su variante semántica adecuada (`peligro`, `advertencia`, `info`, `exito`).
2. **Validación Multicampo en Formularios:**
   * Usar `noValidate` en el `<form>`.
   * Validar todos los campos simultáneamente mostrando los errores *inline* (bajo cada input con borde rojo) y con resumen superior. Limpiar errores al escribir (`onChange`).
3. **Moneda e Impuestos:**
   * Todos los montos deben expresarse en **Quetzales (Q)** con formato `Q 1,250.00` indicando que incluyen el **12% de IVA**.
4. **Estados de UI:**
   * Cada vista debe contemplar explícitamente: Estado de Carga (`Loader2` animado), Estado Vacío (mensaje e icono descriptivo) y Estado de Error.
5. **Enrutamiento en `frontend/src/app/router.tsx`:**
   * Rutas de clientes en `/` (ej: `/pedidos`, `/carrito`).
   * Rutas administrativas dentro del layout `AdminLayout` en `/admin/...` (ej: `/admin/inventario`, `/admin/pedidos`).
   * Restringir para que un usuario con rol `Cliente` jamás pueda ver ni ingresar al panel de administración.

---

### Paso 6: Verificación y Compilación
Antes de dar por completado cualquier módulo, verificar que todo el monorepo compile de forma estricta:

```powershell
# 1. Compilar contratos
cmd /c "npm --workspace=@shopcart/contracts run build"

# 2. Compilar y verificar tipos del backend
cmd /c "npm --workspace=shopcart-backend run build"

# 3. Compilar y verificar tipos del frontend
cmd /c "npm --workspace=shopcart-frontend run build"

# 4. Ejecutar suite de pruebas de integración
cmd /c "npm --workspace=shopcart-backend test"
```

---

## 4. Checklist de Definición de Terminado (DoD)

Antes de reportar un módulo como completado al usuario, confirma que cumple cada punto:

- [ ] ¿Los datos se consultan y persisten **únicamente** mediante Stored Procedures?
- [ ] ¿Hay **cero sentencias SQL** y **cero ORMs** en archivos `.ts` o `.js`?
- [ ] ¿Todos los precios, costos y montos usan `DECIMAL` y se muestran en Quetzales (Q) con 12% de IVA?
- [ ] ¿Los esquemas de entrada están centralizados con Zod en `packages/contracts`?
- [ ] ¿Se cuenta con protección contra IDOR (validación de propiedad por cliente)?
- [ ] ¿Toda acción destructiva o confirmación en frontend usa `@/shared/ui/ConfirmDialog` en vez de `window.confirm`?
- [ ] ¿Las acciones administrativas críticas quedan registradas en la bitácora inmutable (`dbo.RegistroBitacora`)?
- [ ] ¿El frontend cuenta con feedback de carga, vacío y errores *inline*?
- [ ] ¿Pasaron todas las pruebas de integración con Vitest?
- [ ] ¿El build de TypeScript compila con 0 errores (`tsc && vite build`)?
