import { z } from "zod";

// --- Validaciones de Querys y Payloads ---

export const ListarInventarioQuerySchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
  idProducto: z.coerce.number().int().positive().optional(),
  idCategoria: z.coerce.number().int().positive().optional(),
  soloBajoStock: z
    .preprocess((val) => val === "true" || val === true || val === 1 || val === "1", z.boolean())
    .optional(),
  soloAgotados: z
    .preprocess((val) => val === "true" || val === true || val === 1 || val === "1", z.boolean())
    .optional(),
  busqueda: z.string().trim().optional(),
  codigoAlmacen: z.string().trim().default("PRINCIPAL"),
});

export type ListarInventarioQuery = z.infer<typeof ListarInventarioQuerySchema>;

export const RegistrarEntradaInventarioSchema = z.object({
  idVariante: z.number().int().positive("El ID de la variante debe ser un entero positivo"),
  cantidad: z.number().int().min(1, "La cantidad de entrada debe ser de al menos 1 unidad"),
  motivo: z.string().trim().min(3, "El motivo debe tener al menos 3 caracteres").max(300, "El motivo no puede exceder 300 caracteres"),
  codigoAlmacen: z.string().trim().default("PRINCIPAL").optional(),
});

export type RegistrarEntradaInventarioInput = z.infer<typeof RegistrarEntradaInventarioSchema>;

export const RegistrarAjusteInventarioSchema = z.object({
  idVariante: z.number().int().positive("El ID de la variante debe ser un entero positivo"),
  cantidad: z.number().int().refine((val) => val !== 0, {
    message: "La cantidad del ajuste no puede ser cero (use positivo para sumar o negativo para restar)",
  }),
  motivo: z.string().trim().min(3, "El motivo del ajuste manual es obligatorio (RF-03)").max(300),
  codigoAlmacen: z.string().trim().default("PRINCIPAL").optional(),
});

export type RegistrarAjusteInventarioInput = z.infer<typeof RegistrarAjusteInventarioSchema>;

export const ActualizarPuntoReordenSchema = z.object({
  idVariante: z.number().int().positive("El ID de la variante debe ser un entero positivo"),
  puntoReorden: z.number().int().min(0, "El punto de reorden no puede ser menor a cero"),
  codigoAlmacen: z.string().trim().default("PRINCIPAL").optional(),
});

export type ActualizarPuntoReordenInput = z.infer<typeof ActualizarPuntoReordenSchema>;

export const ListarKardexQuerySchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
  idVariante: z.coerce.number().int().positive().optional(),
  idProducto: z.coerce.number().int().positive().optional(),
  tipoMovimiento: z
    .enum([
      "ENTRADA_COMPRA",
      "SALIDA_VENTA",
      "AJUSTE_POSITIVO",
      "AJUSTE_NEGATIVO",
      "DEVOLUCION",
      "CANCELACION",
    ])
    .optional(),
  fechaInicio: z.string().optional(),
  fechaFin: z.string().optional(),
  busqueda: z.string().trim().optional(),
  codigoAlmacen: z.string().trim().optional(),
});

export type ListarKardexQuery = z.infer<typeof ListarKardexQuerySchema>;

// --- DTOs e Interfaces de Respuesta ---

export interface AtributoVarianteResumen {
  atributo: string;
  valor: string;
}

export type EstadoStock = "NORMAL" | "BAJO_STOCK" | "AGOTADO";

export interface InventarioItemDTO {
  idVariante: number;
  idProducto: number;
  sku: string;
  precio: number;
  costo: number | null;
  varianteActiva: boolean;
  productoNombre: string;
  productoMarca: string | null;
  productoActivo: boolean;
  idCategoria: number;
  categoriaNombre: string;
  idInventario: number;
  idAlmacen: number;
  existencia: number;
  cantidadReservada: number;
  cantidadDisponible: number;
  puntoReorden: number;
  estadoStock: EstadoStock;
  fechaActualizacion: string;
  atributos: AtributoVarianteResumen[];
}

export interface RespuestaPaginadaInventarioDTO {
  datos: InventarioItemDTO[];
  paginacion: {
    paginaActual: number;
    limite: number;
    totalRegistros: number;
    totalPaginas: number;
  };
}

export interface MovimientoKardexItemDTO {
  idMovimiento: number;
  idVariante: number;
  sku: string;
  idProducto: number;
  productoNombre: string;
  idAlmacen: number;
  almacenNombre: string;
  tipoMovimiento: string;
  cantidad: number;
  existenciaAnterior: number;
  existenciaPosterior: number;
  idPedido: number | null;
  idUsuario: number;
  usuarioNombreCompleto: string;
  usuarioCorreo: string;
  motivo: string;
  fechaMovimiento: string;
}

export interface RespuestaPaginadaKardexDTO {
  datos: MovimientoKardexItemDTO[];
  paginacion: {
    paginaActual: number;
    limite: number;
    totalRegistros: number;
    totalPaginas: number;
  };
}
