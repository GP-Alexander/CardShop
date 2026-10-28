import { Request, Response, NextFunction } from "express";
import { DireccionesService } from "./direcciones.service";
import { CrearDireccionInput, ActualizarDireccionInput } from "@shopcart/contracts";
import { BadRequestError } from "../../shared/errors/AppError";

export class DireccionesController {
  constructor(private readonly direccionesService: DireccionesService = new DireccionesService()) {}

  crear = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idUsuario = req.usuario!.idUsuario;
      const datos = req.body as CrearDireccionInput;
      const direccion = await this.direccionesService.crear(idUsuario, datos);

      res.status(201).json({
        exito: true,
        mensaje: "Dirección registrada exitosamente",
        datos: direccion,
      });
    } catch (err) {
      next(err);
    }
  };

  listarPropias = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idUsuario = req.usuario!.idUsuario;
      const direcciones = await this.direccionesService.listarPropias(idUsuario);

      res.status(200).json({
        exito: true,
        datos: direcciones,
      });
    } catch (err) {
      next(err);
    }
  };

  obtenerPorID = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idUsuario = req.usuario!.idUsuario;
      const idDireccion = parseInt(String(req.params.id), 10);
      if (isNaN(idDireccion) || idDireccion <= 0) {
        throw new BadRequestError("ID de dirección inválido");
      }

      const direccion = await this.direccionesService.obtenerPorID(idDireccion, idUsuario);

      res.status(200).json({
        exito: true,
        datos: direccion,
      });
    } catch (err) {
      next(err);
    }
  };

  actualizar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idUsuario = req.usuario!.idUsuario;
      const idDireccion = parseInt(String(req.params.id), 10);
      if (isNaN(idDireccion) || idDireccion <= 0) {
        throw new BadRequestError("ID de dirección inválido");
      }

      const datos = req.body as ActualizarDireccionInput;
      const direccion = await this.direccionesService.actualizar(idDireccion, idUsuario, datos);

      res.status(200).json({
        exito: true,
        mensaje: "Dirección actualizada exitosamente",
        datos: direccion,
      });
    } catch (err) {
      next(err);
    }
  };

  eliminar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idUsuario = req.usuario!.idUsuario;
      const idDireccion = parseInt(String(req.params.id), 10);
      if (isNaN(idDireccion) || idDireccion <= 0) {
        throw new BadRequestError("ID de dirección inválido");
      }

      const resultado = await this.direccionesService.eliminar(idDireccion, idUsuario);

      res.status(200).json({
        exito: true,
        mensaje: "Dirección eliminada exitosamente",
        datos: resultado,
      });
    } catch (err) {
      next(err);
    }
  };

  establecerPredeterminada = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idUsuario = req.usuario!.idUsuario;
      const idDireccion = parseInt(String(req.params.id), 10);
      if (isNaN(idDireccion) || idDireccion <= 0) {
        throw new BadRequestError("ID de dirección inválido");
      }

      const direccion = await this.direccionesService.establecerPredeterminada(idDireccion, idUsuario);

      res.status(200).json({
        exito: true,
        mensaje: "Dirección establecida como predeterminada",
        datos: direccion,
      });
    } catch (err) {
      next(err);
    }
  };
}
