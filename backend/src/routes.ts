import { Router } from "express";
import { authRouter } from "./modules/auth/auth.routes";
import usuariosRouter from "./modules/usuarios/usuarios.routes";
import direccionesRouter from "./modules/direcciones/direcciones.routes";
import bitacoraRouter from "./modules/bitacora/bitacora.routes";
import catalogosRouter from "./modules/catalogos/catalogos.routes";
import catalogoRouter from "./modules/catalogo/catalogo.routes";
import inventarioRouter from "./modules/inventario/inventario.routes";
import carritoRouter from "./modules/carrito/carrito.routes";
import cuponesRouter from "./modules/cupones/cupones.routes";
import { checkoutRouter } from "./modules/checkout/checkout.routes";
import { pedidosRouter } from "./modules/pedidos/pedidos.routes";
import { devolucionesRouter } from "./modules/devoluciones/devoluciones.routes";
import { reportesRouter } from "./modules/reportes/reportes.routes";

const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/usuarios", usuariosRouter);
apiRouter.use("/direcciones", direccionesRouter);
apiRouter.use("/bitacora", bitacoraRouter);
apiRouter.use("/catalogos", catalogosRouter);
apiRouter.use("/catalogo", catalogoRouter);
apiRouter.use("/inventario", inventarioRouter);
apiRouter.use("/carrito", carritoRouter);
apiRouter.use("/cupones", cuponesRouter);
apiRouter.use("/checkout", checkoutRouter);
apiRouter.use("/pedidos", pedidosRouter);
apiRouter.use("/devoluciones", devolucionesRouter);
apiRouter.use("/reportes", reportesRouter);


// Endpoint de verificación de salud
apiRouter.get("/health", (_req, res) => {
  res.status(200).json({
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

export { apiRouter };
