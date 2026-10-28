/* =========================================================================
   ShopCart - SPs de Auditoría y Bitácora del Sistema (RF-09)
   Convención: SP_Bitacora_Proceso
   ========================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* =========================================================================
   1. SP_Bitacora_ListarPaginado
   Consulta la bitácora inmutable con filtros avanzados y paginación del servidor.
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Bitacora_ListarPaginado
    @Pagina INT = 1,
    @Limite INT = 20,
    @Modulo VARCHAR(40) = NULL,
    @Entidad VARCHAR(60) = NULL,
    @Accion VARCHAR(40) = NULL,
    @IDUsuario INT = NULL,
    @FechaInicio DATETIME2(3) = NULL,
    @FechaFin DATETIME2(3) = NULL,
    @Busqueda NVARCHAR(100) = NULL,
    @TotalRegistros INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    SET @Pagina = ISNULL(@Pagina, 1);
    SET @Limite = ISNULL(@Limite, 20);
    IF @Pagina < 1 SET @Pagina = 1;
    IF @Limite < 1 SET @Limite = 20;
    IF @Limite > 100 SET @Limite = 100;

    DECLARE @Offset INT = (@Pagina - 1) * @Limite;

    -- Conteo total aplicando los mismos filtros
    SELECT @TotalRegistros = COUNT(1)
    FROM dbo.RegistroBitacora b
    LEFT JOIN dbo.Usuario u ON b.IDUsuario = u.IDUsuario
    WHERE (@Modulo IS NULL OR b.Modulo = @Modulo)
      AND (@Entidad IS NULL OR b.Entidad = @Entidad)
      AND (@Accion IS NULL OR b.Accion = @Accion)
      AND (@IDUsuario IS NULL OR b.IDUsuario = @IDUsuario)
      AND (@FechaInicio IS NULL OR b.FechaEvento >= @FechaInicio)
      AND (@FechaFin IS NULL OR b.FechaEvento <= @FechaFin)
      AND (@Busqueda IS NULL OR (
            b.IDRegistro LIKE '%' + @Busqueda + '%'
            OR b.Modulo LIKE '%' + @Busqueda + '%'
            OR b.Entidad LIKE '%' + @Busqueda + '%'
            OR b.Accion LIKE '%' + @Busqueda + '%'
            OR u.Correo LIKE '%' + @Busqueda + '%'
            OR u.Nombres LIKE '%' + @Busqueda + '%'
            OR u.Apellidos LIKE '%' + @Busqueda + '%'
          ));

    -- Registros paginados ordenados por FechaEvento descendente
    SELECT 
        b.IDBitacora,
        b.FechaEvento,
        b.IDUsuario,
        u.Correo AS CorreoUsuario,
        LTRIM(RTRIM(CONCAT(u.Nombres, ' ', u.Apellidos))) AS NombreCompletoUsuario,
        b.Modulo,
        b.Entidad,
        b.IDRegistro,
        b.Accion,
        b.ValorAnterior,
        b.ValorNuevo,
        b.DireccionIP,
        b.CorrelationId
    FROM dbo.RegistroBitacora b
    LEFT JOIN dbo.Usuario u ON b.IDUsuario = u.IDUsuario
    WHERE (@Modulo IS NULL OR b.Modulo = @Modulo)
      AND (@Entidad IS NULL OR b.Entidad = @Entidad)
      AND (@Accion IS NULL OR b.Accion = @Accion)
      AND (@IDUsuario IS NULL OR b.IDUsuario = @IDUsuario)
      AND (@FechaInicio IS NULL OR b.FechaEvento >= @FechaInicio)
      AND (@FechaFin IS NULL OR b.FechaEvento <= @FechaFin)
      AND (@Busqueda IS NULL OR (
            b.IDRegistro LIKE '%' + @Busqueda + '%'
            OR b.Modulo LIKE '%' + @Busqueda + '%'
            OR b.Entidad LIKE '%' + @Busqueda + '%'
            OR b.Accion LIKE '%' + @Busqueda + '%'
            OR u.Correo LIKE '%' + @Busqueda + '%'
            OR u.Nombres LIKE '%' + @Busqueda + '%'
            OR u.Apellidos LIKE '%' + @Busqueda + '%'
          ))
    ORDER BY b.FechaEvento DESC, b.IDBitacora DESC
    OFFSET @Offset ROWS
    FETCH NEXT @Limite ROWS ONLY
    OPTION (RECOMPILE);
END;
GO
