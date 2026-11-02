import { z } from "zod";

export const RangoFechasQuerySchema = z.object({
  fechaInicio: z.string().datetime().optional(),
  fechaFin: z.string().datetime().optional(),
});
export type RangoFechasQuery = z.infer<typeof RangoFechasQuerySchema>;

export const FiltroVentasPeriodoQuerySchema = z.object({
  fechaInicio: z.string().datetime().optional(),
  fechaFin: z.string().datetime().optional(),
  agrupacion: z.enum(["dia", "semana", "mes"]).default("dia"),
});
export type FiltroVentasPeriodoQuery = z.infer<typeof FiltroVentasPeriodoQuerySchema>;

export const FiltroTopProductosQuerySchema = z.object({
  fechaInicio: z.string().datetime().optional(),
  fechaFin: z.string().datetime().optional(),
  limite: z.coerce.number().int().min(1).max(100).default(10),
});
export type FiltroTopProductosQuery = z.infer<typeof FiltroTopProductosQuerySchema>;

export const FiltroVentasPorCategoriaQuerySchema = z.object({
  fechaInicio: z.string().datetime().optional(),
  fechaFin: z.string().datetime().optional(),
});
export type FiltroVentasPorCategoriaQuery = z.infer<typeof FiltroVentasPorCategoriaQuerySchema>;

export const FiltroCarritosAbandonadosQuerySchema = z.object({
  horasInactividad: z.coerce.number().int().min(1).default(24),
  pagina: z.coerce.number().int().min(1).default(1),
  tamanoPagina: z.coerce.number().int().min(1).max(100).default(20),
});
export type FiltroCarritosAbandonadosQuery = z.infer<typeof FiltroCarritosAbandonadosQuerySchema>;

export interface VentasPeriodoDTO {
  periodo: string;
  totalVentas: number;
  totalPedidos: number;
  ticketPromedio: number;
}

export interface VentasPorCategoriaDTO {
  idCategoria: number;
  nombreCategoria: string;
  totalVentas: number;
  unidadesVendidas: number;
}

export interface TopProductoDTO {
  idProducto: number;
  nombreProducto: string;
  skuVariante: string;
  unidadesVendidas: number;
  totalGenerado: number;
}

export interface CarritoAbandonadoDTO {
  idCarrito: number;
  idUsuario: number | null;
  nombreUsuario: string;
  email: string | null;
  totalArticulos: number;
  montoEstimado: number;
  fechaCreacion: string;
  fechaUltimaActividad: string;
  horasInactivo: number;
}

export interface CarritosAbandonadosPaginadosDTO {
  items: CarritoAbandonadoDTO[];
  total: number;
  pagina: number;
  tamanoPagina: number;
  totalPaginas: number;
}

export interface DashboardResumenDTO {
  ventasHoy: number;
  pedidosHoy: number;
  ticketPromedioMes: number;
  carritosAbandonadosPeriodo: number;
  ventasPorPeriodo: VentasPeriodoDTO[];
  ventasPorCategoria: VentasPorCategoriaDTO[];
  topProductos: TopProductoDTO[];
}
