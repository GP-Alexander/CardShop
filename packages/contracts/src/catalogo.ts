import { z } from "zod";
import { PaginacionQuerySchema } from "./paginacion";

export const CategoriaSchema = z.object({
  idCategoria: z.number().int().positive().optional(),
  nombre: z.string().trim().min(2, "El nombre de la categoría es obligatorio").max(100),
  descripcion: z.string().trim().max(500).optional(),
  estaActiva: z.boolean().default(true),
});
export type CategoriaInput = z.infer<typeof CategoriaSchema>;

export const VarianteProductoSchema = z.object({
  idVariante: z.number().int().positive().optional(),
  sku: z.string().trim().min(3).max(50),
  precio: z.coerce.number().positive("El precio debe ser mayor a 0"),
  existencia: z.coerce.number().int().nonnegative("La existencia no puede ser negativa"),
  atributos: z.record(z.string(), z.string()).optional(),
  estaActiva: z.boolean().default(true),
});
export type VarianteProductoInput = z.infer<typeof VarianteProductoSchema>;

export const ProductoSchema = z.object({
  idProducto: z.number().int().positive().optional(),
  idCategoria: z.number().int().positive("La categoría es requerida"),
  nombre: z.string().trim().min(3, "El nombre del producto es requerido").max(200),
  descripcion: z.string().trim().max(2000).optional(),
  imagenes: z.array(z.string().url("URL de imagen inválida")).default([]),
  estaActivo: z.boolean().default(true),
  variantes: z.array(VarianteProductoSchema).min(1, "Debe tener al menos una variante"),
});
export type ProductoInput = z.infer<typeof ProductoSchema>;

export const FiltroCatalogoQuerySchema = PaginacionQuerySchema.extend({
  idCategoria: z.coerce.number().int().positive().optional(),
  precioMin: z.coerce.number().nonnegative().optional(),
  precioMax: z.coerce.number().positive().optional(),
  soloDisponibles: z.coerce.boolean().optional(),
});
export type FiltroCatalogoQuery = z.infer<typeof FiltroCatalogoQuerySchema>;
