/* =========================================================================
   ShopCart - Control de Inventario y Kardex 
     - Vistas: VW_Modulo_Proceso
     - Stored Procedures: SP_Modulo_Proceso
   ========================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* =========================================================================
   1. VISTA: dbo.VW_Inventario_Disponibilidad
   Consolida variantes, productos, categorías y existencias por almacén,
   calculando en tiempo real la cantidad disponible y el estado del stock.
   ========================================================================= */
CREATE OR ALTER VIEW dbo.VW_Inventario_Disponibilidad
AS
SELECT 
    v.IDVariante,
    v.IDProducto,
    v.SKU,
    v.Precio,
    v.Costo,
    v.EstaActiva AS VarianteActiva,
    p.Nombre AS ProductoNombre,
    p.Marca AS ProductoMarca,
    p.EstaActivo AS ProductoActivo,
    c.IDCategoria,
    c.Nombre AS CategoriaNombre,
    alm.IDAlmacen,
    alm.Codigo AS CodigoAlmacen,
    alm.Nombre AS NombreAlmacen,
    ISNULL(inv.IDInventario, 0) AS IDInventario,
    ISNULL(inv.Existencia, 0) AS Existencia,
    ISNULL(inv.CantidadReservada, 0) AS CantidadReservada,
    (ISNULL(inv.Existencia, 0) - ISNULL(inv.CantidadReservada, 0)) AS CantidadDisponible,
    ISNULL(inv.PuntoReorden, 0) AS PuntoReorden,
    CASE 
        WHEN (ISNULL(inv.Existencia, 0) - ISNULL(inv.CantidadReservada, 0)) <= 0 THEN 'AGOTADO'
        WHEN (ISNULL(inv.Existencia, 0) - ISNULL(inv.CantidadReservada, 0)) <= ISNULL(inv.PuntoReorden, 0) THEN 'BAJO_STOCK'
        ELSE 'NORMAL'
    END AS EstadoStock,
    ISNULL(inv.FechaActualizacion, v.FechaCreacion) AS FechaActualizacion,
    (
        SELECT 
            a.Nombre AS atributo,
            va.Valor AS valor
        FROM dbo.VarianteAtributo vattr
        INNER JOIN dbo.ValorAtributo va ON vattr.IDValorAtributo = va.IDValorAtributo
        INNER JOIN dbo.Atributo a ON va.IDAtributo = a.IDAtributo
        WHERE vattr.IDVariante = v.IDVariante
        FOR JSON PATH
    ) AS AtributosJson
FROM dbo.VarianteProducto v
INNER JOIN dbo.Producto p ON v.IDProducto = p.IDProducto
INNER JOIN dbo.Categoria c ON p.IDCategoria = c.IDCategoria
CROSS JOIN dbo.Almacen alm
LEFT JOIN dbo.Inventario inv ON v.IDVariante = inv.IDVariante AND inv.IDAlmacen = alm.IDAlmacen;
GO

