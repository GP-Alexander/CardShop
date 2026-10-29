import sql from "mssql";
import { ejecutarSp } from "../../shared/db/ejecutarSp";
import {
  ListarCuponesQuery,
  CrearCuponInput,
  CuponItemDTO,
} from "@shopcart/contracts";

interface CuponDbRow {
  IDCupon: number;
  Codigo: string;
  Descripcion: string | null;
  TipoDescuento: "PORCENTAJE" | "MONTO";
  ValorDescuento: number;
  Alcance: "CARRITO" | "CATEGORIA";
  IDCategoria: number | null;
  CategoriaNombre: string | null;
  MontoMinimoCompra: number;
  DescuentoMaximo: number | null;
  LimiteUsosTotal: number | null;
  UsosActuales: number;
  LimiteUsosPorCliente: number;
  FechaInicio: Date;
  FechaFin: Date;
  EstaActivo: boolean;
  FechaCreacion: Date;
}

export class CuponesDal {
  async listarPaginado(filtros: ListarCuponesQuery): Promise<{
    items: CuponItemDTO[];
    totalRegistros: number;
  }> {
    const res = await ejecutarSp<CuponDbRow>("dbo.SP_Cupon_ListarPaginado", [
      { nombre: "Pagina", tipo: sql.Int, valor: filtros.pagina },
      { nombre: "Limite", tipo: sql.Int, valor: filtros.limite },
      { nombre: "Busqueda", tipo: sql.NVarChar(100), valor: filtros.busqueda || null },
      { nombre: "EstaActivo", tipo: sql.Bit, valor: filtros.estaActivo !== undefined ? (filtros.estaActivo ? 1 : 0) : null },
      { nombre: "TotalRegistros", tipo: sql.Int, valor: 0, esSalida: true },
    ]);

    const totalRegistros = (res.output?.TotalRegistros as number) ?? 0;

    const items: CuponItemDTO[] = (res.recordset || []).map((r) => ({
      idCupon: r.IDCupon,
      codigo: r.Codigo,
      descripcion: r.Descripcion,
      tipoDescuento: r.TipoDescuento,
      valorDescuento: Number(r.ValorDescuento),
      alcance: r.Alcance,
      idCategoria: r.IDCategoria,
      categoriaNombre: r.CategoriaNombre,
      montoMinimoCompra: Number(r.MontoMinimoCompra),
      descuentoMaximo: r.DescuentoMaximo !== null ? Number(r.DescuentoMaximo) : null,
      limiteUsosTotal: r.LimiteUsosTotal,
      usosActuales: r.UsosActuales,
      limiteUsosPorCliente: r.LimiteUsosPorCliente,
      fechaInicio: r.FechaInicio ? new Date(r.FechaInicio).toISOString() : new Date().toISOString(),
      fechaFin: r.FechaFin ? new Date(r.FechaFin).toISOString() : new Date().toISOString(),
      estaActivo: Boolean(r.EstaActivo),
      fechaCreacion: r.FechaCreacion ? new Date(r.FechaCreacion).toISOString() : new Date().toISOString(),
    }));

    return { items, totalRegistros };
  }

  async crear(
    input: CrearCuponInput,
    idUsuarioAdmin: number,
    direccionIp?: string
  ): Promise<number> {
    const res = await ejecutarSp<{ IDCupon: number }>("dbo.SP_Cupon_Crear", [
      { nombre: "Codigo", tipo: sql.VarChar(50), valor: input.codigo },
      { nombre: "Descripcion", tipo: sql.NVarChar(250), valor: input.descripcion || null },
      { nombre: "TipoDescuento", tipo: sql.VarChar(15), valor: input.tipoDescuento },
      { nombre: "ValorDescuento", tipo: sql.Decimal(12, 2), valor: input.valorDescuento },
      { nombre: "Alcance", tipo: sql.VarChar(15), valor: input.alcance || "CARRITO" },
      { nombre: "IDCategoria", tipo: sql.Int, valor: input.idCategoria || null },
      { nombre: "MontoMinimoCompra", tipo: sql.Decimal(12, 2), valor: input.montoMinimoCompra || 0 },
      { nombre: "DescuentoMaximo", tipo: sql.Decimal(12, 2), valor: input.descuentoMaximo || null },
      { nombre: "LimiteUsosTotal", tipo: sql.Int, valor: input.limiteUsosTotal || null },
      { nombre: "LimiteUsosPorCliente", tipo: sql.Int, valor: input.limiteUsosPorCliente || 1 },
      { nombre: "FechaInicio", tipo: sql.DateTime2(3), valor: new Date(input.fechaInicio) },
      { nombre: "FechaFin", tipo: sql.DateTime2(3), valor: new Date(input.fechaFin) },
      { nombre: "IDUsuarioAdmin", tipo: sql.Int, valor: idUsuarioAdmin },
      { nombre: "DireccionIP", tipo: sql.VarChar(45), valor: direccionIp || null },
    ]);

    return res.recordset[0].IDCupon;
  }
}
