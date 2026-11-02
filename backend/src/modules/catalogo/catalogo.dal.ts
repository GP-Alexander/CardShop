import sql from "mssql";
import { ejecutarSp } from "../../shared/db/ejecutarSp";
import {
  CategoriaDTO,
  CrearCategoriaInput,
  ActualizarCategoriaInput,
  AtributoConValoresDTO,
  CrearProductoInput,
  ActualizarProductoInput,
  ActualizarVarianteInput,
  ListarCatalogoQuery,
  ProductoItemDTO,
  ProductoDetalleDTO,
  VarianteDetalleDTO,
  ImagenProductoDTO,
} from "@shopcart/contracts";

/* Interfaces de filas de BD */
interface CategoriaDbRow {
  IDCategoria: number;
  IDCategoriaPadre: number | null;
  NombreCategoriaPadre: string | null;
  Nombre: string;
  Slug: string;
  Descripcion: string | null;
  EstaActiva: boolean;
  OrdenVisual: number;
  FechaCreacion: Date;
  TotalProductos: number;
}

interface AtributoDbRow {
  IDAtributo: number;
  Atributo: string;
  EstaActivo: boolean;
  IDValorAtributo: number | null;
  Valor: string | null;
  OrdenVisual: number | null;
}

interface ProductoItemDbRow {
  IDProducto: number;
  IDCategoria: number;
  CategoriaNombre: string;
  Nombre: string;
  Slug: string;
  Marca: string | null;
  EstaActivo: boolean;
  FechaCreacion: Date;
  FechaActualizacion: Date;
  PrecioMinimo: number;
  PrecioMaximo: number;
  TotalVariantes: number;
  ImagenPrincipalUrl: string | null;
  TotalRegistros: number;
}

interface ProductoHeaderDbRow {
  IDProducto: number;
  IDCategoria: number;
  CategoriaNombre: string;
  CategoriaSlug: string;
  Nombre: string;
  Slug: string;
  Descripcion: string | null;
  Marca: string | null;
  EstaActivo: boolean;
  FechaCreacion: Date;
  FechaActualizacion: Date;
}

interface VarianteDbRow {
  IDVariante: number;
  IDProducto: number;
  SKU: string;
  Precio: number;
  Costo: number | null;
  PesoGramos: number | null;
  EstaActiva: boolean;
  FechaCreacion: Date;
  FechaActualizacion: Date;
  Existencia: number;
  AtributosJson: string | null;
}

interface ImagenDbRow {
  IDImagenProducto: number;
  IDProducto: number;
  IDVariante: number | null;
  URL: string;
  OrdenVisual: number;
  EsPrincipal: boolean;
}

export class CatalogoDal {
  /* =========================================================================
     CATEGORÍAS
     ========================================================================= */

  async crearCategoria(
    idUsuarioAdmin: number,
    datos: CrearCategoriaInput,
    ip?: string
  ): Promise<CategoriaDTO> {
    const res = await ejecutarSp<CategoriaDbRow>("dbo.SP_Categoria_Crear", [
      { nombre: "IDUsuarioAdmin", tipo: sql.Int, valor: idUsuarioAdmin },
      { nombre: "Nombre", tipo: sql.NVarChar(120), valor: datos.nombre },
      { nombre: "Slug", tipo: sql.VarChar(140), valor: datos.slug ?? null },
      { nombre: "Descripcion", tipo: sql.NVarChar(500), valor: datos.descripcion ?? null },
      { nombre: "IDCategoriaPadre", tipo: sql.Int, valor: datos.idCategoriaPadre ?? null },
      { nombre: "OrdenVisual", tipo: sql.Int, valor: datos.ordenVisual ?? 0 },
      { nombre: "DireccionIP", tipo: sql.VarChar(45), valor: ip ?? null },
    ]);

    const row = res.recordset[0];
    return this.mapearCategoria(row);
  }

  async listarCategorias(soloActivas = false): Promise<CategoriaDTO[]> {
    const res = await ejecutarSp<CategoriaDbRow>("dbo.SP_Categoria_Listar", [
      { nombre: "SoloActivas", tipo: sql.Bit, valor: soloActivas },
    ]);

    return (res.recordset || []).map((row) => this.mapearCategoria(row));
  }

