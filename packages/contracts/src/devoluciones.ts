import { z } from "zod";

export const LineaDevolucionInputSchema = z.object({
  idPedidoDetalle: z.coerce.number().int().positive().optional(),
  idDetallePedido: z.coerce.number().int().positive().optional(),
  cantidad: z.coerce.number().int().positive("La cantidad a devolver debe ser mayor a 0"),
}).refine(data => data.idPedidoDetalle !== undefined || data.idDetallePedido !== undefined, {
  message: "Debe proveer idPedidoDetalle",
});

export const CrearDevolucionSchema = z.object({
  idPedido: z.coerce.number().int().positive("Pedido requerido"),
  motivo: z.string().trim().min(5, "El motivo de la devolución es obligatorio"),
  lineas: z.array(LineaDevolucionInputSchema).min(1, "Debe incluir al menos una línea a devolver"),
});
export type CrearDevolucionInput = z.infer<typeof CrearDevolucionSchema>;

export interface DevolucionDTO {
  idDevolucion: number;
  idPedido: number;
  numeroPedido: string;
  montoReembolso: number;
  estadoPedidoActualizado: string;
  fechaResolucion: string;
}
