import {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
} from "./AppError";

interface SqlErrorLike {
  number?: number;
  message: string;
}

/**
 * Traduce números de error THROW 50xxx de SQL Server a excepciones de dominio AppError.
 */
export function mapearErrorSql(error: unknown): Error {
  if (typeof error !== "object" || error === null) {
    return error instanceof Error ? error : new Error(String(error));
  }

  const sqlErr = error as SqlErrorLike;
  const num = sqlErr.number;
  const msg = sqlErr.message || "Error de base de datos";

  if (!num) {
    return error instanceof Error ? error : new Error(msg);
  }

  // 1. Validaciones de entrada (50001 a 50099 -> 422)
  if (num >= 50001 && num <= 50099) {
    return new ValidationError(msg);
  }

  // 2. Catálogo (50100 a 50199)
  if (num >= 50100 && num <= 50199) {
    if (num === 50104) {
      return new NotFoundError(msg, `SQL_${num}`);
    }
    return new BadRequestError(msg, `SQL_${num}`);
  }

  // 3. Usuarios y Sesiones (50200 a 50299)
  if (num >= 50200 && num <= 50299) {
    if (num === 50201) {
      return new UnauthorizedError(msg, `SQL_${num}`);
    }
    if (num === 50202 || num === 50203) {
      return new ForbiddenError(msg, `SQL_${num}`);
    }
    if (num === 50204) {
      return new ConflictError(msg, `SQL_${num}`);
    }
    return new ConflictError(msg, `SQL_${num}`);
  }

  // 4. Inventario y reservas (50300 a 50399 -> 409)
  if (num >= 50300 && num <= 50399) {
    return new ConflictError(msg, `SQL_${num}`);
  }

  // 5. Checkout y pagos (50500 a 50599 -> 409)
  if (num >= 50500 && num <= 50599) {
    return new ConflictError(msg, `SQL_${num}`);
  }

  // 6. Pedidos y devoluciones (50600 a 50699 -> 409)
  if (num >= 50600 && num <= 50699) {
    return new ConflictError(msg, `SQL_${num}`);
  }

  // 7. Violaciones de inmutabilidad (Bitácora, Kardex -> 500)
  if ([50010, 50011, 50021, 50022].includes(num)) {
    return new AppError(`Violación de integridad crítica: ${msg}`, 500, `SQL_INTEGRIDAD_${num}`);
  }

  // Errores estándar de SQL Server
  if (num === 2627 || num === 2601) {
    return new ConflictError("Ya existe un registro con esos datos únicos.", "SQL_DUPLICATE_KEY");
  }
  if (num === 547) {
    return new ConflictError("Operación inválida: restricción de integridad referencial.", "SQL_FOREIGN_KEY");
  }

  return error instanceof Error ? error : new Error(msg);
}
