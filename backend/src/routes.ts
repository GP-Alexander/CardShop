import { Router } from "express";
import { authRouter } from "./modules/auth/auth.routes";

const apiRouter = Router();

apiRouter.use("/auth", authRouter);

// Endpoint de verificación de salud
apiRouter.get("/health", (_req, res) => {
  res.status(200).json({
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

export { apiRouter };