  async obtenerCategoriaPorId(idCategoria: number): Promise<CategoriaDTO> {
    const res = await ejecutarSp<CategoriaDbRow>("dbo.SP_Categoria_ObtenerPorId", [
      { nombre: "IDCategoria", tipo: sql.Int, valor: idCategoria },
    ]);

    return this.mapearCategoria(res.recordset[0]);
  }

  async actualizarCategoria(
    idUsuarioAdmin: number,
    idCategoria: number,
    datos: ActualizarCategoriaInput,
    ip?: string
  ): Promise<CategoriaDTO> {
    const res = await ejecutarSp<CategoriaDbRow>("dbo.SP_Categoria_Actualizar", [
      { nombre: "IDUsuarioAdmin", tipo: sql.Int, valor: idUsuarioAdmin },
      { nombre: "IDCategoria", tipo: sql.Int, valor: idCategoria },
      { nombre: "Nombre", tipo: sql.NVarChar(120), valor: datos.nombre },
      { nombre: "Slug", tipo: sql.VarChar(140), valor: datos.slug },
      { nombre: "Descripcion", tipo: sql.NVarChar(500), valor: datos.descripcion ?? null },
      { nombre: "IDCategoriaPadre", tipo: sql.Int, valor: datos.idCategoriaPadre ?? null },
      { nombre: "OrdenVisual", tipo: sql.Int, valor: datos.ordenVisual ?? 0 },
      { nombre: "DireccionIP", tipo: sql.VarChar(45), valor: ip ?? null },
    ]);

    return this.mapearCategoria(res.recordset[0]);
  }

  async cambiarEstadoCategoria(
    idUsuarioAdmin: number,
    idCategoria: number,
    estaActiva: boolean,
    ip?: string
  ): Promise<CategoriaDTO> {
    const res = await ejecutarSp<CategoriaDbRow>("dbo.SP_Categoria_CambiarEstado", [
      { nombre: "IDUsuarioAdmin", tipo: sql.Int, valor: idUsuarioAdmin },
      { nombre: "IDCategoria", tipo: sql.Int, valor: idCategoria },
      { nombre: "EstaActiva", tipo: sql.Bit, valor: estaActiva },
      { nombre: "DireccionIP", tipo: sql.VarChar(45), valor: ip ?? null },
    ]);

    return this.mapearCategoria(res.recordset[0]);
  }

  /* =========================================================================
     ATRIBUTOS Y VALORES
     ========================================================================= */

  async listarAtributosConValores(): Promise<AtributoConValoresDTO[]> {
    const res = await ejecutarSp<AtributoDbRow>("dbo.SP_Atributo_ListarConValores");
    const rows = res.recordset || [];

    const agrupado = new Map<number, AtributoConValoresDTO>();

    for (const r of rows) {
      if (!agrupado.has(r.IDAtributo)) {
        agrupado.set(r.IDAtributo, {
          idAtributo: r.IDAtributo,
          atributo: r.Atributo,
          estaActivo: r.EstaActivo,
          valores: [],
        });
      }

      if (r.IDValorAtributo !== null && r.Valor !== null) {
        agrupado.get(r.IDAtributo)!.valores.push({
          idValorAtributo: r.IDValorAtributo,
          valor: r.Valor,
          ordenVisual: r.OrdenVisual ?? 0,
        });
      }
    }

    return Array.from(agrupado.values());
  }

  async crearAtributo(nombre: string): Promise<{ idAtributo: number; nombre: string; estaActivo: boolean }> {
    const res = await ejecutarSp<{ IDAtributo: number; Nombre: string; EstaActivo: boolean }>(
      "dbo.SP_Atributo_Crear",
      [{ nombre: "Nombre", tipo: sql.NVarChar(60), valor: nombre }]
    );
    const r = res.recordset[0];
    return {
      idAtributo: r.IDAtributo,
      nombre: r.Nombre,
      estaActivo: r.EstaActivo,
    };
  }

