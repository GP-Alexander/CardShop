import { ejecutarSp } from "../../shared/db/ejecutarSp";
import { RolCatalogoDTO, PermisoCatalogoDTO } from "@shopcart/contracts";

interface RolDbRow {
  IDRol: number;
  Nombre: string;
  Descripcion: string | null;
  EstaActivo: boolean;
  FechaCreacion: Date;
  TotalUsuarios: number;
}

interface PermisoDbRow {
  IDPermiso: number;
  Codigo: string;
  Modulo: string;
  Accion: string;
  Descripcion: string | null;
}

export class CatalogosDal {
  async listarRoles(): Promise<RolCatalogoDTO[]> {
    const res = await ejecutarSp<RolDbRow>("dbo.SP_Catalogos_ListarRoles");
    return (res.recordset || []).map((r) => ({
      idRol: r.IDRol,
      nombre: r.Nombre,
      descripcion: r.Descripcion,
      estaActivo: r.EstaActivo,
      fechaCreacion: r.FechaCreacion.toISOString(),
      totalUsuarios: r.TotalUsuarios,
    }));
  }

  async listarPermisos(): Promise<PermisoCatalogoDTO[]> {
    const res = await ejecutarSp<PermisoDbRow>("dbo.SP_Catalogos_ListarPermisos");
    return (res.recordset || []).map((r) => ({
      idPermiso: r.IDPermiso,
      codigo: r.Codigo,
      modulo: r.Modulo,
      accion: r.Accion,
      descripcion: r.Descripcion,
    }));
  }
}
