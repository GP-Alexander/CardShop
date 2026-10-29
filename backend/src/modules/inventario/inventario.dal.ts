import sql from "mssql";
import { ejecutarSp } from "../../shared/db/ejecutarSp";
import {
  ListarInventarioQuery,
  InventarioItemDTO,
  ListarKardexQuery,
  MovimientoKardexItemDTO,
  EstadoStock,
  AtributoVarianteResumen,
} from "@shopcart/contracts";

interface InventarioDbRow {
  IDVariante: number;
  IDProducto: number;
  SKU: string;
  Precio: number;
  Costo: number | null;
  VarianteActiva: boolean;
  ProductoNombre: string;
  ProductoMarca: string | null;
  ProductoActivo: boolean;
  IDCategoria: number;
  CategoriaNombre: string;
  IDInventario: number;
  IDAlmacen: number;
  Existencia: number;
  CantidadReservada: number;
  CantidadDisponible: number;
  PuntoReorden: number;
  EstadoStock: string;
  FechaActualizacion: Date;
  AtributosJson: string | null;
}

interface KardexDbRow {
  IDMovimiento: number;
  IDVariante: number;
  SKU: string;
  IDProducto: number;
  ProductoNombre: string;
  IDAlmacen: number;
  AlmacenNombre: string;
  TipoMovimiento: string;
  Cantidad: number;
  ExistenciaAnterior: number;
  ExistenciaPosterior: number;
  IDPedido: number | null;
  IDUsuario: number;
  UsuarioNombreCompleto: string;
  UsuarioCorreo: string;
  Motivo: string;
  FechaMovimiento: Date;
}

export class InventarioDal {
  private mapearInventarioItem(r: InventarioDbRow): InventarioItemDTO {
    let atributos: AtributoVarianteResumen[] = [];
    if (r.AtributosJson) {
      try {
        atributos = JSON.parse(r.AtributosJson);
      } catch {
        atributos = [];
      }
    }

    return {
      idVariante: r.IDVariante,
      idProducto: r.IDProducto,
      sku: r.SKU,
      precio: Number(r.Precio),
      costo: r.Costo !== null ? Number(r.Costo) : null,
      varianteActiva: Boolean(r.VarianteActiva),
      productoNombre: r.ProductoNombre,
      productoMarca: r.ProductoMarca,
      productoActivo: Boolean(r.ProductoActivo),
      idCategoria: r.IDCategoria,
      categoriaNombre: r.CategoriaNombre,
      idInventario: r.IDInventario,
      idAlmacen: r.IDAlmacen,
      existencia: r.Existencia,
      cantidadReservada: r.CantidadReservada,
      cantidadDisponible: r.CantidadDisponible,
      puntoReorden: r.PuntoReorden,
      estadoStock: r.EstadoStock as EstadoStock,
      fechaActualizacion: r.FechaActualizacion ? new Date(r.FechaActualizacion).toISOString() : new Date().toISOString(),
      atributos,
    };
  }

  async listarExistencias(filtros: ListarInventarioQuery): Promise<{
    items: InventarioItemDTO[];
    totalRegistros: number;
  }> {
    const res = await ejecutarSp<InventarioDbRow>("dbo.SP_Inventario_ListarExistencias", [
      { nombre: "Pagina", tipo: sql.Int, valor: filtros.pagina },
      { nombre: "Limite", tipo: sql.Int, valor: filtros.limite },
      { nombre: "IDProducto", tipo: sql.Int, valor: filtros.idProducto || null },
      { nombre: "IDCategoria", tipo: sql.Int, valor: filtros.idCategoria || null },
      { nombre: "SoloBajoStock", tipo: sql.Bit, valor: filtros.soloBajoStock ? 1 : 0 },
      { nombre: "SoloAgotados", tipo: sql.Bit, valor: filtros.soloAgotados ? 1 : 0 },
      { nombre: "Busqueda", tipo: sql.NVarChar(100), valor: filtros.busqueda || null },
      { nombre: "CodigoAlmacen", tipo: sql.VarChar(30), valor: filtros.codigoAlmacen || "PRINCIPAL" },
      { nombre: "TotalRegistros", tipo: sql.Int, valor: 0, esSalida: true },
    ]);

    const totalRegistros = (res.output?.TotalRegistros as number) ?? 0;
    const items = (res.recordset || []).map((r) => this.mapearInventarioItem(r));

    return { items, totalRegistros };
  }

  async obtenerPorVariante(
    idVariante: number,
    codigoAlmacen = "PRINCIPAL"
  ): Promise<InventarioItemDTO | null> {
    const res = await ejecutarSp<InventarioDbRow>("dbo.SP_Inventario_ObtenerPorVariante", [
      { nombre: "IDVariante", tipo: sql.Int, valor: idVariante },
      { nombre: "CodigoAlmacen", tipo: sql.VarChar(30), valor: codigoAlmacen },
    ]);

    if (!res.recordset || res.recordset.length === 0) {
      return null;
    }

    return this.mapearInventarioItem(res.recordset[0]);
  }

