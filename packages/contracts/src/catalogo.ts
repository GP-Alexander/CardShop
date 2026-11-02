import { z } from "zod";

/* =========================================================================
   1. CATEGORÍAS
   ========================================================================= */

export const CrearCategoriaSchema = z.object({
  nombre: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres").max(120, "Máximo 120 caracteres"),
  slug: z.string().trim().min(2).max(140).regex(/^[a-z0-9-]+$/, "El slug solo puede contener letras minúsculas, números y guiones").optional().nullable(),
  descripcion: z.string().trim().max(500, "Máximo 500 caracteres").optional().nullable(),
  idCategoriaPadre: z.coerce.number().int().positive().optional().nullable(),
  ordenVisual: z.coerce.number().int().min(0).default(0),
});
export type CrearCategoriaInput = z.infer<typeof CrearCategoriaSchema>;

export const ActualizarCategoriaSchema = z.object({
  nombre: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres").max(120, "Máximo 120 caracteres"),
  slug: z.string().trim().min(2).max(140).regex(/^[a-z0-9-]+$/, "El slug solo puede contener letras minúsculas, números y guiones"),
  descripcion: z.string().trim().max(500, "Máximo 500 caracteres").optional().nullable(),
  idCategoriaPadre: z.coerce.number().int().positive().optional().nullable(),
  ordenVisual: z.coerce.number().int().min(0).default(0),
});
export type ActualizarCategoriaInput = z.infer<typeof ActualizarCategoriaSchema>;

export const CambiarEstadoCategoriaSchema = z.object({
  estaActiva: z.boolean({ required_error: "El estado activo es obligatorio" }),
});
export type CambiarEstadoCategoriaInput = z.infer<typeof CambiarEstadoCategoriaSchema>;

export const ListarCategoriasQuerySchema = z.object({
  soloActivas: z.preprocess((v) => {
    if (typeof v === "string") return v.toLowerCase() === "true";
    if (typeof v === "boolean") return v;
    return v;
  }, z.boolean()).default(false),
});
export type ListarCategoriasQuery = z.infer<typeof ListarCategoriasQuerySchema>;

export interface CategoriaDTO {
  idCategoria: number;
  idCategoriaPadre: number | null;
  nombreCategoriaPadre?: string | null;
  nombre: string;
  slug: string;
  descripcion: string | null;
  estaActiva: boolean;
  ordenVisual: number;
  fechaCreacion: string;
  totalProductos: number;
}

/* =========================================================================
   2. ATRIBUTOS Y VALORES
   ========================================================================= */

export const CrearAtributoSchema = z.object({
  nombre: z.string().trim().min(2, "El nombre del atributo debe tener al menos 2 caracteres").max(60, "Máximo 60 caracteres"),
});
export type CrearAtributoInput = z.infer<typeof CrearAtributoSchema>;

export const CrearValorAtributoSchema = z.object({
  idAtributo: z.coerce.number().int().positive("El ID del atributo es requerido").optional(),
  valor: z.string().trim().min(1, "El valor es obligatorio").max(80, "Máximo 80 caracteres"),
  ordenVisual: z.coerce.number().int().min(0).default(0),
});
export type CrearValorAtributoInput = z.infer<typeof CrearValorAtributoSchema>;

export interface AtributoValorDTO {
  idValorAtributo: number;
  valor: string;
  ordenVisual: number;
}

export interface AtributoConValoresDTO {
  idAtributo: number;
  atributo: string;
  estaActivo: boolean;
  valores: AtributoValorDTO[];
}

/* =========================================================================
   3. PRODUCTOS Y VARIANTES
   ========================================================================= */

export const AtributoVarianteInputSchema = z.object({
  idAtributo: z.coerce.number().int().positive(),
  idValorAtributo: z.coerce.number().int().positive(),
});
export type AtributoVarianteInput = z.infer<typeof AtributoVarianteInputSchema>;

export const VarianteInputSchema = z.object({
  sku: z.string().trim().min(3, "El SKU debe tener al menos 3 caracteres").max(80, "Máximo 80 caracteres").regex(/^[a-zA-Z0-9_-]+$/, "El SKU solo puede contener caracteres alfanuméricos, guiones y guiones bajos"),
  precio: z.coerce.number().positive("El precio debe ser mayor a 0"),
  costo: z.coerce.number().positive().optional().nullable(),
  pesoGramos: z.coerce.number().int().positive().optional().nullable(),
  atributos: z.array(AtributoVarianteInputSchema).default([]),
});
export type VarianteInput = z.infer<typeof VarianteInputSchema>;

export const ImagenProductoInputSchema = z.object({
  url: z.string().trim().min(5, "URL requerida").max(1000),
  ordenVisual: z.coerce.number().int().min(0).default(0),
  esPrincipal: z.boolean().default(false),
  skuVariante: z.string().trim().optional().nullable(),
});
export type ImagenProductoInput = z.infer<typeof ImagenProductoInputSchema>;

