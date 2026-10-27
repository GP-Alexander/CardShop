import sql from "mssql";
import { ejecutarSp } from "../../shared/db/ejecutarSp";
import { UsuarioDbRow, PermisoDbRow, ResultadoRotacionDbRow } from "./auth.types";

export class AuthDal {
  async registrarCliente(datos: {
    nombres: string;
    apellidos: string;
    correo: string;
    telefono?: string;
    hashContrasena: string;
    direccionIp?: string;
  }): Promise<UsuarioDbRow> {
    const res = await ejecutarSp<UsuarioDbRow>("dbo.SP_Usuario_RegistrarCliente", [
      { nombre: "Nombres", tipo: sql.NVarChar(100), valor: datos.nombres },
      { nombre: "Apellidos", tipo: sql.NVarChar(100), valor: datos.apellidos },
      { nombre: "Correo", tipo: sql.NVarChar(254), valor: datos.correo },
      { nombre: "Telefono", tipo: sql.NVarChar(30), valor: datos.telefono || null },
      { nombre: "HashContrasena", tipo: sql.NVarChar(255), valor: datos.hashContrasena },
      { nombre: "DireccionIP", tipo: sql.VarChar(45), valor: datos.direccionIp || null },
    ]);
    return res.recordset[0];
  }

  async obtenerUsuarioPorCorreo(correo: string): Promise<{
    usuario: UsuarioDbRow | null;
    permisos: string[];
  }> {
    const res = await ejecutarSp<UsuarioDbRow>("dbo.SP_Usuario_ObtenerPorCorreo", [
      { nombre: "Correo", tipo: sql.NVarChar(254), valor: correo },
    ]);

    const usuario = res.recordsets[0]?.[0] || null;
    const permisosRows = (res.recordsets[1] as unknown as PermisoDbRow[]) || [];
    const permisos = permisosRows.map((p) => p.Codigo);

    return { usuario, permisos };
  }

  async obtenerUsuarioPorID(idUsuario: number): Promise<{
    usuario: UsuarioDbRow | null;
    permisos: string[];
  }> {
    const res = await ejecutarSp<UsuarioDbRow>("dbo.SP_Usuario_ObtenerPorID", [
      { nombre: "IDUsuario", tipo: sql.Int, valor: idUsuario },
    ]);

    const usuario = res.recordsets[0]?.[0] || null;
    const permisosRows = (res.recordsets[1] as unknown as PermisoDbRow[]) || [];
    const permisos = permisosRows.map((p) => p.Codigo);

    return { usuario, permisos };
  }

  async crearSesion(datos: {
    idUsuario: number;
    idFamilia: string;
    hashToken: string;
    fechaExpiracion: Date;
    direccionIp?: string;
  }): Promise<number> {
    const res = await ejecutarSp<{ IDTokenSesion: number }>("dbo.SP_TokenSesion_Crear", [
      { nombre: "IDUsuario", tipo: sql.Int, valor: datos.idUsuario },
      { nombre: "IDFamilia", tipo: sql.UniqueIdentifier, valor: datos.idFamilia },
      { nombre: "HashToken", tipo: sql.Char(64), valor: datos.hashToken },
      { nombre: "FechaExpiracion", tipo: sql.DateTime2(3), valor: datos.fechaExpiracion },
      { nombre: "DireccionIP", tipo: sql.VarChar(45), valor: datos.direccionIp || null },
    ]);
    return res.recordset[0].IDTokenSesion;
  }

  async rotarSesion(datos: {
    hashTokenActual: string;
    nuevoHashToken: string;
    nuevaFechaExpiracion: Date;
    direccionIp?: string;
  }): Promise<ResultadoRotacionDbRow> {
    const res = await ejecutarSp<ResultadoRotacionDbRow>("dbo.SP_TokenSesion_Rotar", [
      { nombre: "HashTokenActual", tipo: sql.Char(64), valor: datos.hashTokenActual },
      { nombre: "NuevoHashToken", tipo: sql.Char(64), valor: datos.nuevoHashToken },
      { nombre: "NuevaFechaExpiracion", tipo: sql.DateTime2(3), valor: datos.nuevaFechaExpiracion },
      { nombre: "DireccionIP", tipo: sql.VarChar(45), valor: datos.direccionIp || null },
    ]);
    return res.recordset[0];
  }

  async revocarSesion(datos: { hashToken?: string; idFamilia?: string }): Promise<void> {
    await ejecutarSp("dbo.SP_TokenSesion_Revocar", [
      { nombre: "HashToken", tipo: sql.Char(64), valor: datos.hashToken || null },
      { nombre: "IDFamilia", tipo: sql.UniqueIdentifier, valor: datos.idFamilia || null },
    ]);
  }
}
