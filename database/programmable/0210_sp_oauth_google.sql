/*
    ShopCart - 0210 Procedimientos Almacenados: Autenticación OAuth Google 
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* =========================================================================
   SP_Usuario_AutenticarOAuthGoogle
   Autentica o registra un usuario autenticado mediante Google OAuth.
   - Si el usuario existe por IdProveedorOAuth o Correo:
       * Si está inactivo, lanza error 50201 (403 Forbidden).
       * Si no tenía IdProveedorOAuth vinculado, vincula el ID de Google.
       * Actualiza FechaActualizacion y UltimoAcceso.
       * Registra evento en Bitácora (login_oauth_google).
   - Si el usuario no existe:
       * Crea un nuevo usuario con rol 'Cliente' y contraseña hash aleatoria.
       * Registra evento en Bitácora (registro_oauth_google).
   - Retorna dos resultsets:
       1) Datos del usuario autenticado (IDUsuario, IDRol, NombreRol, Nombres, Apellidos, Correo, Telefono, EstaActivo, FechaCreacion, UltimoAcceso).
       2) Permisos asignados al rol del usuario.
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Usuario_AutenticarOAuthGoogle
    @Correo NVARCHAR(254),
    @Nombres NVARCHAR(100),
    @Apellidos NVARCHAR(100),
    @IdGoogle NVARCHAR(100),
    @HashContrasena NVARCHAR(255),
    @DireccionIP VARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    -- Validaciones de entrada (50001)
    IF @Correo IS NULL OR LTRIM(RTRIM(@Correo)) = '' OR @Correo NOT LIKE N'_%@_%._%'
        THROW 50001, N'El correo electrónico proporcionado por Google no es válido.', 1;

    IF @IdGoogle IS NULL OR LTRIM(RTRIM(@IdGoogle)) = ''
        THROW 50001, N'El identificador de Google (sub) es obligatorio.', 1;

    IF @Nombres IS NULL OR LTRIM(RTRIM(@Nombres)) = ''
        SET @Nombres = N'Usuario';

    IF @Apellidos IS NULL OR LTRIM(RTRIM(@Apellidos)) = ''
        SET @Apellidos = N'Google';

    SET @Correo = LOWER(LTRIM(RTRIM(@Correo)));
    SET @IdGoogle = LTRIM(RTRIM(@IdGoogle));
    SET @Nombres = LTRIM(RTRIM(@Nombres));
    SET @Apellidos = LTRIM(RTRIM(@Apellidos));

    DECLARE @IDUsuarioExistente INT = NULL;
    DECLARE @EstaActivoExistente BIT = 1;
    DECLARE @IDRolExistente INT = NULL;
    DECLARE @NombreRol NVARCHAR(50) = NULL;
    DECLARE @IDUsuarioFinal INT = NULL;

    BEGIN TRANSACTION;

        -- Buscar por Google Sub primero, luego por Correo
        SELECT TOP 1 
            @IDUsuarioExistente = u.IDUsuario,
            @EstaActivoExistente = u.EstaActivo,
            @IDRolExistente = u.IDRol,
            @NombreRol = r.Nombre
        FROM dbo.Usuario u
        JOIN dbo.Rol r ON u.IDRol = r.IDRol
        WHERE (u.ProveedorOAuth = 'Google' AND u.IdProveedorOAuth = @IdGoogle)
           OR u.Correo = @Correo
        ORDER BY CASE WHEN u.ProveedorOAuth = 'Google' AND u.IdProveedorOAuth = @IdGoogle THEN 0 ELSE 1 END;

        IF @IDUsuarioExistente IS NOT NULL
        BEGIN
            -- Validar si la cuenta está activa (50201 -> HTTP 403)
            IF @EstaActivoExistente = 0
                THROW 50201, N'La cuenta de usuario se encuentra inactiva o deshabilitada.', 1;

            SET @IDUsuarioFinal = @IDUsuarioExistente;

            -- Actualizar vinculación OAuth y último acceso
            UPDATE dbo.Usuario
            SET ProveedorOAuth = 'Google',
                IdProveedorOAuth = @IdGoogle,
                UltimoAcceso = SYSUTCDATETIME(),
                FechaActualizacion = SYSUTCDATETIME()
            WHERE IDUsuario = @IDUsuarioFinal;

            -- Registrar en bitácora
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
                @IDUsuarioFinal,
                'usuarios',
                'Usuario',
                CAST(@IDUsuarioFinal AS NVARCHAR(100)),
                'login_oauth_google',
                NULL,
                (SELECT @IDUsuarioFinal AS idUsuario, @Correo AS correo, 'Google' AS proveedor FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
                @DireccionIP
            );
        END
        ELSE
        BEGIN
            -- Obtener ID del rol Cliente
            DECLARE @IDRolCliente INT;
            SELECT @IDRolCliente = IDRol FROM dbo.Rol WHERE Nombre = N'Cliente' AND EstaActivo = 1;

            IF @IDRolCliente IS NULL
                THROW 50200, N'Error de configuración: El rol Cliente no está disponible.', 1;

            -- Insertar nuevo cliente OAuth
            INSERT INTO dbo.Usuario (
                IDRol,
                Nombres,
                Apellidos,
                Correo,
                Telefono,
                HashContrasena,
                EstaActivo,
                ProveedorOAuth,
                IdProveedorOAuth,
                FechaCreacion,
                FechaActualizacion,
                UltimoAcceso
            )
            VALUES (
                @IDRolCliente,
                @Nombres,
                @Apellidos,
                @Correo,
                NULL,
                @HashContrasena,
                1,
                'Google',
                @IdGoogle,
                SYSUTCDATETIME(),
                SYSUTCDATETIME(),
                SYSUTCDATETIME()
            );

            SET @IDUsuarioFinal = SCOPE_IDENTITY();

            -- Registrar en bitácora
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
                @IDUsuarioFinal,
                'usuarios',
                'Usuario',
                CAST(@IDUsuarioFinal AS NVARCHAR(100)),
                'registro_oauth_google',
                NULL,
                (SELECT @IDUsuarioFinal AS idUsuario, @Correo AS correo, N'Cliente' AS rol, 'Google' AS proveedor FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
                @DireccionIP
            );
        END

    COMMIT TRANSACTION;

    -- 1er Resultset: Información del usuario
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
    WHERE u.IDUsuario = @IDUsuarioFinal;

    -- 2do Resultset: Permisos asignados al rol del usuario
    SELECT p.Codigo
    FROM dbo.Usuario u
    JOIN dbo.RolPermiso rp ON u.IDRol = rp.IDRol
    JOIN dbo.Permiso p ON rp.IDPermiso = p.IDPermiso
    WHERE u.IDUsuario = @IDUsuarioFinal AND u.EstaActivo = 1;
END;
GO

