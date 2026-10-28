import sql from "mssql";
import { ejecutarSp } from "../../shared/db/ejecutarSp";
import {
  ListarUsuariosQuery,
  UsuarioItemDTO,
  UsuarioDetalleDTO,
  DireccionUsuarioDTO,
} from "@shopcart/contracts";

interface UsuarioItemDbRow {
  IDUsuario: number;
  Nombres: string;
  Apellidos: string;
  Correo: string;
  Telefono: string | null;
  NombreRol: string;
  EstaActivo: boolean;
  FechaCreacion: Date;
  UltimoAcceso: Date | null;
  TotalRegistros: number;
}

interface UsuarioDetalleDbRow {
  IDUsuario: number;
  IDRol: number;
  NombreRol: string;
  Nombres: string;
  Apellidos: string;
  Correo: string;
  Telefono: string | null;
  EstaActivo: boolean;
  FechaCreacion: Date;
  FechaActualizacion: Date;
  UltimoAcceso: Date | null;
}

interface DireccionDbRow {
  IDDireccion: number;
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

export class UsuariosDal {
  async listarPaginado(filtros: ListarUsuariosQuery): Promise<{
    usuarios: UsuarioItemDTO[];
    totalRegistros: number;
  }> {
    const res = await ejecutarSp<UsuarioItemDbRow>("dbo.SP_Usuario_ListarPaginado", [
      { nombre: "Busqueda", tipo: sql.NVarChar(100), valor: filtros.busqueda || null },
      { nombre: "Rol", tipo: sql.NVarChar(50), valor: filtros.rol || null },
      { nombre: "EstaActivo", tipo: sql.Bit, valor: filtros.estaActivo ?? null },
      { nombre: "Pagina", tipo: sql.Int, valor: filtros.pagina },
      { nombre: "Limite", tipo: sql.Int, valor: filtros.limite },
      { nombre: "ColumnaOrden", tipo: sql.VarChar(50), valor: filtros.columnaOrden || "FechaCreacion" },
      { nombre: "Orden", tipo: sql.VarChar(4), valor: filtros.orden || "DESC" },
    ]);

    const rows = res.recordset || [];
    const totalRegistros = rows.length > 0 ? rows[0].TotalRegistros : 0;

    const usuarios: UsuarioItemDTO[] = rows.map((r) => ({
      idUsuario: r.IDUsuario,
      nombres: r.Nombres,
      apellidos: r.Apellidos,
      correo: r.Correo,
      telefono: r.Telefono,
      nombreRol: r.NombreRol,
      estaActivo: r.EstaActivo,
      fechaCreacion: r.FechaCreacion.toISOString(),
      ultimoAcceso: r.UltimoAcceso ? r.UltimoAcceso.toISOString() : null,
    }));

    return { usuarios, totalRegistros };
  }

  async obtenerDetalle(idUsuario: number): Promise<UsuarioDetalleDTO> {
    const res = await ejecutarSp<UsuarioDetalleDbRow>("dbo.SP_Usuario_ObtenerDetalle", [
      { nombre: "IDUsuario", tipo: sql.Int, valor: idUsuario },
    ]);

    const u = res.recordsets[0]?.[0];
    const direccionesRows = (res.recordsets[1] as unknown as DireccionDbRow[]) || [];

    const direcciones: DireccionUsuarioDTO[] = direccionesRows.map((d) => ({
      idDireccion: d.IDDireccion,
      alias: d.Alias,
      destinatario: d.Destinatario,
      telefono: d.Telefono,
      linea1: d.Linea1,
      linea2: d.Linea2,
      departamento: d.Departamento,
      municipio: d.Municipio,
      codigoPostal: d.CodigoPostal,
      referencia: d.Referencia,
      esPredeterminada: d.EsPredeterminada,
      estaActiva: d.EstaActiva,
      fechaCreacion: d.FechaCreacion.toISOString(),
    }));

    return {
      idUsuario: u.IDUsuario,
      idRol: u.IDRol,
      nombreRol: u.NombreRol,
      nombres: u.Nombres,
      apellidos: u.Apellidos,
      correo: u.Correo,
      telefono: u.Telefono,
      estaActivo: u.EstaActivo,
      fechaCreacion: u.FechaCreacion.toISOString(),
      fechaActualizacion: u.FechaActualizacion.toISOString(),
      ultimoAcceso: u.UltimoAcceso ? u.UltimoAcceso.toISOString() : null,
      direcciones,
    };
  }