  async crearValorAtributo(
    idAtributo: number,
    valor: string,
    ordenVisual = 0
  ): Promise<{ idValorAtributo: number; idAtributo: number; valor: string; ordenVisual: number }> {
    const res = await ejecutarSp<{ IDValorAtributo: number; IDAtributo: number; Valor: string; OrdenVisual: number }>(
      "dbo.SP_ValorAtributo_Crear",
      [
        { nombre: "IDAtributo", tipo: sql.Int, valor: idAtributo },
        { nombre: "Valor", tipo: sql.NVarChar(80), valor: valor },
        { nombre: "OrdenVisual", tipo: sql.Int, valor: ordenVisual },
      ]
    );
    const r = res.recordset[0];
    return {
      idValorAtributo: r.IDValorAtributo,
      idAtributo: r.IDAtributo,
      valor: r.Valor,
      ordenVisual: r.OrdenVisual,
    };
  }

  /* =========================================================================
     PRODUCTOS Y VARIANTES
     ========================================================================= */

  async crearProducto(
    idUsuarioAdmin: number,
    datos: CrearProductoInput,
    ip?: string
  ): Promise<ProductoDetalleDTO> {
    const variantesJson = JSON.stringify(datos.variantes);
    const imagenesJson = datos.imagenes && datos.imagenes.length > 0 ? JSON.stringify(datos.imagenes) : null;

    const res = await ejecutarSp<any>("dbo.SP_Producto_CrearConVariantes", [
      { nombre: "IDUsuarioAdmin", tipo: sql.Int, valor: idUsuarioAdmin },
      { nombre: "IDCategoria", tipo: sql.Int, valor: datos.idCategoria },
      { nombre: "Nombre", tipo: sql.NVarChar(180), valor: datos.nombre },
      { nombre: "Slug", tipo: sql.VarChar(200), valor: datos.slug ?? null },
      { nombre: "Descripcion", tipo: sql.NVarChar(sql.MAX), valor: datos.descripcion ?? null },
      { nombre: "Marca", tipo: sql.NVarChar(100), valor: datos.marca ?? null },
      { nombre: "VariantesJson", tipo: sql.NVarChar(sql.MAX), valor: variantesJson },
      { nombre: "ImagenesJson", tipo: sql.NVarChar(sql.MAX), valor: imagenesJson },
      { nombre: "DireccionIP", tipo: sql.VarChar(45), valor: ip ?? null },
    ]);

    return this.parsearProductoDetalle(res.recordsets);
  }

  async listarCatalogo(filtros: ListarCatalogoQuery): Promise<{
    productos: ProductoItemDTO[];
    totalRegistros: number;
  }> {
    const res = await ejecutarSp<ProductoItemDbRow>("dbo.SP_Producto_ListarCatalogo", [
      { nombre: "Pagina", tipo: sql.Int, valor: filtros.pagina },
      { nombre: "Limite", tipo: sql.Int, valor: filtros.limite },
      { nombre: "Busqueda", tipo: sql.NVarChar(100), valor: filtros.busqueda || null },
      { nombre: "IDCategoria", tipo: sql.Int, valor: filtros.idCategoria ?? null },
      { nombre: "PrecioMin", tipo: sql.Decimal(12, 2), valor: filtros.precioMin ?? null },
      { nombre: "PrecioMax", tipo: sql.Decimal(12, 2), valor: filtros.precioMax ?? null },
      { nombre: "SoloActivos", tipo: sql.Bit, valor: filtros.soloActivos },
      { nombre: "ColumnaOrden", tipo: sql.VarChar(30), valor: filtros.columnaOrden },
      { nombre: "Orden", tipo: sql.VarChar(4), valor: filtros.orden },
    ]);

    const rows = res.recordset || [];
    const totalRegistros = rows.length > 0 ? rows[0].TotalRegistros : 0;

    const productos: ProductoItemDTO[] = rows.map((r) => ({
      idProducto: r.IDProducto,
      idCategoria: r.IDCategoria,
      categoriaNombre: r.CategoriaNombre,
      nombre: r.Nombre,
      slug: r.Slug,
      marca: r.Marca,
      estaActivo: r.EstaActivo,
      fechaCreacion: r.FechaCreacion.toISOString(),
      fechaActualizacion: r.FechaActualizacion.toISOString(),
      precioMinimo: Number(r.PrecioMinimo),
      precioMaximo: Number(r.PrecioMaximo),
      totalVariantes: r.TotalVariantes,
      imagenPrincipalUrl: r.ImagenPrincipalUrl,
    }));

    return { productos, totalRegistros };
  }

