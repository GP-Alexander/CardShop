import { CatalogosDal } from "./catalogos.dal";
import { RolCatalogoDTO, PermisoCatalogoDTO } from "@shopcart/contracts";

export class CatalogosService {
  constructor(private readonly catalogosDal: CatalogosDal = new CatalogosDal()) {}

  async listarRoles(): Promise<RolCatalogoDTO[]> {
    return this.catalogosDal.listarRoles();
  }

  async listarPermisos(): Promise<PermisoCatalogoDTO[]> {
    return this.catalogosDal.listarPermisos();
  }
}