  async actualizarAdmin(datos: {
    idUsuarioAdmin: number;
    idUsuarioObjetivo: number;
    nombres: string;
    apellidos: string;
    idRol: number;
    telefono?: string | null;
    direccionIp?: string;
  }): Promise<{
    idUsuario: number;
    idRol: number;
    nombreRol: string;
    nombres: string;
    apellidos: string;
    correo: string;
    telefono: string | null;
    estaActivo: boolean;
    fechaActualizacion: string;
  }> {
    const res = await ejecutarSp<{
      IDUsuario: number;
      IDRol: number;
      NombreRol: string;
      Nombres: string;
      Apellidos: string;
      Correo: string;
      Telefono: string | null;
      EstaActivo: boolean;
      FechaActualizacion: Date;
    }>("dbo.SP_Usuario_ActualizarAdmin", [
      { nombre: "IDUsuarioAdmin", tipo: sql.Int, valor: datos.idUsuarioAdmin },
      { nombre: "IDUsuarioObjetivo", tipo: sql.Int, valor: datos.idUsuarioObjetivo },
      { nombre: "Nombres", tipo: sql.NVarChar(100), valor: datos.nombres },
      { nombre: "Apellidos", tipo: sql.NVarChar(100), valor: datos.apellidos },
      { nombre: "IDRol", tipo: sql.Int, valor: datos.idRol },
      { nombre: "Telefono", tipo: sql.NVarChar(30), valor: datos.telefono || null },
      { nombre: "DireccionIP", tipo: sql.VarChar(45), valor: datos.direccionIp || null },
    ]);

    const r = res.recordset[0];
    return {
      idUsuario: r.IDUsuario,
      idRol: r.IDRol,
      nombreRol: r.NombreRol,
      nombres: r.Nombres,
      apellidos: r.Apellidos,
      correo: r.Correo,
      telefono: r.Telefono,
      estaActivo: r.EstaActivo,
      fechaActualizacion: r.FechaActualizacion.toISOString(),
    };
  }

  async cambiarEstado(datos: {
    idUsuarioAdmin: number;
    idUsuarioObjetivo: number;
    estaActivo: boolean;
    direccionIp?: string;
  }): Promise<{
    idUsuario: number;
    nombres: string;
    apellidos: string;
    correo: string;
    nombreRol: string;
    estaActivo: boolean;
    fechaActualizacion: string;
  }> {
    const res = await ejecutarSp<{
      IDUsuario: number;
      Nombres: string;
      Apellidos: string;
      Correo: string;
      NombreRol: string;
      EstaActivo: boolean;
      FechaActualizacion: Date;
    }>("dbo.SP_Usuario_CambiarEstado", [
      { nombre: "IDUsuarioAdmin", tipo: sql.Int, valor: datos.idUsuarioAdmin },
      { nombre: "IDUsuarioObjetivo", tipo: sql.Int, valor: datos.idUsuarioObjetivo },
      { nombre: "EstaActivo", tipo: sql.Bit, valor: datos.estaActivo },
      { nombre: "DireccionIP", tipo: sql.VarChar(45), valor: datos.direccionIp || null },
    ]);

    const r = res.recordset[0];
    return {
      idUsuario: r.IDUsuario,
      nombres: r.Nombres,
      apellidos: r.Apellidos,
      correo: r.Correo,
      nombreRol: r.NombreRol,
      estaActivo: r.EstaActivo,
      fechaActualizacion: r.FechaActualizacion.toISOString(),
    };
  }

  async crearInterno(datos: {
    idUsuarioAdmin: number;
    nombres: string;
    apellidos: string;
    correo: string;
    nombreRol: "Operador" | "Administrador";
    hashContrasena: string;
    telefono?: string | null;
    direccionIp?: string;
  }): Promise<{
    idUsuario: number;
    nombres: string;
    apellidos: string;
    correo: string;
    telefono: string | null;
    nombreRol: string;
    estaActivo: boolean;
    fechaCreacion: string;
  }> {
    const res = await ejecutarSp<{
      IDUsuario: number;
      Nombres: string;
      Apellidos: string;
      Correo: string;
      Telefono: string | null;
      NombreRol: string;
      EstaActivo: boolean;
      FechaCreacion: Date;
    }>("dbo.SP_Usuario_RegistrarInterno", [
      { nombre: "IDUsuarioAdmin", tipo: sql.Int, valor: datos.idUsuarioAdmin },
      { nombre: "Nombres", tipo: sql.NVarChar(100), valor: datos.nombres },
      { nombre: "Apellidos", tipo: sql.NVarChar(100), valor: datos.apellidos },
      { nombre: "Correo", tipo: sql.NVarChar(254), valor: datos.correo },
      { nombre: "NombreRol", tipo: sql.NVarChar(50), valor: datos.nombreRol },
      { nombre: "HashContrasena", tipo: sql.NVarChar(255), valor: datos.hashContrasena },
      { nombre: "Telefono", tipo: sql.NVarChar(30), valor: datos.telefono || null },
      { nombre: "DireccionIP", tipo: sql.VarChar(45), valor: datos.direccionIp || null },
    ]);

    const r = res.recordset[0];
    return {
      idUsuario: r.IDUsuario,
      nombres: r.Nombres,
      apellidos: r.Apellidos,
      correo: r.Correo,
      telefono: r.Telefono,
      nombreRol: r.NombreRol,
      estaActivo: r.EstaActivo,
      fechaCreacion: r.FechaCreacion.toISOString(),
    };
  }
}

