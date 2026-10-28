import { Router } from "express";
import { DireccionesController } from "./direcciones.controller";
import { autenticar } from "../../shared/middlewares/autenticar";
import { validar } from "../../shared/middlewares/validar";
import { CrearDireccionSchema, ActualizarDireccionSchema } from "@shopcart/contracts";

const router = Router();
const controller = new DireccionesController();

// Todas las rutas de direcciones requieren autenticación (el ID de usuario se extrae del token de sesión)
router.use(autenticar);

router.post("/", validar(CrearDireccionSchema, "body"), controller.crear);
router.get("/", controller.listarPropias);
router.get("/:id", controller.obtenerPorID);
router.put("/:id", validar(ActualizarDireccionSchema, "body"), controller.actualizar);
router.delete("/:id", controller.eliminar);
router.patch("/:id/predeterminada", controller.establecerPredeterminada);

export default router;