export const CrearProductoSchema = z.object({
  idCategoria: z.coerce.number().int().positive("La categoría es obligatoria"),
  nombre: z.string().trim().min(3, "El nombre del producto debe tener al menos 3 caracteres").max(180, "Máximo 180 caracteres"),
  slug: z.string().trim().min(2).max(200).regex(/^[a-z0-9-]+$/, "El slug solo puede contener letras minúsculas, números y guiones").optional().nullable(),
  descripcion: z.string().trim().max(4000).optional().nullable(),
  marca: z.string().trim().max(100).optional().nullable(),
  variantes: z.array(VarianteInputSchema).min(1, "Debe registrar al menos una variante para el producto"),
  imagenes: z.array(ImagenProductoInputSchema).optional().nullable().default([]),
});
export type CrearProductoInput = z.infer<typeof CrearProductoSchema>;

export const ActualizarProductoSchema = z.object({
  idCategoria: z.coerce.number().int().positive("La categoría es obligatoria"),
  nombre: z.string().trim().min(3, "El nombre del producto debe tener al menos 3 caracteres").max(180, "Máximo 180 caracteres"),
  slug: z.string().trim().min(2).max(200).regex(/^[a-z0-9-]+$/, "El slug solo puede contener letras minúsculas, números y guiones"),
  descripcion: z.string().trim().max(4000).optional().nullable(),
  marca: z.string().trim().max(100).optional().nullable(),
  imagenes: z.array(ImagenProductoInputSchema).optional().nullable(),
});
export type ActualizarProductoInput = z.infer<typeof ActualizarProductoSchema>;

export const CambiarEstadoProductoSchema = z.object({
  estaActivo: z.boolean({ required_error: "El estado activo es obligatorio" }),
});
export type CambiarEstadoProductoInput = z.infer<typeof CambiarEstadoProductoSchema>;

export const ActualizarVarianteSchema = z.object({
  precio: z.coerce.number().positive("El precio debe ser mayor a 0"),
  costo: z.coerce.number().positive().optional().nullable(),
  pesoGramos: z.coerce.number().int().positive().optional().nullable(),
  estaActiva: z.boolean().default(true),
});
export type ActualizarVarianteInput = z.infer<typeof ActualizarVarianteSchema>;

export const ListarCatalogoQuerySchema = z.object({
  pagina: z.coerce.number().int().positive().default(1),
  limite: z.coerce.number().int().positive().max(100).default(12),
  busqueda: z.string().trim().optional(),
  idCategoria: z.coerce.number().int().positive().optional(),
  precioMin: z.coerce.number().nonnegative().optional(),
  precioMax: z.coerce.number().positive().optional(),
  soloActivos: z.preprocess((v) => {
    if (typeof v === "string") return v.toLowerCase() === "true";
    if (typeof v === "boolean") return v;
    return v;
  }, z.boolean()).default(true),
  columnaOrden: z.enum(["fechacreacion", "precio", "nombre"]).default("fechacreacion"),
  orden: z.enum(["ASC", "DESC", "asc", "desc"]).default("DESC").transform((v) => v.toUpperCase() as "ASC" | "DESC"),
});
export type ListarCatalogoQuery = z.infer<typeof ListarCatalogoQuerySchema>;

export interface ProductoItemDTO {
  idProducto: number;
  idCategoria: number;
  categoriaNombre: string;
  nombre: string;
  slug: string;
  marca: string | null;
  estaActivo: boolean;
  fechaCreacion: string;
  fechaActualizacion: string;
  precioMinimo: number;
  precioMaximo: number;
  totalVariantes: number;
  imagenPrincipalUrl: string | null;
}

export interface VarianteAtributoDetalleDTO {
  idAtributo: number;
  atributo: string;
  idValorAtributo: number;
  valor: string;
}

export interface VarianteDetalleDTO {
  idVariante: number;
  idProducto: number;
  sku: string;
  precio: number;
  costo: number | null;
  pesoGramos: number | null;
  estaActiva: boolean;
  existencia: number;
  fechaCreacion: string;
  fechaActualizacion: string;
  atributos: VarianteAtributoDetalleDTO[];
}

export interface ImagenProductoDTO {
  idImagenProducto: number;
  idProducto: number;
  idVariante: number | null;
  url: string;
  ordenVisual: number;
  esPrincipal: boolean;
}

export interface ProductoDetalleDTO {
  idProducto: number;
  idCategoria: number;
  categoriaNombre: string;
  categoriaSlug: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  marca: string | null;
  estaActivo: boolean;
  fechaCreacion: string;
  fechaActualizacion: string;
  variantes: VarianteDetalleDTO[];
  imagenes: ImagenProductoDTO[];
}

/* =========================================================================
   COMPATIBILIDAD CON ESQUEMAS PREVIOS
   ========================================================================= */
export const CategoriaSchema = CrearCategoriaSchema;
export type CategoriaInput = CrearCategoriaInput;

export const VarianteProductoSchema = VarianteInputSchema;
export type VarianteProductoInput = VarianteInput;

export const ProductoSchema = CrearProductoSchema;
export type ProductoInput = CrearProductoInput;

export const FiltroCatalogoQuerySchema = ListarCatalogoQuerySchema;
export type FiltroCatalogoQuery = ListarCatalogoQuery;
