import { Request, Response, NextFunction } from "express";
import { CatalogoService, catalogoService } from "./catalogo.service";
import {
  CrearCategoriaInput,
  ActualizarCategoriaInput,
  CambiarEstadoCategoriaInput,
  CrearAtributoInput,
  CrearValorAtributoInput,
  CrearProductoInput,
  ActualizarProductoInput,
  CambiarEstadoProductoInput,
  ActualizarVarianteInput,
  ListarCatalogoQuery,
  ListarCategoriasQuery,
} from "@shopcart/contracts";
import { BadRequestError } from "../../shared/errors/AppError";

export class CatalogoController {
  constructor(private readonly service: CatalogoService = catalogoService) {}

  /* =========================================================================
     CATEGORÍAS
     ========================================================================= */

  listarCategorias = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as unknown as ListarCategoriasQuery;
      const soloActivas = query.soloActivas === true || String(query.soloActivas) === "true";
      const categorias = await this.service.listarCategorias(soloActivas);

      res.status(200).json({
        exito: true,
        datos: categorias,
      });
    } catch (err) {
      next(err);
    }
  };

  obtenerCategoriaPorId = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(String(req.params.id), 10);
      if (isNaN(id) || id <= 0) {
        throw new BadRequestError("El ID de la categoría debe ser un número entero positivo.");
      }

      const categoria = await this.service.obtenerCategoriaPorId(id);
      res.status(200).json({
        exito: true,
        datos: categoria,
      });
    } catch (err) {
      next(err);
    }
  };

  crearCategoria = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idUsuarioAdmin = req.usuario!.idUsuario;
      const datos = req.body as CrearCategoriaInput;
      const categoria = await this.service.crearCategoria(idUsuarioAdmin, datos, req.ip);

      res.status(201).json({
        exito: true,
        mensaje: "Categoría creada exitosamente.",
        datos: categoria,
      });
    } catch (err) {
      next(err);
    }
  };

  actualizarCategoria = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idUsuarioAdmin = req.usuario!.idUsuario;
      const id = parseInt(String(req.params.id), 10);
      if (isNaN(id) || id <= 0) {
        throw new BadRequestError("El ID de la categoría debe ser un número entero positivo.");
      }

      const datos = req.body as ActualizarCategoriaInput;
      const categoria = await this.service.actualizarCategoria(idUsuarioAdmin, id, datos, req.ip);

      res.status(200).json({
        exito: true,
        mensaje: "Categoría actualizada exitosamente.",
        datos: categoria,
      });
    } catch (err) {
      next(err);
    }
  };

  cambiarEstadoCategoria = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idUsuarioAdmin = req.usuario!.idUsuario;
      const id = parseInt(String(req.params.id), 10);
      if (isNaN(id) || id <= 0) {
        throw new BadRequestError("El ID de la categoría debe ser un número entero positivo.");
      }

      const { estaActiva } = req.body as CambiarEstadoCategoriaInput;
      const categoria = await this.service.cambiarEstadoCategoria(idUsuarioAdmin, id, estaActiva, req.ip);

      res.status(200).json({
        exito: true,
        mensaje: estaActiva ? "Categoría activada exitosamente." : "Categoría desactivada exitosamente.",
        datos: categoria,
      });
    } catch (err) {
      next(err);
    }
  };

  /* =========================================================================
     ATRIBUTOS Y VALORES
     ========================================================================= */

  listarAtributosConValores = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const atributos = await this.service.listarAtributosConValores();
      res.status(200).json({
        exito: true,
        datos: atributos,
      });
    } catch (err) {
      next(err);
    }
  };

  crearAtributo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { nombre } = req.body as CrearAtributoInput;
      const atributo = await this.service.crearAtributo(nombre);

      res.status(201).json({
        exito: true,
        mensaje: "Atributo registrado exitosamente.",
        datos: atributo,
      });
    } catch (err) {
      next(err);
    }
  };

  crearValorAtributo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idAtributo = parseInt(String(req.params.id), 10);
      if (isNaN(idAtributo) || idAtributo <= 0) {
        throw new BadRequestError("El ID del atributo debe ser un número entero positivo.");
      }

      const { valor, ordenVisual } = req.body as CrearValorAtributoInput;
      const resultado = await this.service.crearValorAtributo(idAtributo, valor, ordenVisual);

      res.status(201).json({
        exito: true,
        mensaje: "Valor de atributo registrado exitosamente.",
        datos: resultado,
      });
    } catch (err) {
      next(err);
    }
  };

  /* =========================================================================
     PRODUCTOS Y VARIANTES
     ========================================================================= */

  listarCatalogo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as unknown as ListarCatalogoQuery;
      const resultado = await this.service.listarCatalogo(query);

      res.status(200).json({
        exito: true,
        ...resultado,
      });
    } catch (err) {
      next(err);
    }
  };

  obtenerProductoPorIdOrSlug = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rawParam = req.params.idOrSlug;
      const param = Array.isArray(rawParam) ? rawParam[0] : rawParam;
      if (!param || typeof param !== "string" || param.trim() === "") {
        throw new BadRequestError("Identificador o slug de producto no proporcionado.");
      }

      const producto = await this.service.obtenerProductoPorIdOrSlug(param.trim());
      res.status(200).json({
        exito: true,
        datos: producto,
      });
    } catch (err) {
      next(err);
    }
  };

  crearProducto = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idUsuarioAdmin = req.usuario!.idUsuario;
      const datos = req.body as CrearProductoInput;
      const producto = await this.service.crearProducto(idUsuarioAdmin, datos, req.ip);

      res.status(201).json({
        exito: true,
        mensaje: "Producto registrado exitosamente.",
        datos: producto,
      });
    } catch (err) {
      next(err);
    }
  };

  actualizarProducto = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idUsuarioAdmin = req.usuario!.idUsuario;
      const id = parseInt(String(req.params.id), 10);
      if (isNaN(id) || id <= 0) {
        throw new BadRequestError("El ID del producto debe ser un número entero positivo.");
      }

      const datos = req.body as ActualizarProductoInput;
      const producto = await this.service.actualizarProducto(idUsuarioAdmin, id, datos, req.ip);

      res.status(200).json({
        exito: true,
        mensaje: "Producto actualizado exitosamente.",
        datos: producto,
      });
    } catch (err) {
      next(err);
    }
  };

  cambiarEstadoProducto = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idUsuarioAdmin = req.usuario!.idUsuario;
      const id = parseInt(String(req.params.id), 10);
      if (isNaN(id) || id <= 0) {
        throw new BadRequestError("El ID del producto debe ser un número entero positivo.");
      }

      const { estaActivo } = req.body as CambiarEstadoProductoInput;
      const producto = await this.service.cambiarEstadoProducto(idUsuarioAdmin, id, estaActivo, req.ip);

      res.status(200).json({
        exito: true,
        mensaje: estaActivo ? "Producto activado exitosamente." : "Producto desactivado exitosamente.",
        datos: producto,
      });
    } catch (err) {
      next(err);
    }
  };

  actualizarVariante = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idUsuarioAdmin = req.usuario!.idUsuario;
      const id = parseInt(String(req.params.id), 10);
      if (isNaN(id) || id <= 0) {
        throw new BadRequestError("El ID de la variante debe ser un número entero positivo.");
      }

      const datos = req.body as ActualizarVarianteInput;
      const variante = await this.service.actualizarVariante(idUsuarioAdmin, id, datos, req.ip);

      res.status(200).json({
        exito: true,
        mensaje: "Variante actualizada exitosamente.",
        datos: variante,
      });
    } catch (err) {
      next(err);
    }
  };
}

export const catalogoController = new CatalogoController();
