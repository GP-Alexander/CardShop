import { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/AppError";
import { logger } from "../logger";

export function manejarErrores(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.codigoHttp).json({
      exito: false,
      codigoHttp: err.codigoHttp,
      mensaje: err.mensaje,
      codigoInterno: err.codigoInterno,
      errores: err.detalles,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  logger.error({ err }, "Error interno no controlado");

  res.status(500).json({


    exito: false,
    codigoHttp: 500,
    mensaje: "Ha ocurrido un error interno en el servidor.",
    codigoInterno: "INTERNAL_SERVER_ERROR",
    timestamp: new Date().toISOString(),
  });
}
