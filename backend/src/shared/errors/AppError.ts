export class AppError extends Error {
  public readonly codigoHttp: number;
  public readonly codigoInterno?: string;
  public readonly mensaje: string;
  public readonly detalles?: Array<{ campo?: string; mensaje: string }>;

  constructor(
    mensaje: string,
    codigoHttp: number = 500,
    codigoInterno?: string,
    detalles?: Array<{ campo?: string; mensaje: string }>
  ) {
    super(mensaje);
    this.name = this.constructor.name;
    this.mensaje = mensaje;
    this.codigoHttp = codigoHttp;
    this.codigoInterno = codigoInterno;
    this.detalles = detalles;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(mensaje: string = "Solicitud inválida", codigoInterno?: string) {
    super(mensaje, 400, codigoInterno);
  }
}

export class UnauthorizedError extends AppError {
  constructor(mensaje: string = "No autenticado o token expirado", codigoInterno?: string) {
    super(mensaje, 401, codigoInterno);
  }
}

export class ForbiddenError extends AppError {
  constructor(mensaje: string = "Acceso denegado: permisos insuficientes", codigoInterno?: string) {
    super(mensaje, 403, codigoInterno);
  }
}

export class NotFoundError extends AppError {
  constructor(mensaje: string = "Recurso no encontrado", codigoInterno?: string) {
    super(mensaje, 404, codigoInterno);
  }
}

export class ConflictError extends AppError {
  constructor(mensaje: string = "Conflicto con el estado actual del recurso", codigoInterno?: string) {
    super(mensaje, 409, codigoInterno);
  }
}

export class ValidationError extends AppError {
  constructor(
    mensaje: string = "Error de validación",
    detalles?: Array<{ campo?: string; mensaje: string }>
  ) {
    super(mensaje, 422, "ERROR_VALIDACION", detalles);
  }
}
