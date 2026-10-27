import { Request, Response, NextFunction } from "express";
import { ForbiddenError, UnauthorizedError } from "../errors/AppError";

type RolPermitido = "Cliente" | "Operador" | "Administrador";

/**
 * Middleware para restringir el acceso a ciertos roles (RF-01).
 */
export function autorizarRoles(...rolesPermitidos: RolPermitido[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.usuario) {
      return next(new UnauthorizedError("Usuario no autenticado", "NO_AUTENTICADO"));
    }

    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return next(
        new ForbiddenError(
          `Acceso denegado: el rol '${req.usuario.rol}' no tiene permisos para este recurso.`,
          "PERMISO_DENEGADO"
        )
      );
    }

    next();
  };
}

/**
 * Middleware para validar que el usuario cuente con un permiso específico de la BD.
 */
export function autorizarPermiso(codigoPermiso: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.usuario) {
      return next(new UnauthorizedError("Usuario no autenticado", "NO_AUTENTICADO"));
    }

    if (req.usuario.rol === "Administrador") {
      return next(); // Administrador tiene todos los permisos
    }

    if (!req.usuario.permisos.includes(codigoPermiso)) {
      return next(
        new ForbiddenError(
          `Acceso denegado: se requiere el permiso '${codigoPermiso}'.`,
          "PERMISO_DENEGADO"
        )
      );
    }

    next();
  };
}
