import {
  CategoriaDTO,
  CrearCategoriaInput,
  ActualizarCategoriaInput,
  AtributoConValoresDTO,
  CrearProductoInput,
  ActualizarProductoInput,
  ActualizarVarianteInput,
  ListarCatalogoQuery,
  ProductoItemDTO,
  ProductoDetalleDTO,
  RespuestaPaginada,
} from "@shopcart/contracts";
import { catalogoDal, CatalogoDal } from "./catalogo.dal";

export class CatalogoService {
  constructor(private readonly dal: CatalogoDal = catalogoDal) {}

  /* =========================================================================
     CATEGORÍAS
     ========================================================================= */

  async crearCategoria(
    idUsuarioAdmin: number,
    datos: CrearCategoriaInput,
    ip?: string
  ): Promise<CategoriaDTO> {
    return this.dal.crearCategoria(idUsuarioAdmin, datos, ip);
  }

  async listarCategorias(soloActivas = false): Promise<CategoriaDTO[]> {
    return this.dal.listarCategorias(soloActivas);
  }

  async obtenerCategoriaPorId(idCategoria: number): Promise<CategoriaDTO> {
    return this.dal.obtenerCategoriaPorId(idCategoria);
  }

  async actualizarCategoria(
    idUsuarioAdmin: number,
    idCategoria: number,
    datos: ActualizarCategoriaInput,
    ip?: string
  ): Promise<CategoriaDTO> {
    return this.dal.actualizarCategoria(idUsuarioAdmin, idCategoria, datos, ip);
  }

  async cambiarEstadoCategoria(
    idUsuarioAdmin: number,
    idCategoria: number,
    estaActiva: boolean,
    ip?: string
  ): Promise<CategoriaDTO> {
    return this.dal.cambiarEstadoCategoria(idUsuarioAdmin, idCategoria, estaActiva, ip);
  }

  /* =========================================================================
     ATRIBUTOS Y VALORES
     ========================================================================= */

  async listarAtributosConValores(): Promise<AtributoConValoresDTO[]> {
    return this.dal.listarAtributosConValores();
  }

  async crearAtributo(nombre: string): Promise<{ idAtributo: number; nombre: string; estaActivo: boolean }> {
    return this.dal.crearAtributo(nombre);
  }

  async crearValorAtributo(
    idAtributo: number,
    valor: string,
    ordenVisual = 0
  ): Promise<{ idValorAtributo: number; idAtributo: number; valor: string; ordenVisual: number }> {
    return this.dal.crearValorAtributo(idAtributo, valor, ordenVisual);
  }

  /* =========================================================================
     PRODUCTOS Y VARIANTES
     ========================================================================= */

  async crearProducto(
    idUsuarioAdmin: number,
    datos: CrearProductoInput,
    ip?: string
  ): Promise<ProductoDetalleDTO> {
    return this.dal.crearProducto(idUsuarioAdmin, datos, ip);
  }

  async listarCatalogo(
    filtros: ListarCatalogoQuery
  ): Promise<RespuestaPaginada<ProductoItemDTO>> {
    const { productos, totalRegistros } = await this.dal.listarCatalogo(filtros);
    const totalPaginas = Math.ceil(totalRegistros / filtros.limite) || 1;

    return {
      datos: productos,
      paginacion: {
        paginaActual: filtros.pagina,
        limite: filtros.limite,
        totalRegistros,
        totalPaginas,
      },
    };
  }

  async obtenerProductoPorIdOrSlug(param: string | number): Promise<ProductoDetalleDTO> {
    const esNumero = typeof param === "number" || /^\d+$/.test(String(param));
    if (esNumero) {
      return this.dal.obtenerProductoDetalle(Number(param), undefined);
    }
    return this.dal.obtenerProductoDetalle(undefined, String(param));
  }

  async actualizarProducto(
    idUsuarioAdmin: number,
    idProducto: number,
    datos: ActualizarProductoInput,
    ip?: string
  ): Promise<ProductoDetalleDTO> {
    return this.dal.actualizarProducto(idUsuarioAdmin, idProducto, datos, ip);
  }

  async cambiarEstadoProducto(
    idUsuarioAdmin: number,
    idProducto: number,
    estaActivo: boolean,
    ip?: string
  ): Promise<ProductoDetalleDTO> {
    return this.dal.cambiarEstadoProducto(idUsuarioAdmin, idProducto, estaActivo, ip);
  }

  async actualizarVariante(
    idUsuarioAdmin: number,
    idVariante: number,
    datos: ActualizarVarianteInput,
    ip?: string
  ): Promise<{
    idVariante: number;
    idProducto: number;
    sku: string;
    precio: number;
    costo: number | null;
    pesoGramos: number | null;
    estaActiva: boolean;
    fechaActualizacion: string;
  }> {
    return this.dal.actualizarVariante(idUsuarioAdmin, idVariante, datos, ip);
  }
}

export const catalogoService = new CatalogoService();
