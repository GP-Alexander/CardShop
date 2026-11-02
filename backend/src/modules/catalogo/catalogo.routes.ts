import { Router } from "express";
import { catalogoController } from "./catalogo.controller";
import { autenticar } from "../../shared/middlewares/autenticar";
import { autorizarRoles } from "../../shared/middlewares/autorizar";
import { validar } from "../../shared/middlewares/validar";
import { uploadImagenProducto, optimizarYGuardarImagen } from "../../shared/middlewares/subirImagen";
import {
  CrearCategoriaSchema,
  ActualizarCategoriaSchema,
  CambiarEstadoCategoriaSchema,
  ListarCategoriasQuerySchema,
  CrearAtributoSchema,
  CrearValorAtributoSchema,
  CrearProductoSchema,
  ActualizarProductoSchema,
  CambiarEstadoProductoSchema,
  ActualizarVarianteSchema,
  ListarCatalogoQuerySchema,
} from "@shopcart/contracts";

const catalogoRouter = Router();

/* =========================================================================
   RUTAS PÚBLICAS (Clientes y Visitantes)
   ========================================================================= */

// Categorías
catalogoRouter.get(
  "/categorias",
  validar(ListarCategoriasQuerySchema, "query"),
  catalogoController.listarCategorias
);
catalogoRouter.get("/categorias/:id", catalogoController.obtenerCategoriaPorId);

// Atributos y Valores (para filtros dinámicos)
catalogoRouter.get("/atributos", catalogoController.listarAtributosConValores);

// Productos del catálogo
catalogoRouter.get(
  "/productos",
  validar(ListarCatalogoQuerySchema, "query"),
  catalogoController.listarCatalogo
);
catalogoRouter.get("/productos/:idOrSlug", catalogoController.obtenerProductoPorIdOrSlug);

/* =========================================================================
   RUTAS ADMINISTRATIVAS (Exclusivo Administrador según RF-01)
   ========================================================================= */

// Categorías
catalogoRouter.post(
  "/categorias",
  autenticar,
  autorizarRoles("Administrador"),
  validar(CrearCategoriaSchema, "body"),
  catalogoController.crearCategoria
);

catalogoRouter.put(
  "/categorias/:id",
  autenticar,
  autorizarRoles("Administrador"),
  validar(ActualizarCategoriaSchema, "body"),
  catalogoController.actualizarCategoria
);

catalogoRouter.patch(
  "/categorias/:id/estado",
  autenticar,
  autorizarRoles("Administrador"),
  validar(CambiarEstadoCategoriaSchema, "body"),
  catalogoController.cambiarEstadoCategoria
);

// Atributos y Valores
catalogoRouter.post(
  "/atributos",
  autenticar,
  autorizarRoles("Administrador"),
  validar(CrearAtributoSchema, "body"),
  catalogoController.crearAtributo
);

catalogoRouter.post(
  "/atributos/:id/valores",
  autenticar,
  autorizarRoles("Administrador"),
  validar(CrearValorAtributoSchema, "body"),
  catalogoController.crearValorAtributo
);

// Productos
catalogoRouter.post(
  "/productos",
  autenticar,
  autorizarRoles("Administrador"),
  validar(CrearProductoSchema, "body"),
  catalogoController.crearProducto
);

catalogoRouter.put(
  "/productos/:id",
  autenticar,
  autorizarRoles("Administrador"),
  validar(ActualizarProductoSchema, "body"),
  catalogoController.actualizarProducto
);

catalogoRouter.patch(
  "/productos/:id/estado",
  autenticar,
  autorizarRoles("Administrador"),
  validar(CambiarEstadoProductoSchema, "body"),
  catalogoController.cambiarEstadoProducto
);

// Variantes
catalogoRouter.patch(
  "/variantes/:id",
  autenticar,
  autorizarRoles("Administrador"),
  validar(ActualizarVarianteSchema, "body"),
  catalogoController.actualizarVariante
);

// Subida y optimización de imágenes
catalogoRouter.post(
  "/imagenes/subir",
  autenticar,
  autorizarRoles("Administrador"),
  uploadImagenProducto.single("imagen"),
  optimizarYGuardarImagen,
  (req, res) => {
    res.status(201).json({
      exito: true,
      mensaje: "Imagen optimizada y guardada exitosamente en formato WebP.",
      datos: {
        url: req.fileUrl,
      },
    });
  }
);

export default catalogoRouter;
