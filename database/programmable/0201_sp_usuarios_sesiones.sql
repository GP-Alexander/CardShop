/*
    ShopCart - 0201 Procedimientos Almacenados: Usuarios y Sesiones (RF-01, RF-09)
    Motor: Microsoft SQL Server 2019+
    Convención: SP_Modulo_Proceso, PascalCase, THROW 50xxx, parámetros tipados.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* =========================================================================
   1. SP_Usuario_RegistrarCliente
   Registra un cliente nuevo asignándole automáticamente el rol 'Cliente'.
   Registra el evento en la Bitácora de Auditoría (RF-09).
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Usuario_RegistrarCliente
    @Nombres NVARCHAR(100),
    @Apellidos NVARCHAR(100),
    @Correo NVARCHAR(254),
    @Telefono NVARCHAR(30) = NULL,
    @HashContrasena NVARCHAR(255),
    @DireccionIP VARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    -- Validaciones de entrada (50001)
    IF @Nombres IS NULL OR LTRIM(RTRIM(@Nombres)) = ''
        THROW 50001, N'El nombre del cliente es obligatorio.', 1;

    IF @Apellidos IS NULL OR LTRIM(RTRIM(@Apellidos)) = ''
        THROW 50001, N'El apellido del cliente es obligatorio.', 1;

    IF @Correo IS NULL OR LTRIM(RTRIM(@Correo)) = '' OR @Correo NOT LIKE N'_%@_%._%'
        THROW 50001, N'El correo electrónico no tiene un formato válido.', 1;

    IF @HashContrasena IS NULL OR LTRIM(RTRIM(@HashContrasena)) = ''
        THROW 50001, N'El hash de contraseña es obligatorio.', 1;

    -- Normalizar correo a minúsculas
    SET @Correo = LOWER(LTRIM(RTRIM(@Correo)));

    -- Verificar duplicidad de correo (50204 -> HTTP 409)
    IF EXISTS (SELECT 1 FROM dbo.Usuario WHERE Correo = @Correo)
        THROW 50204, N'El correo electrónico ya se encuentra registrado en el sistema.', 1;

    -- Obtener ID del rol Cliente
    DECLARE @IDRolCliente INT;
    SELECT @IDRolCliente = IDRol FROM dbo.Rol WHERE Nombre = N'Cliente' AND EstaActivo = 1;

    IF @IDRolCliente IS NULL
        THROW 50200, N'Error de configuración: El rol Cliente no está disponible.', 1;

    DECLARE @NuevoIDUsuario INT;
    DECLARE @ValorNuevoJson NVARCHAR(MAX);

    BEGIN TRANSACTION;

        INSERT INTO dbo.Usuario (
            IDRol,
            Nombres,
            Apellidos,
            Correo,
            Telefono,
            HashContrasena,
            EstaActivo,
            FechaCreacion,
            FechaActualizacion
        )
        VALUES (
            @IDRolCliente,
            LTRIM(RTRIM(@Nombres)),
            LTRIM(RTRIM(@Apellidos)),
            @Correo,
            NULLIF(LTRIM(RTRIM(@Telefono)), ''),
            @HashContrasena,
            1,
            SYSUTCDATETIME(),
            SYSUTCDATETIME()
        );

        SET @NuevoIDUsuario = SCOPE_IDENTITY();

        -- Preparar JSON para auditoría en bitácora (RF-09)
        SET @ValorNuevoJson = (
            SELECT 
                @NuevoIDUsuario AS idUsuario,
                @Correo AS correo,
                N'Cliente' AS rol,
                1 AS estaActivo
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
            @NuevoIDUsuario,
            'usuarios',
            'Usuario',
            CAST(@NuevoIDUsuario AS NVARCHAR(100)),
            'registro_cliente',
            NULL,
            @ValorNuevoJson,
            @DireccionIP
        );

    COMMIT TRANSACTION;

    -- Retornar datos del usuario creado
    SELECT 
        u.IDUsuario,
        u.Nombres,
        u.Apellidos,
        u.Correo,
        u.Telefono,
        r.Nombre AS NombreRol,
        u.EstaActivo,
        u.FechaCreacion
    FROM dbo.Usuario u
    JOIN dbo.Rol r ON u.IDRol = r.IDRol
    WHERE u.IDUsuario = @NuevoIDUsuario;
END;
GO

/* =========================================================================
   2. SP_Usuario_ObtenerPorCorreo
   Obtiene los datos del usuario y sus permisos por correo para autenticación.
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Usuario_ObtenerPorCorreo
    @Correo NVARCHAR(254)
AS
BEGIN
    SET NOCOUNT ON;

    IF @Correo IS NULL OR LTRIM(RTRIM(@Correo)) = ''
        THROW 50001, N'El correo es requerido para la búsqueda.', 1;

    SET @Correo = LOWER(LTRIM(RTRIM(@Correo)));

    -- 1er Resultset: Información de usuario
    SELECT 
        u.IDUsuario,
        u.IDRol,
        r.Nombre AS NombreRol,
        u.Nombres,
        u.Apellidos,
        u.Correo,
        u.Telefono,
        u.HashContrasena,
        u.EstaActivo,
        u.FechaCreacion,
        u.UltimoAcceso
    FROM dbo.Usuario u
    JOIN dbo.Rol r ON u.IDRol = r.IDRol
    WHERE u.Correo = @Correo;

    -- 2do Resultset: Permisos asignados al rol del usuario
    SELECT p.Codigo
    FROM dbo.Usuario u
    JOIN dbo.RolPermiso rp ON u.IDRol = rp.IDRol
    JOIN dbo.Permiso p ON rp.IDPermiso = p.IDPermiso
    WHERE u.Correo = @Correo AND u.EstaActivo = 1;
END;
GO

/* =========================================================================
   3. SP_Usuario_ObtenerPorID
   Obtiene los datos del usuario por ID y sus permisos (para endpoint /api/auth/yo).
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Usuario_ObtenerPorID
    @IDUsuario INT
AS
BEGIN
    SET NOCOUNT ON;

    IF @IDUsuario IS NULL OR @IDUsuario <= 0
        THROW 50001, N'ID de usuario inválido.', 1;

    -- 1er Resultset: Datos de usuario
    SELECT 
        u.IDUsuario,
        u.IDRol,
        r.Nombre AS NombreRol,
        u.Nombres,
        u.Apellidos,
        u.Correo,
        u.Telefono,
        u.EstaActivo,
        u.FechaCreacion,
        u.UltimoAcceso
    FROM dbo.Usuario u
    JOIN dbo.Rol r ON u.IDRol = r.IDRol
    WHERE u.IDUsuario = @IDUsuario;

    -- 2do Resultset: Permisos
    SELECT p.Codigo
    FROM dbo.Usuario u
    JOIN dbo.RolPermiso rp ON u.IDRol = rp.IDRol
    JOIN dbo.Permiso p ON rp.IDPermiso = p.IDPermiso
    WHERE u.IDUsuario = @IDUsuario AND u.EstaActivo = 1;
END;
GO

/* =========================================================================
   4. SP_TokenSesion_Crear
   Registra el hash SHA-256 de un refresh token nuevo asignado a una familia.
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_TokenSesion_Crear
    @IDUsuario INT,
    @IDFamilia UNIQUEIDENTIFIER,
    @HashToken CHAR(64),
    @FechaExpiracion DATETIME2(3),
    @DireccionIP VARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @IDUsuario IS NULL OR @IDFamilia IS NULL OR @HashToken IS NULL OR @FechaExpiracion IS NULL
        THROW 50001, N'Parámetros obligatorios faltantes para crear la sesión.', 1;

    -- Verificar que el usuario exista y esté activo (RF-01)
    IF NOT EXISTS (SELECT 1 FROM dbo.Usuario WHERE IDUsuario = @IDUsuario AND EstaActivo = 1)
        THROW 50203, N'El usuario no existe o se encuentra inactivo.', 1;

    BEGIN TRANSACTION;

        INSERT INTO dbo.TokenSesion (
            IDUsuario,
            IDFamilia,
            HashToken,
            FechaCreacion,
            FechaExpiracion,
            DireccionIP
        )
        VALUES (
            @IDUsuario,
            @IDFamilia,
            @HashToken,
            SYSUTCDATETIME(),
            @FechaExpiracion,
            @DireccionIP
        );

        DECLARE @IDTokenCreado BIGINT = SCOPE_IDENTITY();

        -- Actualizar último acceso del usuario
        UPDATE dbo.Usuario
        SET UltimoAcceso = SYSUTCDATETIME()
        WHERE IDUsuario = @IDUsuario;

    COMMIT TRANSACTION;

    SELECT @IDTokenCreado AS IDTokenSesion;
END;
GO

/* =========================================================================
   5. SP_TokenSesion_Rotar
   Rota un refresh token consumiendo el actual y emitiendo uno nuevo.
   SEGURIDAD CRÍTICA: Si el token ya fue usado o revocado (reuso malicioso),
   revoca inmediatamente TODA la familia de sesiones (RF-01).
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_TokenSesion_Rotar
    @HashTokenActual CHAR(64),
    @NuevoHashToken CHAR(64),
    @NuevaFechaExpiracion DATETIME2(3),
    @DireccionIP VARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @HashTokenActual IS NULL OR @NuevoHashToken IS NULL OR @NuevaFechaExpiracion IS NULL
        THROW 50001, N'Parámetros obligatorios incompletos para la rotación de sesión.', 1;

    DECLARE @IDTokenSesion BIGINT;
    DECLARE @IDUsuario INT;
    DECLARE @IDFamilia UNIQUEIDENTIFIER;
    DECLARE @FechaExpiracion DATETIME2(3);
    DECLARE @FechaUso DATETIME2(3);
    DECLARE @FechaRevocacion DATETIME2(3);

    -- Buscar el token presentado
    SELECT 
        @IDTokenSesion = IDTokenSesion,
        @IDUsuario = IDUsuario,
        @IDFamilia = IDFamilia,
        @FechaExpiracion = FechaExpiracion,
        @FechaUso = FechaUso,
        @FechaRevocacion = FechaRevocacion
    FROM dbo.TokenSesion
    WHERE HashToken = @HashTokenActual;

    -- Token no existe
    IF @IDTokenSesion IS NULL
        THROW 50201, N'Sesión no encontrada o token inválido.', 1;

    -- DETECCIÓN DE REUSO / BRECHA DE SEGURIDAD (RF-01)
    -- Si ya fue revocado o ya fue usado previamente, revocar TODA la familia de inmediato
    IF @FechaRevocacion IS NOT NULL OR @FechaUso IS NOT NULL
    BEGIN
        UPDATE dbo.TokenSesion
        SET FechaRevocacion = SYSUTCDATETIME()
        WHERE IDFamilia = @IDFamilia AND FechaRevocacion IS NULL;

        -- Registrar alerta en bitácora
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
            'seguridad',
            'TokenSesion',
            CAST(@IDFamilia AS NVARCHAR(100)),
            'reuso_detectado_revocacion_familia',
            NULL,
            N'{"motivo":"Intento de reuso de refresh token rotado. Familia revocada."}',
            @DireccionIP
        );

        THROW 50202, N'Violación de seguridad: intento de reutilización de refresh token. Todas las sesiones han sido revocadas.', 1;
    END;

    -- Token expirado
    IF @FechaExpiracion < SYSUTCDATETIME()
    BEGIN
        UPDATE dbo.TokenSesion
        SET FechaRevocacion = SYSUTCDATETIME()
        WHERE IDTokenSesion = @IDTokenSesion;

        THROW 50201, N'La sesión ha expirado. Debe iniciar sesión nuevamente.', 1;
    END;

    -- Verificar que el usuario continúe activo
    IF NOT EXISTS (SELECT 1 FROM dbo.Usuario WHERE IDUsuario = @IDUsuario AND EstaActivo = 1)
        THROW 50203, N'El usuario asociado a la sesión se encuentra inactivo.', 1;

    DECLARE @NuevoIDToken BIGINT;

    BEGIN TRANSACTION;

        -- 1. Insertar nuevo token en la misma familia
        INSERT INTO dbo.TokenSesion (
            IDUsuario,
            IDFamilia,
            HashToken,
            FechaCreacion,
            FechaExpiracion,
            DireccionIP
        )
        VALUES (
            @IDUsuario,
            @IDFamilia,
            @NuevoHashToken,
            SYSUTCDATETIME(),
            @NuevaFechaExpiracion,
            @DireccionIP
        );

        SET @NuevoIDToken = SCOPE_IDENTITY();

        -- 2. Marcar token anterior como usado y referenciar el reemplazo
        UPDATE dbo.TokenSesion
        SET FechaUso = SYSUTCDATETIME(),
            IDTokenReemplazo = @NuevoIDToken
        WHERE IDTokenSesion = @IDTokenSesion;

        -- 3. Actualizar último acceso del usuario
        UPDATE dbo.Usuario
        SET UltimoAcceso = SYSUTCDATETIME()
        WHERE IDUsuario = @IDUsuario;

    COMMIT TRANSACTION;

    -- Retornar información para que el backend emita el nuevo access token
    SELECT 
        u.IDUsuario,
        u.Correo,
        u.Nombres,
        u.Apellidos,
        r.Nombre AS NombreRol,
        u.EstaActivo,
        @IDFamilia AS IDFamilia,
        @NuevoIDToken AS IDTokenSesion
    FROM dbo.Usuario u
    JOIN dbo.Rol r ON u.IDRol = r.IDRol
    WHERE u.IDUsuario = @IDUsuario;
END;
GO

/* =========================================================================
   6. SP_TokenSesion_Revocar
   Revoca un token específico o la familia completa de tokens (Logout).
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_TokenSesion_Revocar
    @HashToken CHAR(64) = NULL,
    @IDFamilia UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @HashToken IS NULL AND @IDFamilia IS NULL
        THROW 50001, N'Se requiere al menos el hash del token o el identificador de familia para revocar.', 1;

    -- Si se envía el hash, obtener su familia para revocar la cadena completa
    IF @HashToken IS NOT NULL AND @IDFamilia IS NULL
    BEGIN
        SELECT @IDFamilia = IDFamilia
        FROM dbo.TokenSesion
        WHERE HashToken = @HashToken;
    END;

    IF @IDFamilia IS NOT NULL
    BEGIN
        UPDATE dbo.TokenSesion
        SET FechaRevocacion = SYSUTCDATETIME()
        WHERE IDFamilia = @IDFamilia AND FechaRevocacion IS NULL;
    END;

    SELECT @@ROWCOUNT AS TokensRevocados;
END;
GO
