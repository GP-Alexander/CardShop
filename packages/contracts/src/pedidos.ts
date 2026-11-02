import { z } from "zod";
import { PaginacionQuerySchema } from "./paginacion";

export const EstadoPedidoEnum = z.enum([
  "PENDIENTE_PAGO",
  "PAGADO",
  "PREPARANDO",
  "DESPACHADO",
  "ENTREGADO",
  "CANCELADO",
  "DEVOLUCION_PARCIAL",
  "DEVOLUCION_TOTAL",
  "PendientePago",
  "Pagado",
  "EnPreparacion",
  "Preparando",
  "Despachado",
  "Entregado",
  "Cancelado",
  "DevueltoParcial",
  "DevueltoTotal",
]);
export type EstadoPedido = z.infer<typeof EstadoPedidoEnum>;

export const TransicionEstadoPedidoSchema = z.object({
  nuevoEstado: z.string().trim().min(2, "El nuevo estado es requerido"),
  motivo: z.string().trim().min(3, "El motivo del cambio de estado es requerido"),
});
export type TransicionEstadoPedidoInput = z.infer<typeof TransicionEstadoPedidoSchema>;

export const FiltroPedidosQuerySchema = PaginacionQuerySchema.extend({
  estado: z.string().optional(),
  idCliente: z.coerce.number().int().positive().optional(),
  busqueda: z.string().optional(),
  fechaInicio: z.string().optional(),
  fechaFin: z.string().optional(),
});
export type FiltroPedidosQuery = z.infer<typeof FiltroPedidosQuerySchema>;

export interface PedidoLineaDTO {
  idPedidoDetalle: number;
  idPedido: number;
  idVariante: number;
  sku: string;
  nombreProducto: string;
  descripcionVariante: string;
  precioUnitario: number;
  cantidad: number;
  importeBruto: number;
  descuentoLinea: number;
  totalLinea: number;
  ivaLinea: number;
  cantidadDevuelta: number;
  cantidadDisponibleParaDevolver: number;
}

export interface HistorialEstadoDTO {
  idHistorialEstado: number;
  fechaCambio: string;
  estadoAnteriorCodigo: string | null;
  estadoAnteriorNombre: string | null;
  estadoNuevoCodigo: string;
  estadoNuevoNombre: string;
  idUsuario: number;
  usuarioNombre: string;
  motivoComentario: string | null;
}

export interface PedidoResumenDTO {
  idPedido: number;
  numeroPedido: string;
  fechaCreacion: string;
  fechaPago: string | null;
  fechaEntrega: string | null;
  fechaCancelacion: string | null;
  subtotal: number;
  descuento: number;
  costoEnvio: number;
  total: number;
  moneda: string;
  estadoCodigo: string;
  estadoNombre: string;
  permiteCancelacion?: boolean;
  cantidadLineas: number;
  totalArticulos: number;
  idCliente?: number;
  clienteNombre?: string;
  clienteCorreo?: string;
}

export interface PedidoDetalleDTO {
  idPedido: number;
  numeroPedido: string;
  idUsuario: number;
  clienteNombre: string;
  clienteCorreo: string;
  idEstadoPedido: number;
  estadoCodigo: string;
  estadoNombre: string;
  permiteCancelacion: boolean;
  destinatarioSnapshot: string;
  telefonoSnapshot: string;
  direccionSnapshot: string;
  subtotal: number;
  descuento: number;
  costoEnvio: number;
  total: number;
  ivaIncluido: number;
  porcentajeIVA: number;
  moneda: string;
  fechaCreacion: string;
  fechaActualizacion: string;
  fechaPago: string | null;
  fechaEntrega: string | null;
  fechaCancelacion: string | null;
  idCupon: number | null;
  codigoCupon: string | null;
  idPago: number | null;
  pagoProveedor: string | null;
  pagoReferencia: string | null;
  pagoEstado: string | null;
  pagoFecha: string | null;
  lineas: PedidoLineaDTO[];
  historialEstados: HistorialEstadoDTO[];
}
