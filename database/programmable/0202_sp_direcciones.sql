/*
    ShopCart - 0202 Procedimientos Almacenados: Direcciones de Clientes (RF-01, RF-06)
    Motor: Microsoft SQL Server 2019+
    Convención: SP_Modulo_Proceso, PascalCase, THROW 50xxx, parámetros tipados.
    Seguridad: Validación estricta anti-IDOR en todas las operaciones.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* =========================================================================
   1. SP_Direccion_Crear
   Crea una nueva dirección para el usuario autenticado.
   Si es la primera dirección activa o se especifica EsPredeterminada = 1,
   se desmarca la anterior dirección predeterminada.
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Direccion_Crear
    @IDUsuario INT,
    @Alias NVARCHAR(50) = NULL,
    @Destinatario NVARCHAR(150),
    @Telefono NVARCHAR(30),
    @Linea1 NVARCHAR(200),
    @Linea2 NVARCHAR(200) = NULL,
    @Departamento NVARCHAR(100),
    @Municipio NVARCHAR(100),
    @CodigoPostal NVARCHAR(20) = NULL,
    @Referencia NVARCHAR(250) = NULL,
    @EsPredeterminada BIT = 0
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    -- Validaciones de entrada
    IF @IDUsuario IS NULL OR @IDUsuario <= 0
        THROW 50001, N'ID de usuario inválido.', 1;

    IF @Destinatario IS NULL OR LTRIM(RTRIM(@Destinatario)) = ''
        THROW 50001, N'El nombre del destinatario es obligatorio.', 1;

    IF @Telefono IS NULL OR LTRIM(RTRIM(@Telefono)) = ''
        THROW 50001, N'El teléfono de contacto es obligatorio.', 1;

    IF @Linea1 IS NULL OR LTRIM(RTRIM(@Linea1)) = ''
        THROW 50001, N'La dirección (Línea 1) es obligatoria.', 1;

    IF @Departamento IS NULL OR LTRIM(RTRIM(@Departamento)) = ''
        THROW 50001, N'El departamento es obligatorio.', 1;

    IF @Municipio IS NULL OR LTRIM(RTRIM(@Municipio)) = ''
        THROW 50001, N'El municipio es obligatorio.', 1;

    -- Verificar que el usuario exista y esté activo
    IF NOT EXISTS (SELECT 1 FROM dbo.Usuario WHERE IDUsuario = @IDUsuario AND EstaActivo = 1)
        THROW 50404, N'El usuario no existe o se encuentra inactivo.', 1;

    DECLARE @NuevaIDDireccion INT;

    BEGIN TRANSACTION;

        -- Si no tiene ninguna dirección activa previa, esta pasa a ser predeterminada automáticamente
        IF NOT EXISTS (SELECT 1 FROM dbo.Direccion WHERE IDUsuario = @IDUsuario AND EstaActiva = 1)
        BEGIN
            SET @EsPredeterminada = 1;
        END
        ELSE IF @EsPredeterminada = 1
        BEGIN
            -- Desmarcar dirección predeterminada anterior
            UPDATE dbo.Direccion
            SET EsPredeterminada = 0
            WHERE IDUsuario = @IDUsuario AND EsPredeterminada = 1;
        END

        INSERT INTO dbo.Direccion (
            IDUsuario,
            Alias,
            Destinatario,
            Telefono,
            Linea1,
            Linea2,
            Departamento,
            Municipio,
            CodigoPostal,
            Referencia,
            EsPredeterminada,
            EstaActiva,
            FechaCreacion
        )
        VALUES (
            @IDUsuario,
            NULLIF(LTRIM(RTRIM(@Alias)), ''),
            LTRIM(RTRIM(@Destinatario)),
            LTRIM(RTRIM(@Telefono)),
            LTRIM(RTRIM(@Linea1)),
            NULLIF(LTRIM(RTRIM(@Linea2)), ''),
            LTRIM(RTRIM(@Departamento)),
            LTRIM(RTRIM(@Municipio)),
            NULLIF(LTRIM(RTRIM(@CodigoPostal)), ''),
            NULLIF(LTRIM(RTRIM(@Referencia)), ''),
            @EsPredeterminada,
            1,
            SYSUTCDATETIME()
        );

        SET @NuevaIDDireccion = SCOPE_IDENTITY();

    COMMIT TRANSACTION;

    SELECT 
        IDDireccion,
        IDUsuario,
        Alias,
        Destinatario,
        Telefono,
        Linea1,
        Linea2,
        Departamento,
        Municipio,
        CodigoPostal,
        Referencia,
        EsPredeterminada,
        EstaActiva,
        FechaCreacion
    FROM dbo.Direccion
    WHERE IDDireccion = @NuevaIDDireccion;
END;
GO

/* =========================================================================
   2. SP_Direccion_ListarPropias
   Retorna todas las direcciones activas del usuario autenticado (RF-01).
   Ordenadas con la predeterminada al inicio y luego por fecha descendente.
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Direccion_ListarPropias
    @IDUsuario INT
AS
BEGIN
    SET NOCOUNT ON;

    IF @IDUsuario IS NULL OR @IDUsuario <= 0
        THROW 50001, N'ID de usuario inválido.', 1;

    SELECT 
        IDDireccion,
        IDUsuario,
        Alias,
        Destinatario,
        Telefono,
        Linea1,
        Linea2,
        Departamento,
        Municipio,
        CodigoPostal,
        Referencia,
        EsPredeterminada,
        EstaActiva,
        FechaCreacion
    FROM dbo.Direccion
    WHERE IDUsuario = @IDUsuario AND EstaActiva = 1
    ORDER BY EsPredeterminada DESC, FechaCreacion DESC;
END;
GO

/* =========================================================================
   3. SP_Direccion_ObtenerPorID
   Obtiene una dirección por ID garantizando que pertenezca al usuario (Anti-IDOR).
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Direccion_ObtenerPorID
    @IDDireccion INT,
    @IDUsuario INT
AS
BEGIN
    SET NOCOUNT ON;

    IF @IDDireccion IS NULL OR @IDDireccion <= 0
        THROW 50001, N'ID de dirección inválido.', 1;

    IF @IDUsuario IS NULL OR @IDUsuario <= 0
        THROW 50001, N'ID de usuario inválido.', 1;

    -- 1. Verificar si existe la dirección
    IF NOT EXISTS (SELECT 1 FROM dbo.Direccion WHERE IDDireccion = @IDDireccion AND EstaActiva = 1)
        THROW 50404, N'La dirección solicitada no existe.', 1;

    -- 2. Validación estricta anti-IDOR: Si existe pero pertenece a otro cliente
    IF NOT EXISTS (SELECT 1 FROM dbo.Direccion WHERE IDDireccion = @IDDireccion AND IDUsuario = @IDUsuario AND EstaActiva = 1)
        THROW 50403, N'Acceso denegado: No tienes permiso para consultar esta dirección.', 1;

    SELECT 
        IDDireccion,
        IDUsuario,
        Alias,
        Destinatario,
        Telefono,
        Linea1,
        Linea2,
        Departamento,
        Municipio,
        CodigoPostal,
        Referencia,
        EsPredeterminada,
        EstaActiva,
        FechaCreacion
    FROM dbo.Direccion
    WHERE IDDireccion = @IDDireccion AND IDUsuario = @IDUsuario AND EstaActiva = 1;
END;
GO

/* =========================================================================
   4. SP_Direccion_Actualizar
   Actualiza una dirección existente validando pertenencia (Anti-IDOR).
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Direccion_Actualizar
    @IDDireccion INT,
    @IDUsuario INT,
    @Alias NVARCHAR(50) = NULL,
    @Destinatario NVARCHAR(150),
    @Telefono NVARCHAR(30),
    @Linea1 NVARCHAR(200),
    @Linea2 NVARCHAR(200) = NULL,
    @Departamento NVARCHAR(100),
    @Municipio NVARCHAR(100),
    @CodigoPostal NVARCHAR(20) = NULL,
    @Referencia NVARCHAR(250) = NULL,
    @EsPredeterminada BIT = 0
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    -- Validaciones de entrada
    IF @IDDireccion IS NULL OR @IDDireccion <= 0
        THROW 50001, N'ID de dirección inválido.', 1;

    IF @IDUsuario IS NULL OR @IDUsuario <= 0
        THROW 50001, N'ID de usuario inválido.', 1;

    IF @Destinatario IS NULL OR LTRIM(RTRIM(@Destinatario)) = ''
        THROW 50001, N'El nombre del destinatario es obligatorio.', 1;

    IF @Telefono IS NULL OR LTRIM(RTRIM(@Telefono)) = ''
        THROW 50001, N'El teléfono de contacto es obligatorio.', 1;

    IF @Linea1 IS NULL OR LTRIM(RTRIM(@Linea1)) = ''
        THROW 50001, N'La dirección (Línea 1) es obligatoria.', 1;

    IF @Departamento IS NULL OR LTRIM(RTRIM(@Departamento)) = ''
        THROW 50001, N'El departamento es obligatorio.', 1;

    IF @Municipio IS NULL OR LTRIM(RTRIM(@Municipio)) = ''
        THROW 50001, N'El municipio es obligatorio.', 1;

    -- 1. Verificar si existe la dirección
    IF NOT EXISTS (SELECT 1 FROM dbo.Direccion WHERE IDDireccion = @IDDireccion AND EstaActiva = 1)
        THROW 50404, N'La dirección que intentas actualizar no existe.', 1;

    -- 2. Validación estricta anti-IDOR
    IF NOT EXISTS (SELECT 1 FROM dbo.Direccion WHERE IDDireccion = @IDDireccion AND IDUsuario = @IDUsuario AND EstaActiva = 1)
        THROW 50403, N'Acceso denegado: No tienes permiso para modificar esta dirección.', 1;

    BEGIN TRANSACTION;

        IF @EsPredeterminada = 1
        BEGIN
            UPDATE dbo.Direccion
            SET EsPredeterminada = 0
            WHERE IDUsuario = @IDUsuario AND EsPredeterminada = 1 AND IDDireccion <> @IDDireccion;
        END;

        UPDATE dbo.Direccion
        SET 
            Alias = NULLIF(LTRIM(RTRIM(@Alias)), ''),
            Destinatario = LTRIM(RTRIM(@Destinatario)),
            Telefono = LTRIM(RTRIM(@Telefono)),
            Linea1 = LTRIM(RTRIM(@Linea1)),
            Linea2 = NULLIF(LTRIM(RTRIM(@Linea2)), ''),
            Departamento = LTRIM(RTRIM(@Departamento)),
            Municipio = LTRIM(RTRIM(@Municipio)),
            CodigoPostal = NULLIF(LTRIM(RTRIM(@CodigoPostal)), ''),
            Referencia = NULLIF(LTRIM(RTRIM(@Referencia)), ''),
            EsPredeterminada = CASE WHEN @EsPredeterminada = 1 THEN 1 ELSE EsPredeterminada END
        WHERE IDDireccion = @IDDireccion AND IDUsuario = @IDUsuario;

    COMMIT TRANSACTION;

    SELECT 
        IDDireccion,
        IDUsuario,
        Alias,
        Destinatario,
        Telefono,
        Linea1,
        Linea2,
        Departamento,
        Municipio,
        CodigoPostal,
        Referencia,
        EsPredeterminada,
        EstaActiva,
        FechaCreacion
    FROM dbo.Direccion
    WHERE IDDireccion = @IDDireccion;
END;
GO

/* =========================================================================
   5. SP_Direccion_Eliminar
   Desactiva lógicamente una dirección propia (Soft Delete).
   Si era la predeterminada o no queda ninguna predeterminada, promueve la más reciente.
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Direccion_Eliminar
    @IDDireccion INT,
    @IDUsuario INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @IDDireccion IS NULL OR @IDDireccion <= 0
        THROW 50001, N'ID de dirección inválido.', 1;

    IF @IDUsuario IS NULL OR @IDUsuario <= 0
        THROW 50001, N'ID de usuario inválido.', 1;

    -- 1. Verificar si existe
    IF NOT EXISTS (SELECT 1 FROM dbo.Direccion WHERE IDDireccion = @IDDireccion AND EstaActiva = 1)
        THROW 50404, N'La dirección que intentas eliminar no existe.', 1;

    -- 2. Validación estricta anti-IDOR
    IF NOT EXISTS (SELECT 1 FROM dbo.Direccion WHERE IDDireccion = @IDDireccion AND IDUsuario = @IDUsuario AND EstaActiva = 1)
        THROW 50403, N'Acceso denegado: No tienes permiso para eliminar esta dirección.', 1;

    DECLARE @EraPredeterminada BIT;
    SELECT @EraPredeterminada = EsPredeterminada 
    FROM dbo.Direccion 
    WHERE IDDireccion = @IDDireccion AND IDUsuario = @IDUsuario;

    BEGIN TRANSACTION;

        -- Desactivar lógicamente
        UPDATE dbo.Direccion
        SET EstaActiva = 0, EsPredeterminada = 0
        WHERE IDDireccion = @IDDireccion AND IDUsuario = @IDUsuario;

        -- Si era la predeterminada o no queda ninguna predeterminada activa, promover la más reciente
        IF @EraPredeterminada = 1 OR NOT EXISTS (SELECT 1 FROM dbo.Direccion WHERE IDUsuario = @IDUsuario AND EstaActiva = 1 AND EsPredeterminada = 1)
        BEGIN
            DECLARE @SiguienteIDDireccion INT;
            SELECT TOP 1 @SiguienteIDDireccion = IDDireccion
            FROM dbo.Direccion
            WHERE IDUsuario = @IDUsuario AND EstaActiva = 1
            ORDER BY FechaCreacion DESC;

            IF @SiguienteIDDireccion IS NOT NULL
            BEGIN
                UPDATE dbo.Direccion
                SET EsPredeterminada = 1
                WHERE IDDireccion = @SiguienteIDDireccion;
            END;
        END;

    COMMIT TRANSACTION;

    SELECT @IDDireccion AS IDDireccionEliminada;
END;
GO

/* =========================================================================
   6. SP_Direccion_EstablecerPredeterminada
   Establece una dirección como predeterminada desmarcando la anterior.
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Direccion_EstablecerPredeterminada
    @IDDireccion INT,
    @IDUsuario INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @IDDireccion IS NULL OR @IDDireccion <= 0
        THROW 50001, N'ID de dirección inválido.', 1;

    IF @IDUsuario IS NULL OR @IDUsuario <= 0
        THROW 50001, N'ID de usuario inválido.', 1;

    -- 1. Verificar si existe
    IF NOT EXISTS (SELECT 1 FROM dbo.Direccion WHERE IDDireccion = @IDDireccion AND EstaActiva = 1)
        THROW 50404, N'La dirección especificada no existe.', 1;

    -- 2. Validación estricta anti-IDOR
    IF NOT EXISTS (SELECT 1 FROM dbo.Direccion WHERE IDDireccion = @IDDireccion AND IDUsuario = @IDUsuario AND EstaActiva = 1)
        THROW 50403, N'Acceso denegado: No tienes permiso para modificar esta dirección.', 1;

    BEGIN TRANSACTION;

        -- Desmarcar otras predeterminadas del usuario
        UPDATE dbo.Direccion
        SET EsPredeterminada = 0
        WHERE IDUsuario = @IDUsuario AND EsPredeterminada = 1;

        -- Marcar la seleccionada
        UPDATE dbo.Direccion
        SET EsPredeterminada = 1
        WHERE IDDireccion = @IDDireccion AND IDUsuario = @IDUsuario;

    COMMIT TRANSACTION;

    SELECT 
        IDDireccion,
        IDUsuario,
        Alias,
        Destinatario,
        Telefono,
        Linea1,
        Linea2,
        Departamento,
        Municipio,
        CodigoPostal,
        Referencia,
        EsPredeterminada,
        EstaActiva,
        FechaCreacion
    FROM dbo.Direccion
    WHERE IDDireccion = @IDDireccion;
END;
GO
