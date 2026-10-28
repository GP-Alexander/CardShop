import { UsuariosDal } from "./usuarios.dal";
import {
  ListarUsuariosQuery,
  ActualizarUsuarioAdminInput,
  CambiarEstadoUsuarioInput,
  CrearUsuarioInternoInput,
  RespuestaPaginadaUsuariosDTO,
  UsuarioDetalleDTO,
} from "@shopcart/contracts";
import { hashPassword } from "../../shared/security/hash";

export class UsuariosService {
  constructor(private readonly usuariosDal: UsuariosDal = new UsuariosDal()) {}

  async listarPaginado(filtros: ListarUsuariosQuery): Promise<RespuestaPaginadaUsuariosDTO> {
    const { usuarios, totalRegistros } = await this.usuariosDal.listarPaginado(filtros);

    const totalPaginas = Math.ceil(totalRegistros / filtros.limite) || 1;

    return {
      datos: usuarios,
      paginacion: {
        paginaActual: filtros.pagina,
        limite: filtros.limite,
        totalRegistros,
        totalPaginas,
      },
    };
  }

  async obtenerDetalle(idUsuario: number): Promise<UsuarioDetalleDTO> {
    return this.usuariosDal.obtenerDetalle(idUsuario);
  }

  async crearInterno(
    idUsuarioAdmin: number,
    datos: CrearUsuarioInternoInput,
    direccionIp?: string
  ) {
    const hashContrasena = await hashPassword(datos.password);
    return this.usuariosDal.crearInterno({
      idUsuarioAdmin,
      nombres: datos.nombres,
      apellidos: datos.apellidos,
      correo: datos.correo,
      nombreRol: datos.nombreRol,
      hashContrasena,
      telefono: datos.telefono,
      direccionIp,
    });
  }

  async actualizarAdmin(
    idUsuarioAdmin: number,
    idUsuarioObjetivo: number,
    datos: ActualizarUsuarioAdminInput,
    direccionIp?: string
  ) {
    return this.usuariosDal.actualizarAdmin({
      idUsuarioAdmin,
      idUsuarioObjetivo,
      nombres: datos.nombres,
      apellidos: datos.apellidos,
      idRol: datos.idRol,
      telefono: datos.telefono,
      direccionIp,
    });
  }

  async cambiarEstado(
    idUsuarioAdmin: number,
    idUsuarioObjetivo: number,
    datos: CambiarEstadoUsuarioInput,
    direccionIp?: string
  ) {
    return this.usuariosDal.cambiarEstado({
      idUsuarioAdmin,
      idUsuarioObjetivo,
      estaActivo: datos.estaActivo,
      direccionIp,
    });
  }
}

