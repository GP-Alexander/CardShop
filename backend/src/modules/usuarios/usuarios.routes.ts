import { Router } from "express";
import { UsuariosController } from "./usuarios.controller";
import { autenticar } from "../../shared/middlewares/autenticar";
import { autorizarPermiso } from "../../shared/middlewares/autorizar";
import { validar } from "../../shared/middlewares/validar";
import {
  ListarUsuariosQuerySchema,
  ActualizarUsuarioAdminSchema,
  CambiarEstadoUsuarioSchema,
  CrearUsuarioInternoSchema,
} from "@shopcart/contracts";

const router = Router();
const controller = new UsuariosController();

// Todas las rutas de administración de usuarios requieren autenticación y permiso 'users.manage'
router.use(autenticar, autorizarPermiso("users.manage"));

router.get("/", validar(ListarUsuariosQuerySchema, "query"), controller.listar);
router.post("/", validar(CrearUsuarioInternoSchema, "body"), controller.crearInterno);
router.get("/:id", controller.obtenerDetalle);
router.put("/:id", validar(ActualizarUsuarioAdminSchema, "body"), controller.actualizarAdmin);
router.patch("/:id/estado", validar(CambiarEstadoUsuarioSchema, "body"), controller.cambiarEstado);

export default router;

