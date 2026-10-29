import { Router } from "express";
import { DevolucionesController } from "./devoluciones.controller";
import { autenticar } from "../../shared/middlewares/autenticar";
import { validar } from "../../shared/middlewares/validar";
import { CrearDevolucionSchema } from "@shopcart/contracts";

const devolucionesRouter = Router();
const controller = new DevolucionesController();

devolucionesRouter.use(autenticar);
devolucionesRouter.post("/", validar(CrearDevolucionSchema, "body"), controller.crear);

export { devolucionesRouter };
