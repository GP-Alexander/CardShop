import { z } from "zod";

export const PaginacionQuerySchema = z.object({
  pagina: z.coerce.number().int().positive().default(1),
  limite: z.coerce.number().int().positive().max(100).default(10),
  ordenarPor: z.string().optional(),
  orden: z.enum(["ASC", "DESC"]).default("ASC"),
  busqueda: z.string().trim().optional(),
});

export type PaginacionQuery = z.infer<typeof PaginacionQuerySchema>;

export interface RespuestaPaginada<T> {
  datos: T[];
  paginacion: {
    paginaActual: number;
    limite: number;
    totalRegistros: number;
    totalPaginas: number;
  };
}
