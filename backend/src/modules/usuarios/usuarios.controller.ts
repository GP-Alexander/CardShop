import { Request, Response, NextFunction } from "express";
import { UsuariosService } from "./usuarios.service";
import {
  ListarUsuariosQuery,
  ActualizarUsuarioAdminInput,
  CambiarEstadoUsuarioInput,
  CrearUsuarioInternoInput,
} from "@shopcart/contracts";
import { BadRequestError } from "../../shared/errors/AppError";

export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService = new UsuariosService()) {}

  crearInterno = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idUsuarioAdmin = req.usuario!.idUsuario;
      const datos = req.body as CrearUsuarioInternoInput;

      const nuevoUsuario = await this.usuariosService.crearInterno(
        idUsuarioAdmin,
        datos,
        req.ip
      );

      res.status(201).json({
        exito: true,
        mensaje: `Usuario con rol ${datos.nombreRol} creado exitosamente`,
        datos: nuevoUsuario,
      });
    } catch (err) {
      next(err);
    }
  };

  listar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {

    try {
      const filtros = req.query as unknown as ListarUsuariosQuery;
      const resultado = await this.usuariosService.listarPaginado(filtros);
      res.status(200).json({
        exito: true,
        ...resultado,
      });
    } catch (err) {
      next(err);
    }
  };

  obtenerDetalle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idUsuario = parseInt(String(req.params.id), 10);
      if (isNaN(idUsuario) || idUsuario <= 0) {
        throw new BadRequestError("ID de usuario inválido");
      }

      const usuario = await this.usuariosService.obtenerDetalle(idUsuario);
      res.status(200).json({
        exito: true,
        datos: usuario,
      });
    } catch (err) {
      next(err);
    }
  };

  actualizarAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idUsuarioObjetivo = parseInt(String(req.params.id), 10);
      if (isNaN(idUsuarioObjetivo) || idUsuarioObjetivo <= 0) {
        throw new BadRequestError("ID de usuario inválido");
      }

      const idUsuarioAdmin = req.usuario!.idUsuario;
      const datos = req.body as ActualizarUsuarioAdminInput;

      const actualizado = await this.usuariosService.actualizarAdmin(
        idUsuarioAdmin,
        idUsuarioObjetivo,
        datos,
        req.ip
      );

      res.status(200).json({
        exito: true,
        mensaje: "Usuario actualizado exitosamente",
        datos: actualizado,
      });
    } catch (err) {
      next(err);
    }
  };

  cambiarEstado = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idUsuarioObjetivo = parseInt(String(req.params.id), 10);
      if (isNaN(idUsuarioObjetivo) || idUsuarioObjetivo <= 0) {
        throw new BadRequestError("ID de usuario inválido");
      }

      const idUsuarioAdmin = req.usuario!.idUsuario;
      const datos = req.body as CambiarEstadoUsuarioInput;

      const resultado = await this.usuariosService.cambiarEstado(
        idUsuarioAdmin,
        idUsuarioObjetivo,
        datos,
        req.ip
      );

      const accion = datos.estaActivo ? "activado" : "desactivado";
      res.status(200).json({
        exito: true,
        mensaje: `Usuario ${accion} exitosamente`,
        datos: resultado,
      });
    } catch (err) {
      next(err);
    }
  };
}
