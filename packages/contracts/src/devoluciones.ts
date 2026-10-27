import { z } from "zod";

export const LineaDevolucionInputSchema = z.object({
  idDetallePedido: z.number().int().positive("Línea de pedido requerida"),
  cantidad: z.number().int().positive("La cantidad a devolver debe ser mayor a 0"),
});

export const CrearDevolucionSchema = z.object({
  idPedido: z.number().int().positive("Pedido requerido"),
  motivo: z.string().trim().min(5, "El motivo de la devolución es obligatorio"),
  lineas: z.array(LineaDevolucionInputSchema).min(1, "Debe incluir al menos una línea a devolver"),
});
export type CrearDevolucionInput = z.infer<typeof CrearDevolucionSchema>;

export interface DevolucionDTO {
  idDevolucion: number;
  idPedido: number;
  motivo: string;
  montoReembolso: number;
  fechaCreacion: string;
  usuarioRegistro: string;
  lineas: Array<{
    idDevolucionDetalle: number;
    idDetallePedido: number;
    cantidad: number;
    montoUnitario: number;
  }>;
}
