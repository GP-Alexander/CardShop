import { z } from "zod";
import { PaginacionQuerySchema } from "./paginacion";

export const EstadoPedidoEnum = z.enum([
  "PendientePago",
  "Pagado",
  "EnPreparacion",
  "Despachado",
  "Entregado",
  "Cancelado",
  "DevueltoParcial",
  "DevueltoTotal",
]);
export type EstadoPedido = z.infer<typeof EstadoPedidoEnum>;

export const TransicionEstadoPedidoSchema = z.object({
  nuevoEstado: EstadoPedidoEnum,
  motivo: z.string().trim().min(3, "El motivo del cambio de estado es requerido"),
});
export type TransicionEstadoPedidoInput = z.infer<typeof TransicionEstadoPedidoSchema>;

export const FiltroPedidosQuerySchema = PaginacionQuerySchema.extend({
  estado: EstadoPedidoEnum.optional(),
  idCliente: z.coerce.number().int().positive().optional(),
  fechaInicio: z.string().datetime().optional(),
  fechaFin: z.string().datetime().optional(),
});
export type FiltroPedidosQuery = z.infer<typeof FiltroPedidosQuerySchema>;

export interface PedidoLineaDTO {
  idDetalle: number;
  idVariante: number;
  sku: string;
  nombreProducto: string;
  cantidad: number;
  precioUnitarioCongelado: number;
  subtotal: number;
  cantidadDevuelta: number;
}

export interface PedidoDTO {
  idPedido: number;
  numeroPedido: string;
  idCliente: number;
  nombreCliente: string;
  correoCliente: string;
  estado: EstadoPedido;
  subtotal: number;
  descuento: number;
  montoIva: number;
  total: number;
  fechaCreacion: string;
  direccionEntrega: Record<string, unknown>;
  lineas: PedidoLineaDTO[];
}
