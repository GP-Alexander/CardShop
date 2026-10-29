import { Request, Response, NextFunction } from "express";
import { InventarioService } from "./inventario.service";
import {
  ListarInventarioQuery,
  RegistrarEntradaInventarioInput,
  RegistrarAjusteInventarioInput,
  ActualizarPuntoReordenInput,
  ListarKardexQuery,
} from "@shopcart/contracts";

export class InventarioController {
  constructor(private readonly inventarioService: InventarioService = new InventarioService()) {}

  listarExistencias = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filtros = req.query as unknown as ListarInventarioQuery;
      const resultado = await this.inventarioService.listarExistencias(filtros);
      res.json({
        exito: true,
        mensaje: "Existencias de inventario consultadas exitosamente",
        ...resultado,
      });
    } catch (error) {
      next(error);
    }
  };

  obtenerPorVariante = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idVariante = parseInt(String(req.params.idVariante), 10);
      const codigoAlmacen = (req.query.codigoAlmacen as string) || "PRINCIPAL";
      const item = await this.inventarioService.obtenerPorVariante(idVariante, codigoAlmacen);
      res.json({
        exito: true,
        datos: item,
      });
    } catch (error) {
      next(error);
    }
  };

  registrarEntrada = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = req.body as RegistrarEntradaInventarioInput;
      const idUsuario = req.usuario!.idUsuario;
      const ip = req.ip || req.socket.remoteAddress;

      const item = await this.inventarioService.registrarEntrada(input, idUsuario, ip);
      res.status(201).json({
        exito: true,
        mensaje: "Entrada de inventario registrada con éxito en Kardex",
        datos: item,
      });
    } catch (error) {
      next(error);
    }
  };

  registrarAjuste = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = req.body as RegistrarAjusteInventarioInput;
      const idUsuario = req.usuario!.idUsuario;
      const ip = req.ip || req.socket.remoteAddress;

      const item = await this.inventarioService.registrarAjuste(input, idUsuario, ip);
      res.json({
        exito: true,
        mensaje: "Ajuste manual de inventario registrado con éxito en Kardex (RF-03)",
        datos: item,
      });
    } catch (error) {
      next(error);
    }
  };

  actualizarPuntoReorden = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = req.body as ActualizarPuntoReordenInput;
      const idUsuario = req.usuario!.idUsuario;
      const ip = req.ip || req.socket.remoteAddress;

      const item = await this.inventarioService.actualizarPuntoReorden(input, idUsuario, ip);
      res.json({
        exito: true,
        mensaje: "Punto de reorden actualizado exitosamente",
        datos: item,
      });
    } catch (error) {
      next(error);
    }
  };

  listarKardex = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filtros = req.query as unknown as ListarKardexQuery;
      const resultado = await this.inventarioService.listarKardex(filtros);
      res.json({
        exito: true,
        mensaje: "Movimientos de Kardex consultados exitosamente (RF-03)",
        ...resultado,
      });
    } catch (error) {
      next(error);
    }
  };
}
