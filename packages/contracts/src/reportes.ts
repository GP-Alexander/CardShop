import { z } from "zod";

export const RangoFechasQuerySchema = z.object({
  fechaInicio: z.string().datetime(),
  fechaFin: z.string().datetime(),
});
export type RangoFechasQuery = z.infer<typeof RangoFechasQuerySchema>;

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

export interface DashboardResumenDTO {
  ventasHoy: number;
  pedidosHoy: number;
  ticketPromedioMes: number;
  carritosAbandonadosPeriodo: number;
  ventasPorPeriodo: VentasPeriodoDTO[];
  ventasPorCategoria: VentasPorCategoriaDTO[];
  topProductos: TopProductoDTO[];
}
