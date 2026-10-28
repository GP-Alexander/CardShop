import { Router } from "express";
import { authRouter } from "./modules/auth/auth.routes";
import usuariosRouter from "./modules/usuarios/usuarios.routes";
import direccionesRouter from "./modules/direcciones/direcciones.routes";
import bitacoraRouter from "./modules/bitacora/bitacora.routes";
import catalogosRouter from "./modules/catalogos/catalogos.routes";
import catalogoRouter from "./modules/catalogo/catalogo.routes";

const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/usuarios", usuariosRouter);
apiRouter.use("/direcciones", direccionesRouter);
apiRouter.use("/bitacora", bitacoraRouter);
apiRouter.use("/catalogos", catalogosRouter);
apiRouter.use("/catalogo", catalogoRouter);


// Endpoint de verificación de salud
apiRouter.get("/health", (_req, res) => {
  res.status(200).json({
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

export { apiRouter };
