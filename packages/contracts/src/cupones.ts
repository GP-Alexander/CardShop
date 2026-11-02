import { z } from "zod";

export const ListarCuponesQuerySchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
  busqueda: z.string().trim().optional(),
  estaActivo: z
    .preprocess((val) => (val === "true" || val === true || val === 1 || val === "1" ? true : val === "false" || val === false || val === 0 || val === "0" ? false : undefined), z.boolean())
    .optional(),
});

export type ListarCuponesQuery = z.infer<typeof ListarCuponesQuerySchema>;

export const CrearCuponSchema = z
  .object({
    codigo: z
      .string()
      .trim()
      .min(3, "El código debe tener al menos 3 caracteres")
      .max(50)
      .transform((val) => val.toUpperCase()),
    descripcion: z.string().trim().max(250).optional(),
    tipoDescuento: z.enum(["PORCENTAJE", "MONTO"], {
      errorMap: () => ({ message: "El tipo de descuento debe ser PORCENTAJE o MONTO" }),
    }),
    valorDescuento: z.number().positive("El valor del descuento debe ser mayor a cero"),
    alcance: z.enum(["CARRITO", "CATEGORIA"]).default("CARRITO"),
    idCategoria: z.number().int().positive().optional(),
    montoMinimoCompra: z.number().min(0, "El monto mínimo no puede ser negativo").default(0),
    descuentoMaximo: z.number().positive().optional(),
    limiteUsosTotal: z.number().int().positive().optional(),
    limiteUsosPorCliente: z.number().int().positive().default(1),
    fechaInicio: z.string().datetime({ message: "Fecha de inicio inválida (formato ISO)" }),
    fechaFin: z.string().datetime({ message: "Fecha de fin inválida (formato ISO)" }),
  })
  .refine((data) => new Date(data.fechaFin) > new Date(data.fechaInicio), {
    message: "La fecha de fin debe ser posterior a la fecha de inicio",
    path: ["fechaFin"],
  })
  .refine((data) => data.tipoDescuento !== "PORCENTAJE" || data.valorDescuento <= 100, {
    message: "Un cupón porcentual no puede exceder el 100%",
    path: ["valorDescuento"],
  })
  .refine((data) => data.alcance !== "CATEGORIA" || data.idCategoria !== undefined, {
    message: "Debe especificar la categoría para un cupón con alcance de categoría",
    path: ["idCategoria"],
  });

export type CrearCuponInput = z.infer<typeof CrearCuponSchema>;

export interface CuponItemDTO {
  idCupon: number;
  codigo: string;
  descripcion: string | null;
  tipoDescuento: "PORCENTAJE" | "MONTO";
  valorDescuento: number;
  alcance: "CARRITO" | "CATEGORIA";
  idCategoria: number | null;
  categoriaNombre: string | null;
  montoMinimoCompra: number;
  descuentoMaximo: number | null;
  limiteUsosTotal: number | null;
  usosActuales: number;
  limiteUsosPorCliente: number;
  fechaInicio: string;
  fechaFin: string;
  estaActivo: boolean;
  fechaCreacion: string;
}

export interface RespuestaPaginadaCuponesDTO {
  datos: CuponItemDTO[];
  paginacion: {
    paginaActual: number;
    limite: number;
    totalRegistros: number;
    totalPaginas: number;
  };
}
