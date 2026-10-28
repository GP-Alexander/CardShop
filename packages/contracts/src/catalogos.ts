export interface RolCatalogoDTO {
  idRol: number;
  nombre: string;
  descripcion: string | null;
  estaActivo: boolean;
  fechaCreacion: string;
  totalUsuarios: number;
}

export interface PermisoCatalogoDTO {
  idPermiso: number;
  codigo: string;
  modulo: string;
  accion: string;
  descripcion: string | null;
}