  async obtenerProductoDetalle(idProducto?: number, slug?: string): Promise<ProductoDetalleDTO> {
    const res = await ejecutarSp<any>("dbo.SP_Producto_ObtenerDetalle", [
      { nombre: "IDProducto", tipo: sql.Int, valor: idProducto ?? null },
      { nombre: "Slug", tipo: sql.VarChar(200), valor: slug ?? null },
    ]);

    return this.parsearProductoDetalle(res.recordsets);
  }

  async actualizarProducto(
    idUsuarioAdmin: number,
    idProducto: number,
    datos: ActualizarProductoInput,
    ip?: string
  ): Promise<ProductoDetalleDTO> {
    const res = await ejecutarSp<any>("dbo.SP_Producto_Actualizar", [
      { nombre: "IDUsuarioAdmin", tipo: sql.Int, valor: idUsuarioAdmin },
      { nombre: "IDProducto", tipo: sql.Int, valor: idProducto },
      { nombre: "IDCategoria", tipo: sql.Int, valor: datos.idCategoria },
      { nombre: "Nombre", tipo: sql.NVarChar(180), valor: datos.nombre },
      { nombre: "Slug", tipo: sql.VarChar(200), valor: datos.slug },
      { nombre: "Descripcion", tipo: sql.NVarChar(sql.MAX), valor: datos.descripcion ?? null },
      { nombre: "Marca", tipo: sql.NVarChar(100), valor: datos.marca ?? null },
      {
        nombre: "ImagenesJson",
        tipo: sql.NVarChar(sql.MAX),
        valor: datos.imagenes ? JSON.stringify(datos.imagenes) : null,
      },
      { nombre: "DireccionIP", tipo: sql.VarChar(45), valor: ip ?? null },
    ]);

    return this.parsearProductoDetalle(res.recordsets);
  }

  async cambiarEstadoProducto(
    idUsuarioAdmin: number,
    idProducto: number,
    estaActivo: boolean,
    ip?: string
  ): Promise<ProductoDetalleDTO> {
    const res = await ejecutarSp<any>("dbo.SP_Producto_CambiarEstado", [
      { nombre: "IDUsuarioAdmin", tipo: sql.Int, valor: idUsuarioAdmin },
      { nombre: "IDProducto", tipo: sql.Int, valor: idProducto },
      { nombre: "EstaActivo", tipo: sql.Bit, valor: estaActivo },
      { nombre: "DireccionIP", tipo: sql.VarChar(45), valor: ip ?? null },
    ]);

    return this.parsearProductoDetalle(res.recordsets);
  }