/* =========================================================================
   2. SP_Inventario_ListarExistencias
   Consulta existencias de variantes y productos con filtros y paginación
   a través de la vista VW_Inventario_Disponibilidad.
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Inventario_ListarExistencias
    @Pagina INT = 1,
    @Limite INT = 20,
    @IDProducto INT = NULL,
    @IDCategoria INT = NULL,
    @SoloBajoStock BIT = 0,
    @SoloAgotados BIT = 0,
    @Busqueda NVARCHAR(100) = NULL,
    @CodigoAlmacen VARCHAR(30) = 'PRINCIPAL',
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

    -- Obtener IDAlmacen correspondiente
    DECLARE @IDAlmacen INT;
    SELECT @IDAlmacen = IDAlmacen FROM dbo.Almacen WHERE Codigo = @CodigoAlmacen;
    IF @IDAlmacen IS NULL
    BEGIN
        SELECT TOP 1 @IDAlmacen = IDAlmacen FROM dbo.Almacen WHERE Codigo = 'PRINCIPAL';
    END

    -- Conteo total con filtros usando la vista
    SELECT @TotalRegistros = COUNT(1)
    FROM dbo.VW_Inventario_Disponibilidad inv
    WHERE inv.IDAlmacen = @IDAlmacen
      AND (@IDProducto IS NULL OR inv.IDProducto = @IDProducto)
      AND (@IDCategoria IS NULL OR inv.IDCategoria = @IDCategoria)
      AND (@SoloBajoStock = 0 OR (inv.CantidadDisponible <= inv.PuntoReorden AND inv.CantidadDisponible > 0))
      AND (@SoloAgotados = 0 OR inv.CantidadDisponible <= 0)
      AND (@Busqueda IS NULL OR (
            inv.SKU LIKE '%' + @Busqueda + '%'
            OR inv.ProductoNombre LIKE '%' + @Busqueda + '%'
            OR inv.ProductoMarca LIKE '%' + @Busqueda + '%'
            OR inv.CategoriaNombre LIKE '%' + @Busqueda + '%'
          ));

    -- Registros paginados usando la vista
    SELECT 
        inv.IDVariante,
        inv.IDProducto,
        inv.SKU,
        inv.Precio,
        inv.Costo,
        inv.VarianteActiva,
        inv.ProductoNombre,
        inv.ProductoMarca,
        inv.ProductoActivo,
        inv.IDCategoria,
        inv.CategoriaNombre,
        inv.IDInventario,
        inv.IDAlmacen,
        inv.Existencia,
        inv.CantidadReservada,
        inv.CantidadDisponible,
        inv.PuntoReorden,
        inv.EstadoStock,
        inv.FechaActualizacion,
        inv.AtributosJson
    FROM dbo.VW_Inventario_Disponibilidad inv
    WHERE inv.IDAlmacen = @IDAlmacen
      AND (@IDProducto IS NULL OR inv.IDProducto = @IDProducto)
      AND (@IDCategoria IS NULL OR inv.IDCategoria = @IDCategoria)
      AND (@SoloBajoStock = 0 OR (inv.CantidadDisponible <= inv.PuntoReorden AND inv.CantidadDisponible > 0))
      AND (@SoloAgotados = 0 OR inv.CantidadDisponible <= 0)
      AND (@Busqueda IS NULL OR (
            inv.SKU LIKE '%' + @Busqueda + '%'
            OR inv.ProductoNombre LIKE '%' + @Busqueda + '%'
            OR inv.ProductoMarca LIKE '%' + @Busqueda + '%'
            OR inv.CategoriaNombre LIKE '%' + @Busqueda + '%'
          ))
    ORDER BY 
        CASE 
            WHEN inv.CantidadDisponible <= 0 THEN 1
            WHEN inv.CantidadDisponible <= inv.PuntoReorden THEN 2
            ELSE 3
        END ASC,
        inv.ProductoNombre ASC,
        inv.SKU ASC
    OFFSET @Offset ROWS
    FETCH NEXT @Limite ROWS ONLY;
END;
GO

/* =========================================================================
   3. SP_Inventario_ObtenerPorVariante
   Obtiene el balance y detalle de stock de una variante específica
   a través de la vista VW_Inventario_Disponibilidad.
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Inventario_ObtenerPorVariante
    @IDVariante INT,
    @CodigoAlmacen VARCHAR(30) = 'PRINCIPAL'
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @IDAlmacen INT;
    SELECT @IDAlmacen = IDAlmacen FROM dbo.Almacen WHERE Codigo = @CodigoAlmacen;
    IF @IDAlmacen IS NULL
        SELECT TOP 1 @IDAlmacen = IDAlmacen FROM dbo.Almacen WHERE Codigo = 'PRINCIPAL';

    SELECT 
        inv.IDVariante,
        inv.IDProducto,
        inv.SKU,
        inv.Precio,
        inv.Costo,
        inv.VarianteActiva,
        inv.ProductoNombre,
        inv.ProductoMarca,
        inv.CategoriaNombre,
        inv.IDInventario,
        inv.IDAlmacen,
        inv.Existencia,
        inv.CantidadReservada,
        inv.CantidadDisponible,
        inv.PuntoReorden,
        inv.EstadoStock,
        inv.FechaActualizacion,
        inv.AtributosJson
    FROM dbo.VW_Inventario_Disponibilidad inv
    WHERE inv.IDVariante = @IDVariante
      AND inv.IDAlmacen = @IDAlmacen;
END;
GO

/* =========================================================================
   3. SP_Inventario_RegistrarEntrada
   Registra una entrada de mercancía (compra o abastecimiento inicial).
   Incrementa existencia física, registra kardex inmutable y genera bitácora.
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Inventario_RegistrarEntrada
    @IDVariante INT,
    @Cantidad INT,
    @Motivo NVARCHAR(300),
    @IDUsuario INT,
    @CodigoAlmacen VARCHAR(30) = 'PRINCIPAL',
    @DireccionIP VARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    -- Validaciones de entrada
    IF @Cantidad IS NULL OR @Cantidad <= 0
    BEGIN
        THROW 50303, N'La cantidad de entrada debe ser un número entero mayor a cero.', 1;
    END

    IF @Motivo IS NULL OR LEN(LTRIM(RTRIM(@Motivo))) = 0
    BEGIN
        THROW 50304, N'El motivo de la entrada es obligatorio.', 1;
    END

    IF NOT EXISTS (SELECT 1 FROM dbo.Usuario WHERE IDUsuario = @IDUsuario AND EstaActivo = 1)
    BEGIN
        THROW 50307, N'El usuario auditor no existe o está inactivo.', 1;
    END

    IF NOT EXISTS (SELECT 1 FROM dbo.VarianteProducto WHERE IDVariante = @IDVariante)
    BEGIN
        THROW 50302, N'La variante de producto especificada no existe.', 1;
    END

    DECLARE @IDAlmacen INT;
    SELECT @IDAlmacen = IDAlmacen FROM dbo.Almacen WHERE Codigo = @CodigoAlmacen AND EstaActivo = 1;
    IF @IDAlmacen IS NULL
    BEGIN
        SELECT TOP 1 @IDAlmacen = IDAlmacen FROM dbo.Almacen WHERE Codigo = 'PRINCIPAL' AND EstaActivo = 1;
    END
    IF @IDAlmacen IS NULL
    BEGIN
        THROW 50301, N'No existe un almacén activo disponible para la operación.', 1;
    END

    BEGIN TRANSACTION;
    BEGIN TRY
        -- Garantizar fila en dbo.Inventario
        IF NOT EXISTS (SELECT 1 FROM dbo.Inventario WITH (UPDLOCK, HOLDLOCK) WHERE IDVariante = @IDVariante AND IDAlmacen = @IDAlmacen)
        BEGIN
            INSERT INTO dbo.Inventario (IDVariante, IDAlmacen, Existencia, CantidadReservada, PuntoReorden, FechaActualizacion)
            VALUES (@IDVariante, @IDAlmacen, 0, 0, 0, SYSUTCDATETIME());
        END

        -- Bloquear fila para actualización atómica
        DECLARE @ExistenciaAnterior INT;
        DECLARE @ExistenciaPosterior INT;

        SELECT @ExistenciaAnterior = Existencia
        FROM dbo.Inventario WITH (UPDLOCK, ROWLOCK)
        WHERE IDVariante = @IDVariante AND IDAlmacen = @IDAlmacen;

        SET @ExistenciaPosterior = @ExistenciaAnterior + @Cantidad;

        -- Actualizar saldo en Inventario
        UPDATE dbo.Inventario
        SET Existencia = @ExistenciaPosterior,
            FechaActualizacion = SYSUTCDATETIME()
        WHERE IDVariante = @IDVariante AND IDAlmacen = @IDAlmacen;

        -- Registrar en Kardex físico (inmutable)
        DECLARE @IDMovimiento BIGINT;
        INSERT INTO dbo.MovimientoInventario (
            IDVariante,
            IDAlmacen,
            TipoMovimiento,
            Cantidad,
            ExistenciaAnterior,
            ExistenciaPosterior,
            IDPedido,
            IDUsuario,
            Motivo,
            FechaMovimiento
        )
        VALUES (
            @IDVariante,
            @IDAlmacen,
            'ENTRADA_COMPRA',
            @Cantidad,
            @ExistenciaAnterior,
            @ExistenciaPosterior,
            NULL,
            @IDUsuario,
            LTRIM(RTRIM(@Motivo)),
            SYSUTCDATETIME()
        );

        SET @IDMovimiento = SCOPE_IDENTITY();

        -- Registrar en Bitácora inmutable 
        DECLARE @ValorAnteriorJson NVARCHAR(MAX) = (
            SELECT @ExistenciaAnterior AS existenciaAnterior FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        );
        DECLARE @ValorNuevoJson NVARCHAR(MAX) = (
            SELECT 
                @ExistenciaPosterior AS existenciaPosterior,
                @Cantidad AS cantidadEntrada,
                'ENTRADA_COMPRA' AS tipoMovimiento,
                @IDMovimiento AS idMovimientoKardex
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        );

        INSERT INTO dbo.RegistroBitacora (
            FechaEvento,
            IDUsuario,
            Modulo,
            Entidad,
            IDRegistro,
            Accion,
            ValorAnterior,
            ValorNuevo,
            DireccionIP
        )
        VALUES (
            SYSUTCDATETIME(),
            @IDUsuario,
            'inventario',
            'Inventario',
            CAST(@IDVariante AS NVARCHAR(100)),
            'ENTRADA_COMPRA',
            @ValorAnteriorJson,
            @ValorNuevoJson,
            @DireccionIP
        );

        COMMIT TRANSACTION;

        -- Retornar el detalle actualizado
        EXEC dbo.SP_Inventario_ObtenerPorVariante @IDVariante = @IDVariante, @CodigoAlmacen = @CodigoAlmacen;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

/* =========================================================================
   4. SP_Inventario_RegistrarAjuste
   Registra un ajuste manual físico (positivo o negativo) con motivo obligatorio.
   -- Validación de ajuste manual
   Valida también que la existencia física no caiga por debajo de la cantidad reservada.
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Inventario_RegistrarAjuste
    @IDVariante INT,
    @Cantidad INT,
    @Motivo NVARCHAR(300),
    @IDUsuario INT,
    @CodigoAlmacen VARCHAR(30) = 'PRINCIPAL',
    @DireccionIP VARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    -- Validaciones de entrada
    IF @Cantidad IS NULL OR @Cantidad = 0
    BEGIN
        THROW 50303, N'La cantidad del ajuste no puede ser cero.', 1;
    END

    IF @Motivo IS NULL OR LEN(LTRIM(RTRIM(@Motivo))) = 0
    BEGIN
        THROW 50304, N'El motivo del ajuste manual es obligatorio.', 1;
    END

    IF NOT EXISTS (SELECT 1 FROM dbo.Usuario WHERE IDUsuario = @IDUsuario AND EstaActivo = 1)
    BEGIN
        THROW 50307, N'El usuario auditor no existe o está inactivo.', 1;
    END

    IF NOT EXISTS (SELECT 1 FROM dbo.VarianteProducto WHERE IDVariante = @IDVariante)
    BEGIN
        THROW 50302, N'La variante de producto especificada no existe.', 1;
    END

    DECLARE @IDAlmacen INT;
    SELECT @IDAlmacen = IDAlmacen FROM dbo.Almacen WHERE Codigo = @CodigoAlmacen AND EstaActivo = 1;
    IF @IDAlmacen IS NULL
    BEGIN
        SELECT TOP 1 @IDAlmacen = IDAlmacen FROM dbo.Almacen WHERE Codigo = 'PRINCIPAL' AND EstaActivo = 1;
    END
    IF @IDAlmacen IS NULL
    BEGIN
        THROW 50301, N'No existe un almacén activo disponible para la operación.', 1;
    END

    BEGIN TRANSACTION;
    BEGIN TRY
        -- Garantizar fila en dbo.Inventario
        IF NOT EXISTS (SELECT 1 FROM dbo.Inventario WITH (UPDLOCK, HOLDLOCK) WHERE IDVariante = @IDVariante AND IDAlmacen = @IDAlmacen)
        BEGIN
            INSERT INTO dbo.Inventario (IDVariante, IDAlmacen, Existencia, CantidadReservada, PuntoReorden, FechaActualizacion)
            VALUES (@IDVariante, @IDAlmacen, 0, 0, 0, SYSUTCDATETIME());
        END

        DECLARE @ExistenciaAnterior INT;
        DECLARE @CantidadReservada INT;
        DECLARE @ExistenciaPosterior INT;

        SELECT 
            @ExistenciaAnterior = Existencia,
            @CantidadReservada = CantidadReservada
        FROM dbo.Inventario WITH (UPDLOCK, ROWLOCK)
        WHERE IDVariante = @IDVariante AND IDAlmacen = @IDAlmacen;

        SET @ExistenciaPosterior = @ExistenciaAnterior + @Cantidad;

        -- No puede dejar la existencia en negativo
        IF @ExistenciaPosterior < 0
        BEGIN
            THROW 50305, N'El ajuste dejaría la existencia física en saldo negativo. Operación rechazada.', 1;
        END

        -- Protección de sobreventa: no reducir existencias por debajo del stock ya reservado
        IF @ExistenciaPosterior < @CantidadReservada
        BEGIN
            THROW 50306, N'El ajuste no puede dejar la existencia física menor a las unidades actualmente reservadas.', 1;
        END

        DECLARE @TipoMovimiento VARCHAR(25) = CASE WHEN @Cantidad > 0 THEN 'AJUSTE_POSITIVO' ELSE 'AJUSTE_NEGATIVO' END;

        -- Actualizar saldo en Inventario
        UPDATE dbo.Inventario
        SET Existencia = @ExistenciaPosterior,
            FechaActualizacion = SYSUTCDATETIME()
        WHERE IDVariante = @IDVariante AND IDAlmacen = @IDAlmacen;

        -- Registrar en Kardex inmutable
        DECLARE @IDMovimiento BIGINT;
        INSERT INTO dbo.MovimientoInventario (
            IDVariante,
            IDAlmacen,
            TipoMovimiento,
            Cantidad,
            ExistenciaAnterior,
            ExistenciaPosterior,
            IDPedido,
            IDUsuario,
            Motivo,
            FechaMovimiento
        )
        VALUES (
            @IDVariante,
            @IDAlmacen,
            @TipoMovimiento,
            @Cantidad,
            @ExistenciaAnterior,
            @ExistenciaPosterior,
            NULL,
            @IDUsuario,
            LTRIM(RTRIM(@Motivo)),
            SYSUTCDATETIME()
        );

        SET @IDMovimiento = SCOPE_IDENTITY();

        -- Registrar en Bitácora
        DECLARE @ValorAnteriorJson NVARCHAR(MAX) = (
            SELECT @ExistenciaAnterior AS existenciaAnterior FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        );
        DECLARE @ValorNuevoJson NVARCHAR(MAX) = (
            SELECT 
                @ExistenciaPosterior AS existenciaPosterior,
                @Cantidad AS cantidadAjuste,
                @TipoMovimiento AS tipoMovimiento,
                @IDMovimiento AS idMovimientoKardex,
                @Motivo AS motivo
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        );

        INSERT INTO dbo.RegistroBitacora (
            FechaEvento,
            IDUsuario,
            Modulo,
            Entidad,
            IDRegistro,
            Accion,
            ValorAnterior,
            ValorNuevo,
            DireccionIP
        )
        VALUES (
            SYSUTCDATETIME(),
            @IDUsuario,
            'inventario',
            'Inventario',
            CAST(@IDVariante AS NVARCHAR(100)),
            @TipoMovimiento,
            @ValorAnteriorJson,
            @ValorNuevoJson,
            @DireccionIP
        );

        COMMIT TRANSACTION;

        EXEC dbo.SP_Inventario_ObtenerPorVariante @IDVariante = @IDVariante, @CodigoAlmacen = @CodigoAlmacen;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

/* =========================================================================
   5. SP_Inventario_ActualizarPuntoReorden
   Configura el umbral de alerta de stock bajo para una variante.
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Inventario_ActualizarPuntoReorden
    @IDVariante INT,
    @PuntoReorden INT,
    @IDUsuario INT,
    @CodigoAlmacen VARCHAR(30) = 'PRINCIPAL',
    @DireccionIP VARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @PuntoReorden IS NULL OR @PuntoReorden < 0
    BEGIN
        THROW 50308, N'El punto de reorden debe ser un entero mayor o igual a cero.', 1;
    END

    IF NOT EXISTS (SELECT 1 FROM dbo.Usuario WHERE IDUsuario = @IDUsuario AND EstaActivo = 1)
    BEGIN
        THROW 50307, N'El usuario auditor no existe o está inactivo.', 1;
    END

    IF NOT EXISTS (SELECT 1 FROM dbo.VarianteProducto WHERE IDVariante = @IDVariante)
    BEGIN
        THROW 50302, N'La variante especificada no existe.', 1;
    END

    DECLARE @IDAlmacen INT;
    SELECT @IDAlmacen = IDAlmacen FROM dbo.Almacen WHERE Codigo = @CodigoAlmacen AND EstaActivo = 1;
    IF @IDAlmacen IS NULL
        SELECT TOP 1 @IDAlmacen = IDAlmacen FROM dbo.Almacen WHERE Codigo = 'PRINCIPAL' AND EstaActivo = 1;

    BEGIN TRANSACTION;
    BEGIN TRY
        IF NOT EXISTS (SELECT 1 FROM dbo.Inventario WITH (UPDLOCK, HOLDLOCK) WHERE IDVariante = @IDVariante AND IDAlmacen = @IDAlmacen)
        BEGIN
            INSERT INTO dbo.Inventario (IDVariante, IDAlmacen, Existencia, CantidadReservada, PuntoReorden, FechaActualizacion)
            VALUES (@IDVariante, @IDAlmacen, 0, 0, @PuntoReorden, SYSUTCDATETIME());
        END
        ELSE
        BEGIN
            UPDATE dbo.Inventario
            SET PuntoReorden = @PuntoReorden,
                FechaActualizacion = SYSUTCDATETIME()
            WHERE IDVariante = @IDVariante AND IDAlmacen = @IDAlmacen;
        END

        INSERT INTO dbo.RegistroBitacora (
            FechaEvento,
            IDUsuario,
            Modulo,
            Entidad,
            IDRegistro,
            Accion,
            ValorAnterior,
            ValorNuevo,
            DireccionIP
        )
        VALUES (
            SYSUTCDATETIME(),
            @IDUsuario,
            'inventario',
            'Inventario',
            CAST(@IDVariante AS NVARCHAR(100)),
            'CONFIGURAR_PUNTO_REORDEN',
            NULL,
            (SELECT @PuntoReorden AS puntoReorden FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
            @DireccionIP
        );

        COMMIT TRANSACTION;

        EXEC dbo.SP_Inventario_ObtenerPorVariante @IDVariante = @IDVariante, @CodigoAlmacen = @CodigoAlmacen;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

/* =========================================================================
   6. SP_Inventario_ListarKardex
   Consulta paginada del historial físico inmutable de movimientos en Kardex.
   Consulta con filtros por variante, tipo, fecha y búsqueda.
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Inventario_ListarKardex
    @Pagina INT = 1,
    @Limite INT = 20,
    @IDVariante INT = NULL,
    @IDProducto INT = NULL,
    @TipoMovimiento VARCHAR(25) = NULL,
    @FechaInicio DATETIME2(3) = NULL,
    @FechaFin DATETIME2(3) = NULL,
    @Busqueda NVARCHAR(100) = NULL,
    @CodigoAlmacen VARCHAR(30) = NULL,
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

    DECLARE @IDAlmacen INT = NULL;
    IF @CodigoAlmacen IS NOT NULL
    BEGIN
        SELECT @IDAlmacen = IDAlmacen FROM dbo.Almacen WHERE Codigo = @CodigoAlmacen;
    END

    -- Conteo total
    SELECT @TotalRegistros = COUNT(1)
    FROM dbo.MovimientoInventario m
    INNER JOIN dbo.VarianteProducto v ON m.IDVariante = v.IDVariante
    INNER JOIN dbo.Producto p ON v.IDProducto = p.IDProducto
    INNER JOIN dbo.Almacen a ON m.IDAlmacen = a.IDAlmacen
    INNER JOIN dbo.Usuario u ON m.IDUsuario = u.IDUsuario
    WHERE (@IDVariante IS NULL OR m.IDVariante = @IDVariante)
      AND (@IDProducto IS NULL OR p.IDProducto = @IDProducto)
      AND (@IDAlmacen IS NULL OR m.IDAlmacen = @IDAlmacen)
      AND (@TipoMovimiento IS NULL OR m.TipoMovimiento = @TipoMovimiento)
      AND (@FechaInicio IS NULL OR m.FechaMovimiento >= @FechaInicio)
      AND (@FechaFin IS NULL OR m.FechaMovimiento <= @FechaFin)
      AND (@Busqueda IS NULL OR (
            v.SKU LIKE '%' + @Busqueda + '%'
            OR p.Nombre LIKE '%' + @Busqueda + '%'
            OR m.Motivo LIKE '%' + @Busqueda + '%'
            OR u.Correo LIKE '%' + @Busqueda + '%'
            OR u.Nombres LIKE '%' + @Busqueda + '%'
            OR u.Apellidos LIKE '%' + @Busqueda + '%'
          ));

    -- Registros paginados
    SELECT 
        m.IDMovimiento,
        m.IDVariante,
        v.SKU,
        p.IDProducto,
        p.Nombre AS ProductoNombre,
        a.IDAlmacen,
        a.Nombre AS AlmacenNombre,
        m.TipoMovimiento,
        m.Cantidad,
        m.ExistenciaAnterior,
        m.ExistenciaPosterior,
        m.IDPedido,
        m.IDUsuario,
        (u.Nombres + ' ' + u.Apellidos) AS UsuarioNombreCompleto,
        u.Correo AS UsuarioCorreo,
        m.Motivo,
        m.FechaMovimiento
    FROM dbo.MovimientoInventario m
    INNER JOIN dbo.VarianteProducto v ON m.IDVariante = v.IDVariante
    INNER JOIN dbo.Producto p ON v.IDProducto = p.IDProducto
    INNER JOIN dbo.Almacen a ON m.IDAlmacen = a.IDAlmacen
    INNER JOIN dbo.Usuario u ON m.IDUsuario = u.IDUsuario
    WHERE (@IDVariante IS NULL OR m.IDVariante = @IDVariante)
      AND (@IDProducto IS NULL OR p.IDProducto = @IDProducto)
      AND (@IDAlmacen IS NULL OR m.IDAlmacen = @IDAlmacen)
      AND (@TipoMovimiento IS NULL OR m.TipoMovimiento = @TipoMovimiento)
      AND (@FechaInicio IS NULL OR m.FechaMovimiento >= @FechaInicio)
      AND (@FechaFin IS NULL OR m.FechaMovimiento <= @FechaFin)
      AND (@Busqueda IS NULL OR (
            v.SKU LIKE '%' + @Busqueda + '%'
            OR p.Nombre LIKE '%' + @Busqueda + '%'
            OR m.Motivo LIKE '%' + @Busqueda + '%'
            OR u.Correo LIKE '%' + @Busqueda + '%'
            OR u.Nombres LIKE '%' + @Busqueda + '%'
            OR u.Apellidos LIKE '%' + @Busqueda + '%'
          ))
    ORDER BY m.FechaMovimiento DESC, m.IDMovimiento DESC
    OFFSET @Offset ROWS
    FETCH NEXT @Limite ROWS ONLY;
END;
GO

/* =========================================================================
   7. SP_Inventario_ReservarExistencia
   Reserva temporal de stock disponible durante el checkout concurrente (15 min).
   No altera la existencia física ni genera kardex (según reglas v3).
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Inventario_ReservarExistencia
    @IDVariante INT,
    @Cantidad INT,
    @CodigoAlmacen VARCHAR(30) = 'PRINCIPAL'
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @Cantidad IS NULL OR @Cantidad <= 0
    BEGIN
        THROW 50303, N'La cantidad a reservar debe ser mayor a cero.', 1;
    END

    DECLARE @IDAlmacen INT;
    SELECT @IDAlmacen = IDAlmacen FROM dbo.Almacen WHERE Codigo = @CodigoAlmacen AND EstaActivo = 1;
    IF @IDAlmacen IS NULL
        SELECT TOP 1 @IDAlmacen = IDAlmacen FROM dbo.Almacen WHERE Codigo = 'PRINCIPAL' AND EstaActivo = 1;

    BEGIN TRANSACTION;
    BEGIN TRY
        DECLARE @Existencia INT = 0;
        DECLARE @CantidadReservada INT = 0;

        SELECT 
            @Existencia = Existencia,
            @CantidadReservada = CantidadReservada
        FROM dbo.Inventario WITH (UPDLOCK, ROWLOCK)
        WHERE IDVariante = @IDVariante AND IDAlmacen = @IDAlmacen;

        IF @Existencia IS NULL
        BEGIN
            THROW 50305, N'No hay inventario registrado para la variante solicitada.', 1;
        END

        -- Comprobar si hay suficiente stock disponible
        IF (@Existencia - @CantidadReservada) < @Cantidad
        BEGIN
            THROW 50305, N'Existencia disponible insuficiente para completar la reserva solicitada.', 1;
        END

        UPDATE dbo.Inventario
        SET CantidadReservada = CantidadReservada + @Cantidad,
            FechaActualizacion = SYSUTCDATETIME()
        WHERE IDVariante = @IDVariante AND IDAlmacen = @IDAlmacen;

        COMMIT TRANSACTION;

        SELECT 
            @IDVariante AS IDVariante,
            @Cantidad AS CantidadReservadaAdicional,
            (@Existencia - (@CantidadReservada + @Cantidad)) AS CantidadDisponibleRestante;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

/* =========================================================================
   8. SP_Inventario_LiberarReserva
   Libera unidades reservadas (por expiración de reserva o cancelación de checkout).
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Inventario_LiberarReserva
    @IDVariante INT,
    @Cantidad INT,
    @CodigoAlmacen VARCHAR(30) = 'PRINCIPAL'
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @Cantidad IS NULL OR @Cantidad <= 0
    BEGIN
        THROW 50303, N'La cantidad a liberar debe ser mayor a cero.', 1;
    END

    DECLARE @IDAlmacen INT;
    SELECT @IDAlmacen = IDAlmacen FROM dbo.Almacen WHERE Codigo = @CodigoAlmacen;
    IF @IDAlmacen IS NULL
        SELECT TOP 1 @IDAlmacen = IDAlmacen FROM dbo.Almacen WHERE Codigo = 'PRINCIPAL';

    BEGIN TRANSACTION;
    BEGIN TRY
        UPDATE dbo.Inventario
        SET CantidadReservada = CASE 
                WHEN CantidadReservada >= @Cantidad THEN CantidadReservada - @Cantidad 
                ELSE 0 
            END,
            FechaActualizacion = SYSUTCDATETIME()
        WHERE IDVariante = @IDVariante AND IDAlmacen = @IDAlmacen;

        COMMIT TRANSACTION;

        SELECT 
            @IDVariante AS IDVariante,
            @Cantidad AS CantidadLiberada;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
