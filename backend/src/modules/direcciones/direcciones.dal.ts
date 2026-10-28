import sql from "mssql";
import { ejecutarSp } from "../../shared/db/ejecutarSp";
import {
  CrearDireccionInput,
  ActualizarDireccionInput,
  DireccionDTO,
} from "@shopcart/contracts";

interface DireccionDbRow {
  IDDireccion: number;
  IDUsuario: number;
  Alias: string | null;
  Destinatario: string;
  Telefono: string;
  Linea1: string;
  Linea2: string | null;
  Departamento: string;
  Municipio: string;
  CodigoPostal: string | null;
  Referencia: string | null;
  EsPredeterminada: boolean;
  EstaActiva: boolean;
  FechaCreacion: Date;
}

function mapDireccionRow(r: DireccionDbRow): DireccionDTO {
  return {
    idDireccion: r.IDDireccion,
    idUsuario: r.IDUsuario,
    alias: r.Alias,
    destinatario: r.Destinatario,
    telefono: r.Telefono,
    linea1: r.Linea1,
    linea2: r.Linea2,
    departamento: r.Departamento,
    municipio: r.Municipio,
    codigoPostal: r.CodigoPostal,
    referencia: r.Referencia,
    esPredeterminada: r.EsPredeterminada,
    estaActiva: r.EstaActiva,
    fechaCreacion: r.FechaCreacion.toISOString(),
  };
}

export class DireccionesDal {
  async crear(idUsuario: number, datos: CrearDireccionInput): Promise<DireccionDTO> {
    const res = await ejecutarSp<DireccionDbRow>("dbo.SP_Direccion_Crear", [
      { nombre: "IDUsuario", tipo: sql.Int, valor: idUsuario },
      { nombre: "Alias", tipo: sql.NVarChar(50), valor: datos.alias || null },
      { nombre: "Destinatario", tipo: sql.NVarChar(150), valor: datos.destinatario },
      { nombre: "Telefono", tipo: sql.NVarChar(30), valor: datos.telefono },
      { nombre: "Linea1", tipo: sql.NVarChar(200), valor: datos.linea1 },
      { nombre: "Linea2", tipo: sql.NVarChar(200), valor: datos.linea2 || null },
      { nombre: "Departamento", tipo: sql.NVarChar(100), valor: datos.departamento },
      { nombre: "Municipio", tipo: sql.NVarChar(100), valor: datos.municipio },
      { nombre: "CodigoPostal", tipo: sql.NVarChar(20), valor: datos.codigoPostal || null },
      { nombre: "Referencia", tipo: sql.NVarChar(250), valor: datos.referencia || null },
      { nombre: "EsPredeterminada", tipo: sql.Bit, valor: datos.esPredeterminada || false },
    ]);

    return mapDireccionRow(res.recordset[0]);
  }

  async listarPropias(idUsuario: number): Promise<DireccionDTO[]> {
    const res = await ejecutarSp<DireccionDbRow>("dbo.SP_Direccion_ListarPropias", [
      { nombre: "IDUsuario", tipo: sql.Int, valor: idUsuario },
    ]);

    return (res.recordset || []).map(mapDireccionRow);
  }

  async obtenerPorID(idDireccion: number, idUsuario: number): Promise<DireccionDTO> {
    const res = await ejecutarSp<DireccionDbRow>("dbo.SP_Direccion_ObtenerPorID", [
      { nombre: "IDDireccion", tipo: sql.Int, valor: idDireccion },
      { nombre: "IDUsuario", tipo: sql.Int, valor: idUsuario },
    ]);

    return mapDireccionRow(res.recordset[0]);
  }

  async actualizar(
    idDireccion: number,
    idUsuario: number,
    datos: ActualizarDireccionInput
  ): Promise<DireccionDTO> {
    const res = await ejecutarSp<DireccionDbRow>("dbo.SP_Direccion_Actualizar", [
      { nombre: "IDDireccion", tipo: sql.Int, valor: idDireccion },
      { nombre: "IDUsuario", tipo: sql.Int, valor: idUsuario },
      { nombre: "Alias", tipo: sql.NVarChar(50), valor: datos.alias || null },
      { nombre: "Destinatario", tipo: sql.NVarChar(150), valor: datos.destinatario },
      { nombre: "Telefono", tipo: sql.NVarChar(30), valor: datos.telefono },
      { nombre: "Linea1", tipo: sql.NVarChar(200), valor: datos.linea1 },
      { nombre: "Linea2", tipo: sql.NVarChar(200), valor: datos.linea2 || null },
      { nombre: "Departamento", tipo: sql.NVarChar(100), valor: datos.departamento },
      { nombre: "Municipio", tipo: sql.NVarChar(100), valor: datos.municipio },
      { nombre: "CodigoPostal", tipo: sql.NVarChar(20), valor: datos.codigoPostal || null },
      { nombre: "Referencia", tipo: sql.NVarChar(250), valor: datos.referencia || null },
      { nombre: "EsPredeterminada", tipo: sql.Bit, valor: datos.esPredeterminada || false },
    ]);

    return mapDireccionRow(res.recordset[0]);
  }

  async eliminar(idDireccion: number, idUsuario: number): Promise<number> {
    const res = await ejecutarSp<{ IDDireccionEliminada: number }>("dbo.SP_Direccion_Eliminar", [
      { nombre: "IDDireccion", tipo: sql.Int, valor: idDireccion },
      { nombre: "IDUsuario", tipo: sql.Int, valor: idUsuario },
    ]);

    return res.recordset[0]?.IDDireccionEliminada;
  }

  async establecerPredeterminada(idDireccion: number, idUsuario: number): Promise<DireccionDTO> {
    const res = await ejecutarSp<DireccionDbRow>("dbo.SP_Direccion_EstablecerPredeterminada", [
      { nombre: "IDDireccion", tipo: sql.Int, valor: idDireccion },
      { nombre: "IDUsuario", tipo: sql.Int, valor: idUsuario },
    ]);

    return mapDireccionRow(res.recordset[0]);
  }
}