  async actualizarVariante(
    idUsuarioAdmin: number,
    idVariante: number,
    datos: ActualizarVarianteInput,
    ip?: string
  ): Promise<{
    idVariante: number;
    idProducto: number;
    sku: string;
    precio: number;
    costo: number | null;
    pesoGramos: number | null;
    estaActiva: boolean;
    fechaActualizacion: string;
  }> {
    const res = await ejecutarSp<{
      IDVariante: number;
      IDProducto: number;
      SKU: string;
      Precio: number;
      Costo: number | null;
      PesoGramos: number | null;
      EstaActiva: boolean;
      FechaActualizacion: Date;
    }>("dbo.SP_Variante_Actualizar", [
      { nombre: "IDUsuarioAdmin", tipo: sql.Int, valor: idUsuarioAdmin },
      { nombre: "IDVariante", tipo: sql.Int, valor: idVariante },
      { nombre: "Precio", tipo: sql.Decimal(12, 2), valor: datos.precio },
      { nombre: "Costo", tipo: sql.Decimal(12, 2), valor: datos.costo ?? null },
      { nombre: "PesoGramos", tipo: sql.Int, valor: datos.pesoGramos ?? null },
      { nombre: "EstaActiva", tipo: sql.Bit, valor: datos.estaActiva ?? true },
      { nombre: "DireccionIP", tipo: sql.VarChar(45), valor: ip ?? null },
    ]);

    const r = res.recordset[0];
    return {
      idVariante: r.IDVariante,
      idProducto: r.IDProducto,
      sku: r.SKU,
      precio: Number(r.Precio),
      costo: r.Costo !== null ? Number(r.Costo) : null,
      pesoGramos: r.PesoGramos,
      estaActiva: r.EstaActiva,
      fechaActualizacion: r.FechaActualizacion.toISOString(),
    };
  }

  /* =========================================================================
     MÉTODOS PRIVADOS DE PARSEO
     ========================================================================= */

  private mapearCategoria(r: CategoriaDbRow): CategoriaDTO {
    return {
      idCategoria: r.IDCategoria,
      idCategoriaPadre: r.IDCategoriaPadre,
      nombreCategoriaPadre: r.NombreCategoriaPadre,
      nombre: r.Nombre,
      slug: r.Slug,
      descripcion: r.Descripcion,
      estaActiva: r.EstaActiva,
      ordenVisual: r.OrdenVisual,
      fechaCreacion: r.FechaCreacion.toISOString(),
      totalProductos: r.TotalProductos ?? 0,
    };
  }

  private parsearProductoDetalle(recordsets: any[][]): ProductoDetalleDTO {
    const headerRows = (recordsets[0] || []) as ProductoHeaderDbRow[];
    const variantesRows = (recordsets[1] || []) as VarianteDbRow[];
    const imagenesRows = (recordsets[2] || []) as ImagenDbRow[];

    const h = headerRows[0];
    if (!h) {
      throw new Error("No se obtuvieron datos de cabecera del producto.");
    }

    const variantes: VarianteDetalleDTO[] = variantesRows.map((v) => {
      let atributos: any[] = [];
      if (v.AtributosJson) {
        try {
          atributos = JSON.parse(v.AtributosJson);
        } catch {
          atributos = [];
        }
      }
      return {
        idVariante: v.IDVariante,
        idProducto: v.IDProducto,
        sku: v.SKU,
        precio: Number(v.Precio),
        costo: v.Costo !== null ? Number(v.Costo) : null,
        pesoGramos: v.PesoGramos,
        estaActiva: v.EstaActiva,
        existencia: Number(v.Existencia ?? 0),
        fechaCreacion: v.FechaCreacion.toISOString(),
        fechaActualizacion: v.FechaActualizacion.toISOString(),
        atributos: atributos.map((a: any) => ({
          idAtributo: a.IDAtributo,
          atributo: a.Atributo,
          idValorAtributo: a.IDValorAtributo,
          valor: a.Valor,
        })),
      };
    });

    const imagenes: ImagenProductoDTO[] = imagenesRows.map((img) => ({
      idImagenProducto: img.IDImagenProducto,
      idProducto: img.IDProducto,
      idVariante: img.IDVariante,
      url: img.URL,
      ordenVisual: img.OrdenVisual,
      esPrincipal: img.EsPrincipal,
    }));

    return {
      idProducto: h.IDProducto,
      idCategoria: h.IDCategoria,
      categoriaNombre: h.CategoriaNombre,
      categoriaSlug: h.CategoriaSlug,
      nombre: h.Nombre,
      slug: h.Slug,
      descripcion: h.Descripcion,
      marca: h.Marca,
      estaActivo: h.EstaActivo,
      fechaCreacion: h.FechaCreacion.toISOString(),
      fechaActualizacion: h.FechaActualizacion.toISOString(),
      variantes,
      imagenes,
    } as unknown as ProductoDetalleDTO;
  }
}

export const catalogoDal = new CatalogoDal();