  async registrarEntrada(
    idVariante: number,
    cantidad: number,
    motivo: string,
    idUsuario: number,
    codigoAlmacen = "PRINCIPAL",
    direccionIp?: string
  ): Promise<InventarioItemDTO> {
    const res = await ejecutarSp<InventarioDbRow>("dbo.SP_Inventario_RegistrarEntrada", [
      { nombre: "IDVariante", tipo: sql.Int, valor: idVariante },
      { nombre: "Cantidad", tipo: sql.Int, valor: cantidad },
      { nombre: "Motivo", tipo: sql.NVarChar(300), valor: motivo },
      { nombre: "IDUsuario", tipo: sql.Int, valor: idUsuario },
      { nombre: "CodigoAlmacen", tipo: sql.VarChar(30), valor: codigoAlmacen },
      { nombre: "DireccionIP", tipo: sql.VarChar(45), valor: direccionIp || null },
    ]);

    return this.mapearInventarioItem(res.recordset[0]);
  }

  async registrarAjuste(
    idVariante: number,
    cantidad: number,
    motivo: string,
    idUsuario: number,
    codigoAlmacen = "PRINCIPAL",
    direccionIp?: string
  ): Promise<InventarioItemDTO> {
    const res = await ejecutarSp<InventarioDbRow>("dbo.SP_Inventario_RegistrarAjuste", [
      { nombre: "IDVariante", tipo: sql.Int, valor: idVariante },
      { nombre: "Cantidad", tipo: sql.Int, valor: cantidad },
      { nombre: "Motivo", tipo: sql.NVarChar(300), valor: motivo },
      { nombre: "IDUsuario", tipo: sql.Int, valor: idUsuario },
      { nombre: "CodigoAlmacen", tipo: sql.VarChar(30), valor: codigoAlmacen },
      { nombre: "DireccionIP", tipo: sql.VarChar(45), valor: direccionIp || null },
    ]);

    return this.mapearInventarioItem(res.recordset[0]);
  }

  async actualizarPuntoReorden(
    idVariante: number,
    puntoReorden: number,
    idUsuario: number,
    codigoAlmacen = "PRINCIPAL",
    direccionIp?: string
  ): Promise<InventarioItemDTO> {
    const res = await ejecutarSp<InventarioDbRow>("dbo.SP_Inventario_ActualizarPuntoReorden", [
      { nombre: "IDVariante", tipo: sql.Int, valor: idVariante },
      { nombre: "PuntoReorden", tipo: sql.Int, valor: puntoReorden },
      { nombre: "IDUsuario", tipo: sql.Int, valor: idUsuario },
      { nombre: "CodigoAlmacen", tipo: sql.VarChar(30), valor: codigoAlmacen },
      { nombre: "DireccionIP", tipo: sql.VarChar(45), valor: direccionIp || null },
    ]);

    return this.mapearInventarioItem(res.recordset[0]);
  }

  async listarKardex(filtros: ListarKardexQuery): Promise<{
    items: MovimientoKardexItemDTO[];
    totalRegistros: number;
  }> {
    const res = await ejecutarSp<KardexDbRow>("dbo.SP_Inventario_ListarKardex", [
      { nombre: "Pagina", tipo: sql.Int, valor: filtros.pagina },
      { nombre: "Limite", tipo: sql.Int, valor: filtros.limite },
      { nombre: "IDVariante", tipo: sql.Int, valor: filtros.idVariante || null },
      { nombre: "IDProducto", tipo: sql.Int, valor: filtros.idProducto || null },
      { nombre: "TipoMovimiento", tipo: sql.VarChar(25), valor: filtros.tipoMovimiento || null },
      { nombre: "FechaInicio", tipo: sql.DateTime2(3), valor: filtros.fechaInicio ? new Date(filtros.fechaInicio) : null },
      { nombre: "FechaFin", tipo: sql.DateTime2(3), valor: filtros.fechaFin ? new Date(filtros.fechaFin) : null },
      { nombre: "Busqueda", tipo: sql.NVarChar(100), valor: filtros.busqueda || null },
      { nombre: "CodigoAlmacen", tipo: sql.VarChar(30), valor: filtros.codigoAlmacen || null },
      { nombre: "TotalRegistros", tipo: sql.Int, valor: 0, esSalida: true },
    ]);

    const totalRegistros = (res.output?.TotalRegistros as number) ?? 0;

    const items: MovimientoKardexItemDTO[] = (res.recordset || []).map((r) => ({
      idMovimiento: r.IDMovimiento,
      idVariante: r.IDVariante,
      sku: r.SKU,
      idProducto: r.IDProducto,
      productoNombre: r.ProductoNombre,
      idAlmacen: r.IDAlmacen,
      almacenNombre: r.AlmacenNombre,
      tipoMovimiento: r.TipoMovimiento,
      cantidad: r.Cantidad,
      existenciaAnterior: r.ExistenciaAnterior,
      existenciaPosterior: r.ExistenciaPosterior,
      idPedido: r.IDPedido,
      idUsuario: r.IDUsuario,
      usuarioNombreCompleto: r.UsuarioNombreCompleto,
      usuarioCorreo: r.UsuarioCorreo,
      motivo: r.Motivo,
      fechaMovimiento: r.FechaMovimiento ? new Date(r.FechaMovimiento).toISOString() : new Date().toISOString(),
    }));

    return { items, totalRegistros };
  }
}
