import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { ValidationError } from "../errors/AppError";

type UbicacionRequest = "body" | "query" | "params";

export function validar(schema: ZodSchema, ubicacion: UbicacionRequest = "body") {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req[ubicacion] = schema.parse(req[ubicacion]);
      next();
    } catch (error) {
      if (
        error instanceof ZodError ||
        (typeof error === "object" && error !== null && (error as any).name === "ZodError")
      ) {
        const zodErr = error as ZodError;
        const detalles = zodErr.errors.map((e) => ({
          campo: e.path.join("."),
          mensaje: e.message,
        }));
        next(new ValidationError("Los datos enviados contienen errores de validación.", detalles));
      } else {
        next(error);
      }
    }

  };
}
