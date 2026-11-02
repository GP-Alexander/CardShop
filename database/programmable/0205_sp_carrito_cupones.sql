/* =========================================================================
   ShopCart - SPs de Carrito de Compras y Cupones 
   ========================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* =========================================================================
   1. SP_Carrito_ObtenerOCrear
   Obtiene el carrito activo de un cliente o invitado. Si no existe, lo crea.
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Carrito_ObtenerOCrear
    @IDUsuario INT = NULL,
    @TokenInvitadoHash CHAR(64) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    -- Validar exclusión mutua de propietario
    IF (@IDUsuario IS NULL AND @TokenInvitadoHash IS NULL)
       OR (@IDUsuario IS NOT NULL AND @TokenInvitadoHash IS NOT NULL)
    BEGIN
        THROW 50001, N'Debe especificarse exactamente un IDUsuario o un TokenInvitadoHash, nunca ambos ni ninguno.', 1;
    END

    DECLARE @IDCarrito BIGINT;

    -- Buscar carrito ACTIVO existente
    IF @IDUsuario IS NOT NULL
    BEGIN
        SELECT @IDCarrito = IDCarrito 
        FROM dbo.Carrito WITH (UPDLOCK, HOLDLOCK)
        WHERE IDUsuario = @IDUsuario AND Estado = 'ACTIVO';
    END
    ELSE
    BEGIN
        SELECT @IDCarrito = IDCarrito 
        FROM dbo.Carrito WITH (UPDLOCK, HOLDLOCK)
        WHERE TokenInvitadoHash = @TokenInvitadoHash AND Estado = 'ACTIVO';
    END

    -- Si no existe, crearlo
    IF @IDCarrito IS NULL
    BEGIN
        INSERT INTO dbo.Carrito (IDUsuario, TokenInvitadoHash, Estado, FechaCreacion, FechaUltimaActividad)
        VALUES (@IDUsuario, @TokenInvitadoHash, 'ACTIVO', SYSUTCDATETIME(), SYSUTCDATETIME());

        SET @IDCarrito = SCOPE_IDENTITY();
    END
    ELSE
    BEGIN
        -- Actualizar fecha de última actividad
        UPDATE dbo.Carrito 
        SET FechaUltimaActividad = SYSUTCDATETIME()
        WHERE IDCarrito = @IDCarrito;
    END

    -- Retornar ID del carrito asegurado
    SELECT @IDCarrito AS IDCarrito;
END;
GO

/* =========================================================================
   2. SP_Carrito_ObtenerDetalle
   Retorna cabecera con subtotales, cupón, descuentos y listado de items.
   Cálculo exacto de totales sin errores de redondeo.
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Carrito_ObtenerDetalle
    @IDCarrito BIGINT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @IDAlmacen INT;
    SELECT TOP 1 @IDAlmacen = IDAlmacen FROM dbo.Almacen WHERE Codigo = 'PRINCIPAL';

    -- 1. Detalle de Items del Carrito con Existencia Disponible
    SELECT 
        d.IDVariante,
        v.SKU,
        p.IDProducto,
        p.Nombre AS ProductoNombre,
        p.Marca AS ProductoMarca,
        c.IDCategoria,
        c.Nombre AS CategoriaNombre,
        v.Precio AS PrecioUnitario,
        d.Cantidad,
        CAST((v.Precio * d.Cantidad) AS DECIMAL(12,2)) AS SubtotalLinea,
        -- Existencia disponible = física - reservada
        ISNULL(inv.Existencia, 0) - ISNULL(inv.CantidadReservada, 0) AS ExistenciaDisponible,
        CASE 
            WHEN (ISNULL(inv.Existencia, 0) - ISNULL(inv.CantidadReservada, 0)) >= d.Cantidad THEN 1
            ELSE 0
        END AS StockDisponibleSuficiente,
        -- Atributos de la variante
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
    FROM dbo.CarritoDetalle d
    INNER JOIN dbo.VarianteProducto v ON d.IDVariante = v.IDVariante
    INNER JOIN dbo.Producto p ON v.IDProducto = p.IDProducto
    INNER JOIN dbo.Categoria c ON p.IDCategoria = c.IDCategoria
    LEFT JOIN dbo.Inventario inv ON v.IDVariante = inv.IDVariante AND inv.IDAlmacen = @IDAlmacen
    WHERE d.IDCarrito = @IDCarrito
    ORDER BY d.FechaAgregado ASC;

    -- 2. Cabecera y Resumen de Totales
    DECLARE @SubtotalGeneral DECIMAL(12,2) = 0;
    SELECT @SubtotalGeneral = ISNULL(SUM(v.Precio * d.Cantidad), 0)
    FROM dbo.CarritoDetalle d
    INNER JOIN dbo.VarianteProducto v ON d.IDVariante = v.IDVariante
    WHERE d.IDCarrito = @IDCarrito;

    -- Datos del cupón si existe
    DECLARE @IDCupon INT = NULL;
    DECLARE @CodigoCupon VARCHAR(50) = NULL;
    DECLARE @TipoDescuento VARCHAR(15) = NULL;
    DECLARE @ValorDescuento DECIMAL(12,2) = 0;
    DECLARE @AlcanceCupon VARCHAR(15) = NULL;
    DECLARE @IDCategoriaCupon INT = NULL;
    DECLARE @MontoMinimoCompra DECIMAL(12,2) = 0;
    DECLARE @DescuentoMaximo DECIMAL(12,2) = NULL;

    SELECT 
        @IDCupon = cup.IDCupon,
        @CodigoCupon = cup.Codigo,
        @TipoDescuento = cup.TipoDescuento,
        @ValorDescuento = cup.ValorDescuento,
        @AlcanceCupon = cup.Alcance,
        @IDCategoriaCupon = cup.IDCategoria,
        @MontoMinimoCompra = cup.MontoMinimoCompra,
        @DescuentoMaximo = cup.DescuentoMaximo
    FROM dbo.Carrito car
    INNER JOIN dbo.Cupon cup ON car.IDCupon = cup.IDCupon
    WHERE car.IDCarrito = @IDCarrito;

    -- Calcular descuento si el cupón está vigente y cumple requisitos
    DECLARE @DescuentoTotal DECIMAL(12,2) = 0;

    IF @IDCupon IS NOT NULL
    BEGIN
        DECLARE @BaseCalculo DECIMAL(12,2) = 0;

        IF @AlcanceCupon = 'CARRITO'
        BEGIN
            SET @BaseCalculo = @SubtotalGeneral;
        END
        ELSE IF @AlcanceCupon = 'CATEGORIA'
        BEGIN
            SELECT @BaseCalculo = ISNULL(SUM(v.Precio * d.Cantidad), 0)
            FROM dbo.CarritoDetalle d
            INNER JOIN dbo.VarianteProducto v ON d.IDVariante = v.IDVariante
            INNER JOIN dbo.Producto p ON v.IDProducto = p.IDProducto
            WHERE d.IDCarrito = @IDCarrito AND p.IDCategoria = @IDCategoriaCupon;
        END

        IF @BaseCalculo >= @MontoMinimoCompra AND @BaseCalculo > 0
        BEGIN
            IF @TipoDescuento = 'PORCENTAJE'
            BEGIN
                SET @DescuentoTotal = CAST((@BaseCalculo * (@ValorDescuento / 100.0)) AS DECIMAL(12,2));
                IF @DescuentoMaximo IS NOT NULL AND @DescuentoTotal > @DescuentoMaximo
                BEGIN
                    SET @DescuentoTotal = @DescuentoMaximo;
                END
            END
            ELSE IF @TipoDescuento = 'MONTO'
            BEGIN
                SET @DescuentoTotal = @ValorDescuento;
                IF @DescuentoTotal > @BaseCalculo
                BEGIN
                    SET @DescuentoTotal = @BaseCalculo;
                END
            END
        END
    END

    -- El total nunca puede quedar por debajo de cero
    DECLARE @TotalGeneral DECIMAL(12,2) = @SubtotalGeneral - @DescuentoTotal;
    IF @TotalGeneral < 0 SET @TotalGeneral = 0;

    SELECT 
        car.IDCarrito,
        car.IDUsuario,
        car.TokenInvitadoHash,
        car.Estado,
        car.FechaUltimaActividad,
        @SubtotalGeneral AS Subtotal,
        @DescuentoTotal AS Descuento,
        @TotalGeneral AS Total,
        @IDCupon AS IDCupon,
        @CodigoCupon AS CodigoCupon,
        @TipoDescuento AS TipoDescuentoCupon,
        @ValorDescuento AS ValorDescuentoCupon,
        @AlcanceCupon AS AlcanceCupon
    FROM dbo.Carrito car
    WHERE car.IDCarrito = @IDCarrito;
END;
GO

/* =========================================================================
   3. SP_Carrito_AgregarItem
   Agrega o incrementa cantidad de una variante en el carrito.
   -- Validación de disponibilidad
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Carrito_AgregarItem
    @IDCarrito BIGINT,
    @IDVariante INT,
    @Cantidad INT = 1
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @Cantidad IS NULL OR @Cantidad <= 0
    BEGIN
        THROW 50001, N'La cantidad a agregar debe ser un número entero mayor a cero.', 1;
    END

    -- Verificar que la variante exista y esté activa
    IF NOT EXISTS (
        SELECT 1 FROM dbo.VarianteProducto v
        INNER JOIN dbo.Producto p ON v.IDProducto = p.IDProducto
        WHERE v.IDVariante = @IDVariante AND v.EstaActiva = 1 AND p.EstaActivo = 1
    )
    BEGIN
        THROW 50104, N'El producto o variante solicitada no existe o no está disponible para la venta.', 1;
    END

    -- Consultar existencia disponible
    DECLARE @IDAlmacen INT;
    SELECT TOP 1 @IDAlmacen = IDAlmacen FROM dbo.Almacen WHERE Codigo = 'PRINCIPAL';

    DECLARE @ExistenciaDisponible INT = 0;
    SELECT @ExistenciaDisponible = ISNULL(Existencia, 0) - ISNULL(CantidadReservada, 0)
    FROM dbo.Inventario
    WHERE IDVariante = @IDVariante AND IDAlmacen = @IDAlmacen;

    DECLARE @CantidadEnCarrito INT = 0;
    SELECT @CantidadEnCarrito = Cantidad
    FROM dbo.CarritoDetalle
    WHERE IDCarrito = @IDCarrito AND IDVariante = @IDVariante;

    DECLARE @CantidadTotalRequerida INT = @CantidadEnCarrito + @Cantidad;

    -- Validación estricta contra stock disponible 
    IF @CantidadTotalRequerida > @ExistenciaDisponible
    BEGIN
        THROW 50305, N'No se puede agregar más cantidad que la existencia disponible en el inventario.', 1;
    END

    IF @CantidadTotalRequerida > 99
    BEGIN
        THROW 50001, N'La cantidad máxima permitida por variante en el carrito es de 99 unidades.', 1;
    END

    BEGIN TRANSACTION;
    BEGIN TRY
        IF EXISTS (SELECT 1 FROM dbo.CarritoDetalle WHERE IDCarrito = @IDCarrito AND IDVariante = @IDVariante)
        BEGIN
            UPDATE dbo.CarritoDetalle
            SET Cantidad = @CantidadTotalRequerida
            WHERE IDCarrito = @IDCarrito AND IDVariante = @IDVariante;
        END
        ELSE
        BEGIN
            INSERT INTO dbo.CarritoDetalle (IDCarrito, IDVariante, Cantidad, FechaAgregado)
            VALUES (@IDCarrito, @IDVariante, @Cantidad, SYSUTCDATETIME());
        END

        UPDATE dbo.Carrito
        SET FechaUltimaActividad = SYSUTCDATETIME()
        WHERE IDCarrito = @IDCarrito;

        COMMIT TRANSACTION;

        EXEC dbo.SP_Carrito_ObtenerDetalle @IDCarrito = @IDCarrito;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

/* =========================================================================
   4. SP_Carrito_ModificarCantidad
   Modifica la cantidad exacta de una variante en el carrito (o la elimina si es 0).
   Valida que no supere la existencia disponible.
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Carrito_ModificarCantidad
    @IDCarrito BIGINT,
    @IDVariante INT,
    @NuevaCantidad INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @NuevaCantidad IS NULL OR @NuevaCantidad < 0
    BEGIN
        THROW 50001, N'La cantidad no puede ser negativa.', 1;
    END

    -- Si es 0, se elimina
    IF @NuevaCantidad = 0
    BEGIN
        DELETE FROM dbo.CarritoDetalle 
        WHERE IDCarrito = @IDCarrito AND IDVariante = @IDVariante;

        UPDATE dbo.Carrito 
        SET FechaUltimaActividad = SYSUTCDATETIME() 
        WHERE IDCarrito = @IDCarrito;

        EXEC dbo.SP_Carrito_ObtenerDetalle @IDCarrito = @IDCarrito;
        RETURN;
    END

    -- Consultar existencia disponible
    DECLARE @IDAlmacen INT;
    SELECT TOP 1 @IDAlmacen = IDAlmacen FROM dbo.Almacen WHERE Codigo = 'PRINCIPAL';

    DECLARE @ExistenciaDisponible INT = 0;
    SELECT @ExistenciaDisponible = ISNULL(Existencia, 0) - ISNULL(CantidadReservada, 0)
    FROM dbo.Inventario
    WHERE IDVariante = @IDVariante AND IDAlmacen = @IDAlmacen;

    IF @NuevaCantidad > @ExistenciaDisponible
    BEGIN
        THROW 50305, N'No se puede agregar más cantidad que la existencia disponible en el inventario.', 1;
    END

    IF @NuevaCantidad > 99
    BEGIN
        THROW 50001, N'La cantidad máxima permitida por variante en el carrito es de 99 unidades.', 1;
    END

    BEGIN TRANSACTION;
    BEGIN TRY
        UPDATE dbo.CarritoDetalle
        SET Cantidad = @NuevaCantidad
        WHERE IDCarrito = @IDCarrito AND IDVariante = @IDVariante;

        UPDATE dbo.Carrito
        SET FechaUltimaActividad = SYSUTCDATETIME()
        WHERE IDCarrito = @IDCarrito;

        COMMIT TRANSACTION;

        EXEC dbo.SP_Carrito_ObtenerDetalle @IDCarrito = @IDCarrito;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

/* =========================================================================
   5. SP_Carrito_EliminarItem
   Elimina una variante específica del carrito.
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Carrito_EliminarItem
    @IDCarrito BIGINT,
    @IDVariante INT
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM dbo.CarritoDetalle
    WHERE IDCarrito = @IDCarrito AND IDVariante = @IDVariante;

    UPDATE dbo.Carrito
    SET FechaUltimaActividad = SYSUTCDATETIME()
    WHERE IDCarrito = @IDCarrito;

    EXEC dbo.SP_Carrito_ObtenerDetalle @IDCarrito = @IDCarrito;
END;
GO

/* =========================================================================
   6. SP_Carrito_Vaciar
   Limpia todos los items del carrito y desasocia cupón.
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Carrito_Vaciar
    @IDCarrito BIGINT
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM dbo.CarritoDetalle WHERE IDCarrito = @IDCarrito;

    UPDATE dbo.Carrito
    SET IDCupon = NULL,
        FechaUltimaActividad = SYSUTCDATETIME()
    WHERE IDCarrito = @IDCarrito;

    EXEC dbo.SP_Carrito_ObtenerDetalle @IDCarrito = @IDCarrito;
END;
GO

/* =========================================================================
   7. SP_Carrito_MigrarInvitadoAUsuario
   Fusiona el carrito de invitado al iniciar sesión un cliente.
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Carrito_MigrarInvitadoAUsuario
    @TokenInvitadoHash CHAR(64),
    @IDUsuario INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @IDCarritoInvitado BIGINT;
    SELECT @IDCarritoInvitado = IDCarrito
    FROM dbo.Carrito
    WHERE TokenInvitadoHash = @TokenInvitadoHash AND Estado = 'ACTIVO';

    IF @IDCarritoInvitado IS NULL
        RETURN;

    DECLARE @IDCarritoUsuario BIGINT;
    SELECT @IDCarritoUsuario = IDCarrito
    FROM dbo.Carrito
    WHERE IDUsuario = @IDUsuario AND Estado = 'ACTIVO';

    BEGIN TRANSACTION;
    BEGIN TRY
        -- Caso A: El usuario no tenía carrito activo -> el carrito de invitado pasa a ser del usuario
        IF @IDCarritoUsuario IS NULL
        BEGIN
            UPDATE dbo.Carrito
            SET IDUsuario = @IDUsuario,
                TokenInvitadoHash = NULL,
                FechaUltimaActividad = SYSUTCDATETIME()
            WHERE IDCarrito = @IDCarritoInvitado;

            SET @IDCarritoUsuario = @IDCarritoInvitado;
        END
        ELSE
        BEGIN
            -- Caso B: El usuario ya tenía un carrito -> fusionar ítems
            -- Insertar o actualizar cantidades sumadas
            MERGE dbo.CarritoDetalle AS Destino
            USING (SELECT IDVariante, Cantidad FROM dbo.CarritoDetalle WHERE IDCarrito = @IDCarritoInvitado) AS Origen
            ON (Destino.IDCarrito = @IDCarritoUsuario AND Destino.IDVariante = Origen.IDVariante)
            WHEN MATCHED THEN
                UPDATE SET Destino.Cantidad = CASE 
                    WHEN (Destino.Cantidad + Origen.Cantidad) > 99 THEN 99 
                    ELSE Destino.Cantidad + Origen.Cantidad 
                END
            WHEN NOT MATCHED THEN
                INSERT (IDCarrito, IDVariante, Cantidad, FechaAgregado)
                VALUES (@IDCarritoUsuario, Origen.IDVariante, Origen.Cantidad, SYSUTCDATETIME());

            -- Desactivar el carrito de invitado huérfano
            UPDATE dbo.Carrito 
            SET Estado = 'CONVERTIDO', 
                FechaUltimaActividad = SYSUTCDATETIME() 
            WHERE IDCarrito = @IDCarritoInvitado;
        END

        COMMIT TRANSACTION;

        SELECT @IDCarritoUsuario AS IDCarrito;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

/* =========================================================================
   8. SP_Cupon_AplicarACarrito
   Valida y asocia un cupón de descuento a un carrito.
   -- Criterios de validación:
   - Solo un cupón por pedido/carrito.
   - Cupón vencido o agotado se rechaza con mensaje específico.
   - No cumplir mínimo de compra se rechaza con mensaje específico.
   - Límite de usos respetado.
   - Descuento nunca deja el total por debajo de cero.
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Cupon_AplicarACarrito
    @IDCarrito BIGINT,
    @Codigo VARCHAR(50),
    @IDUsuario INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @Codigo IS NULL OR LEN(LTRIM(RTRIM(@Codigo))) = 0
    BEGIN
        THROW 50501, N'Debe ingresar un código de cupón válido.', 1;
    END

    DECLARE @IDCupon INT;
    DECLARE @TipoDescuento VARCHAR(15);
    DECLARE @ValorDescuento DECIMAL(12,2);
    DECLARE @Alcance VARCHAR(15);
    DECLARE @IDCategoria INT;
    DECLARE @MontoMinimoCompra DECIMAL(12,2);
    DECLARE @LimiteUsosTotal INT;
    DECLARE @UsosActuales INT;
    DECLARE @LimiteUsosPorCliente INT;
    DECLARE @FechaInicio DATETIME2(3);
    DECLARE @FechaFin DATETIME2(3);
    DECLARE @EstaActivo BIT;

    SELECT 
        @IDCupon = IDCupon,
        @TipoDescuento = TipoDescuento,
        @ValorDescuento = ValorDescuento,
        @Alcance = Alcance,
        @IDCategoria = IDCategoria,
        @MontoMinimoCompra = MontoMinimoCompra,
        @LimiteUsosTotal = LimiteUsosTotal,
        @UsosActuales = UsosActuales,
        @LimiteUsosPorCliente = LimiteUsosPorCliente,
        @FechaInicio = FechaInicio,
        @FechaFin = FechaFin,
        @EstaActivo = EstaActivo
    FROM dbo.Cupon
    WHERE Codigo = LTRIM(RTRIM(@Codigo));

    IF @IDCupon IS NULL OR @EstaActivo = 0
    BEGIN
        THROW 50501, N'El cupón ingresado no existe o no se encuentra activo.', 1;
    END

    -- Validación de vigencia
    DECLARE @Ahora DATETIME2(3) = SYSUTCDATETIME();
    IF @Ahora < @FechaInicio
    BEGIN
        THROW 50502, N'El cupón aún no se encuentra vigente.', 1;
    END
    IF @Ahora > @FechaFin
    BEGIN
        THROW 50502, N'El cupón ha vencido.', 1;
    END

    -- Validación de límite global de usos
    IF @LimiteUsosTotal IS NOT NULL AND @UsosActuales >= @LimiteUsosTotal
    BEGIN
        THROW 50503, N'El cupón ha alcanzado el límite máximo de usos disponibles.', 1;
    END

    -- Validación de monto mínimo de compra en el carrito
    DECLARE @SubtotalAplicable DECIMAL(12,2) = 0;
    IF @Alcance = 'CARRITO'
    BEGIN
        SELECT @SubtotalAplicable = ISNULL(SUM(v.Precio * d.Cantidad), 0)
        FROM dbo.CarritoDetalle d
        INNER JOIN dbo.VarianteProducto v ON d.IDVariante = v.IDVariante
        WHERE d.IDCarrito = @IDCarrito;
    END
    ELSE IF @Alcance = 'CATEGORIA'
    BEGIN
        SELECT @SubtotalAplicable = ISNULL(SUM(v.Precio * d.Cantidad), 0)
        FROM dbo.CarritoDetalle d
        INNER JOIN dbo.VarianteProducto v ON d.IDVariante = v.IDVariante
        INNER JOIN dbo.Producto p ON v.IDProducto = p.IDProducto
        WHERE d.IDCarrito = @IDCarrito AND p.IDCategoria = @IDCategoria;

        IF @SubtotalAplicable = 0
        BEGIN
            THROW 50505, N'El cupón solo aplica para productos de una categoría específica que no está presente en su carrito.', 1;
        END
    END

    IF @SubtotalAplicable < @MontoMinimoCompra
    BEGIN
        DECLARE @MsgMinimo NVARCHAR(200) = CONCAT(N'El monto mínimo de compra para aplicar este cupón es de Q', FORMAT(@MontoMinimoCompra, 'N2'));
        THROW 50505, @MsgMinimo, 1;
    END

    -- Asociar cupón al carrito
    UPDATE dbo.Carrito
    SET IDCupon = @IDCupon,
        FechaUltimaActividad = SYSUTCDATETIME()
    WHERE IDCarrito = @IDCarrito;

    EXEC dbo.SP_Carrito_ObtenerDetalle @IDCarrito = @IDCarrito;
END;
GO

/* =========================================================================
   9. SP_Cupon_RemoverDeCarrito
   Desasocia el cupón activo de un carrito.
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Cupon_RemoverDeCarrito
    @IDCarrito BIGINT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.Carrito
    SET IDCupon = NULL,
        FechaUltimaActividad = SYSUTCDATETIME()
    WHERE IDCarrito = @IDCarrito;

    EXEC dbo.SP_Carrito_ObtenerDetalle @IDCarrito = @IDCarrito;
END;
GO

/* =========================================================================
   10. SP_Cupon_ListarPaginado
   CRUD Administrativo de Cupones .
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Cupon_ListarPaginado
    @Pagina INT = 1,
    @Limite INT = 20,
    @Busqueda NVARCHAR(100) = NULL,
    @EstaActivo BIT = NULL,
    @TotalRegistros INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    SET @Pagina = ISNULL(@Pagina, 1);
    SET @Limite = ISNULL(@Limite, 20);
    IF @Pagina < 1 SET @Pagina = 1;
    IF @Limite < 1 SET @Limite = 20;

    DECLARE @Offset INT = (@Pagina - 1) * @Limite;

    SELECT @TotalRegistros = COUNT(1)
    FROM dbo.Cupon c
    WHERE (@EstaActivo IS NULL OR c.EstaActivo = @EstaActivo)
      AND (@Busqueda IS NULL OR (
            c.Codigo LIKE '%' + @Busqueda + '%'
            OR c.Descripcion LIKE '%' + @Busqueda + '%'
          ));

    SELECT 
        c.IDCupon,
        c.Codigo,
        c.Descripcion,
        c.TipoDescuento,
        c.ValorDescuento,
        c.Alcance,
        c.IDCategoria,
        cat.Nombre AS CategoriaNombre,
        c.MontoMinimoCompra,
        c.DescuentoMaximo,
        c.LimiteUsosTotal,
        c.UsosActuales,
        c.LimiteUsosPorCliente,
        c.FechaInicio,
        c.FechaFin,
        c.EstaActivo,
        c.FechaCreacion
    FROM dbo.Cupon c
    LEFT JOIN dbo.Categoria cat ON c.IDCategoria = cat.IDCategoria
    WHERE (@EstaActivo IS NULL OR c.EstaActivo = @EstaActivo)
      AND (@Busqueda IS NULL OR (
            c.Codigo LIKE '%' + @Busqueda + '%'
            OR c.Descripcion LIKE '%' + @Busqueda + '%'
          ))
    ORDER BY c.FechaCreacion DESC
    OFFSET @Offset ROWS
    FETCH NEXT @Limite ROWS ONLY;
END;
GO

/* =========================================================================
   11. SP_Cupon_Crear
   Crea un nuevo cupón con validaciones completas y registro en bitácora.
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Cupon_Crear
    @Codigo VARCHAR(50),
    @Descripcion NVARCHAR(250) = NULL,
    @TipoDescuento VARCHAR(15),
    @ValorDescuento DECIMAL(12,2),
    @Alcance VARCHAR(15) = 'CARRITO',
    @IDCategoria INT = NULL,
    @MontoMinimoCompra DECIMAL(12,2) = 0,
    @DescuentoMaximo DECIMAL(12,2) = NULL,
    @LimiteUsosTotal INT = NULL,
    @LimiteUsosPorCliente INT = 1,
    @FechaInicio DATETIME2(3),
    @FechaFin DATETIME2(3),
    @IDUsuarioAdmin INT,
    @DireccionIP VARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @Codigo = UPPER(LTRIM(RTRIM(@Codigo)));

    IF EXISTS (SELECT 1 FROM dbo.Cupon WHERE Codigo = @Codigo)
    BEGIN
        THROW 50509, N'Ya existe un cupón registrado con ese código.', 1;
    END

    IF @FechaFin <= @FechaInicio
    BEGIN
        THROW 50001, N'La fecha de finalización debe ser posterior a la fecha de inicio.', 1;
    END

    IF @TipoDescuento = 'PORCENTAJE' AND (@ValorDescuento <= 0 OR @ValorDescuento > 100)
    BEGIN
        THROW 50001, N'El porcentaje de descuento debe estar entre 0.01 y 100.', 1;
    END

    IF @Alcance = 'CATEGORIA' AND @IDCategoria IS NULL
    BEGIN
        THROW 50001, N'Para cupones con alcance de categoría, debe especificar la categoría.', 1;
    END

    BEGIN TRANSACTION;
    BEGIN TRY
        DECLARE @NuevoIDCupon INT;

        INSERT INTO dbo.Cupon (
            Codigo,
            Descripcion,
            TipoDescuento,
            ValorDescuento,
            Alcance,
            IDCategoria,
            MontoMinimoCompra,
            DescuentoMaximo,
            LimiteUsosTotal,
            LimiteUsosPorCliente,
            FechaInicio,
            FechaFin,
            CreadoPor,
            FechaCreacion
        )
        VALUES (
            @Codigo,
            @Descripcion,
            @TipoDescuento,
            @ValorDescuento,
            @Alcance,
            CASE WHEN @Alcance = 'CATEGORIA' THEN @IDCategoria ELSE NULL END,
            ISNULL(@MontoMinimoCompra, 0),
            @DescuentoMaximo,
            @LimiteUsosTotal,
            ISNULL(@LimiteUsosPorCliente, 1),
            @FechaInicio,
            @FechaFin,
            @IDUsuarioAdmin,
            SYSUTCDATETIME()
        );

        SET @NuevoIDCupon = SCOPE_IDENTITY();

        -- Bitácora inmutable
        INSERT INTO dbo.RegistroBitacora (
            FechaEvento,
            IDUsuario,
            Modulo,
            Entidad,
            IDRegistro,
            Accion,
            ValorNuevo,
            DireccionIP
        )
        VALUES (
            SYSUTCDATETIME(),
            @IDUsuarioAdmin,
            'cupones',
            'Cupon',
            CAST(@NuevoIDCupon AS NVARCHAR(100)),
            'CREAR',
            (SELECT @Codigo AS codigo, @TipoDescuento AS tipoDescuento, @ValorDescuento AS valorDescuento FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
            @DireccionIP
        );

        COMMIT TRANSACTION;

        SELECT @NuevoIDCupon AS IDCupon;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
