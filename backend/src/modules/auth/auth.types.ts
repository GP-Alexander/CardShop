export interface UsuarioDbRow {
  IDUsuario: number;
  IDRol: number;
  NombreRol: "Cliente" | "Operador" | "Administrador";
  Nombres: string;
  Apellidos: string;
  Correo: string;
  Telefono?: string;
  HashContrasena?: string;
  EstaActivo: boolean;
  FechaCreacion: Date;
  UltimoAcceso?: Date;
}

export interface PermisoDbRow {
  Codigo: string;
}

export interface ResultadoRotacionDbRow {
  IDUsuario: number;
  Correo: string;
  Nombres: string;
  Apellidos: string;
  NombreRol: "Cliente" | "Operador" | "Administrador";
  EstaActivo: boolean;
  IDFamilia: string;
  IDTokenSesion: number;
}
