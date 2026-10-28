import sql from "mssql";
import { ejecutarSp } from "../../shared/db/ejecutarSp";
import { ListarBitacoraQuery, BitacoraItemDTO } from "@shopcart/contracts";

interface BitacoraDbRow {
  IDBitacora: number;
  FechaEvento: Date;
  IDUsuario: number | null;
  CorreoUsuario: string | null;
  NombreCompletoUsuario: string | null;
  Modulo: string;
  Entidad: string;
  IDRegistro: string;
  Accion: string;
  ValorAnterior: string | null;
  ValorNuevo: string | null;
  DireccionIP: string | null;
  CorrelationId: string | null;
}

export class BitacoraDal {
  async listarPaginado(filtros: ListarBitacoraQuery): Promise<{
    items: BitacoraItemDTO[];
    totalRegistros: number;
  }> {
    const res = await ejecutarSp<BitacoraDbRow>("dbo.SP_Bitacora_ListarPaginado", [
      { nombre: "Pagina", tipo: sql.Int, valor: filtros.pagina },
      { nombre: "Limite", tipo: sql.Int, valor: filtros.limite },
      { nombre: "Modulo", tipo: sql.VarChar(40), valor: filtros.modulo || null },
      { nombre: "Entidad", tipo: sql.VarChar(60), valor: filtros.entidad || null },
      { nombre: "Accion", tipo: sql.VarChar(40), valor: filtros.accion || null },
      { nombre: "IDUsuario", tipo: sql.Int, valor: filtros.idUsuario || null },
      { nombre: "FechaInicio", tipo: sql.DateTime2(3), valor: filtros.fechaInicio ? new Date(filtros.fechaInicio) : null },
      { nombre: "FechaFin", tipo: sql.DateTime2(3), valor: filtros.fechaFin ? new Date(filtros.fechaFin) : null },
      { nombre: "Busqueda", tipo: sql.NVarChar(100), valor: filtros.busqueda || null },
      { nombre: "TotalRegistros", tipo: sql.Int, valor: 0, esSalida: true },
    ]);

    const totalRegistros = (res.output?.TotalRegistros as number) ?? 0;

    const items: BitacoraItemDTO[] = (res.recordset || []).map((r) => ({
      idBitacora: r.IDBitacora,
      fechaEvento: r.FechaEvento.toISOString(),
      idUsuario: r.IDUsuario,
      correoUsuario: r.CorreoUsuario,
      nombreCompletoUsuario: r.NombreCompletoUsuario,
      modulo: r.Modulo,
      entidad: r.Entidad,
      idRegistro: r.IDRegistro,
      accion: r.Accion,
      valorAnterior: r.ValorAnterior,
      valorNuevo: r.ValorNuevo,
      direccionIp: r.DireccionIP,
      correlationId: r.CorrelationId,
    }));

    return { items, totalRegistros };
  }
}
