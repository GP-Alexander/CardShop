import { Router } from "express";
import { CarritoController } from "./carrito.controller";
import { autenticar, autenticarOpcional } from "../../shared/middlewares/autenticar";
import { validar } from "../../shared/middlewares/validar";
import {
  AgregarItemCarritoSchema,
  ModificarCantidadCarritoSchema,
  AplicarCuponCarritoSchema,
  MigrarCarritoInvitadoSchema,
} from "@shopcart/contracts";

const router = Router();
const controller = new CarritoController();

// 1. Obtener carrito activo (invitado o cliente)
router.get("/", autenticarOpcional, controller.obtener);

// 2. Agregar ítem al carrito
router.post(
  "/items",
  autenticarOpcional,
  validar(AgregarItemCarritoSchema, "body"),
  controller.agregarItem
);

// 3. Modificar cantidad de variante en el carrito
router.put(
  "/items/:idVariante",
  autenticarOpcional,
  validar(ModificarCantidadCarritoSchema, "body"),
  controller.modificarCantidad
);

// 4. Eliminar variante específica del carrito
router.delete("/items/:idVariante", autenticarOpcional, controller.eliminarItem);

// 5. Vaciar carrito completo
router.delete("/", autenticarOpcional, controller.vaciar);

// 6. Aplicar cupón de descuento al carrito
router.post(
  "/cupon",
  autenticarOpcional,
  validar(AplicarCuponCarritoSchema, "body"),
  controller.aplicarCupon
);

// 7. Remover cupón del carrito
router.delete("/cupon", autenticarOpcional, controller.removerCupon);

// 8. Migrar carrito de invitado a usuario autenticado al iniciar sesión
router.post(
  "/migrar",
  autenticar,
  validar(MigrarCarritoInvitadoSchema, "body"),
  controller.migrarInvitado
);

export default router;
