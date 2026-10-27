import sql from "mssql";
import { getDbPool } from "../../config/database";
import { mapearErrorSql } from "../errors/mapaErroresSql";
import { logger } from "../logger";

export interface ParametroSp {
  nombre: string;
  tipo: sql.ISqlType | (() => sql.ISqlType);
  valor: unknown;
  esSalida?: boolean;
}

export interface ResultadoSp<T = unknown> {
  recordset: T[];
  recordsets: T[][];
  rowsAffected: number[];
  output: Record<string, unknown>;
  returnValue: number;
}

/**
 * Invoca un Stored Procedure en SQL Server con parámetros estrictamente tipados.
 * Garantiza prevención absoluta contra inyección SQL y traduce errores de negocio (THROW 50xxx).
 */
export async function ejecutarSp<T = unknown>(
  nombreSp: string,
  parametros: ParametroSp[] = []
): Promise<ResultadoSp<T>> {
  const inicio = Date.now();
  try {
    const pool = await getDbPool();
    const request = pool.request();

    for (const p of parametros) {
      if (p.esSalida) {
        request.output(p.nombre, p.tipo, p.valor);
      } else {
        request.input(p.nombre, p.tipo, p.valor);
      }
    }

    const resultado = await request.execute<T>(nombreSp);
    const duracion = Date.now() - inicio;

    if (duracion > 1000) {
      logger.warn({ sp: nombreSp, duracionMs: duracion }, "SP ejecutado con tiempo superior a 1 segundo");
    }

    return {
      recordset: resultado.recordset ?? [],
      recordsets: (resultado.recordsets ?? []) as T[][],
      rowsAffected: resultado.rowsAffected,
      output: resultado.output,
      returnValue: resultado.returnValue,
    };
  } catch (error) {
    const duracion = Date.now() - inicio;
    logger.error({ sp: nombreSp, duracionMs: duracion, err: error }, "Fallo al ejecutar Stored Procedure");
    throw mapearErrorSql(error);
  }
}
