import { Request, Response, NextFunction } from "express";
import { ReportesService } from "./reportes.service";
import {
  FiltroVentasPeriodoQuery,
  FiltroVentasPorCategoriaQuery,
  FiltroTopProductosQuery,
  FiltroCarritosAbandonadosQuery,
} from "@shopcart/contracts";

export class ReportesController {
  constructor(private readonly service = new ReportesService()) {}

  obtenerDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const horasInactividad = req.query.horasInactividad
        ? parseInt(req.query.horasInactividad as string, 10)
        : 24;

      const data = await this.service.obtenerDashboard(horasInactividad);
      res.status(200).json({
        exito: true,
        datos: data,
      });
    } catch (err) {
      next(err);
    }
  };

  obtenerVentasPeriodo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as unknown as FiltroVentasPeriodoQuery;
      const data = await this.service.obtenerVentasPeriodo(query);
      res.status(200).json({
        exito: true,
        datos: data,
      });
    } catch (err) {
      next(err);
    }
  };

  obtenerVentasPorCategoria = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const query = req.query as unknown as FiltroVentasPorCategoriaQuery;
      const data = await this.service.obtenerVentasPorCategoria(query);
      res.status(200).json({
        exito: true,
        datos: data,
      });
    } catch (err) {
      next(err);
    }
  };

  obtenerTopProductos = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as unknown as FiltroTopProductosQuery;
      const data = await this.service.obtenerTopProductos(query);
      res.status(200).json({
        exito: true,
        datos: data,
      });
    } catch (err) {
      next(err);
    }
  };

  obtenerCarritosAbandonados = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const query = req.query as unknown as FiltroCarritosAbandonadosQuery;
      const data = await this.service.obtenerCarritosAbandonados(query);
      res.status(200).json({
        exito: true,
        ...data,
      });
    } catch (err) {
      next(err);
    }
  };
}
