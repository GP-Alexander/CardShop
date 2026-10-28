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
   1.1. SP_Usuario_RegistrarInterno
   Registra un usuario interno (Operador o Administrador) con validación
   de rol, idempotencia y registro en la Bitácora de Auditoría (RF-01, RF-09).
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Usuario_RegistrarInterno
    @IDUsuarioAdmin INT = NULL,
    @Nombres NVARCHAR(100),
    @Apellidos NVARCHAR(100),
    @Correo NVARCHAR(254),
    @NombreRol NVARCHAR(50),
    @HashContrasena NVARCHAR(255),
    @Telefono NVARCHAR(30) = NULL,
    @DireccionIP VARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    -- Validaciones de entrada
    IF @Nombres IS NULL OR LTRIM(RTRIM(@Nombres)) = ''
        THROW 50001, N'El nombre del usuario es obligatorio.', 1;

    IF @Apellidos IS NULL OR LTRIM(RTRIM(@Apellidos)) = ''
        THROW 50001, N'El apellido del usuario es obligatorio.', 1;

    IF @Correo IS NULL OR LTRIM(RTRIM(@Correo)) = '' OR @Correo NOT LIKE N'_%@_%._%'
        THROW 50001, N'El correo electrónico no tiene un formato válido.', 1;

    IF @NombreRol NOT IN (N'Operador', N'Administrador')
        THROW 50001, N'El rol especificado debe ser Operador o Administrador.', 1;

    IF @HashContrasena IS NULL OR LTRIM(RTRIM(@HashContrasena)) = ''
        THROW 50001, N'El hash de contraseña es obligatorio.', 1;

    SET @Correo = LOWER(LTRIM(RTRIM(@Correo)));

    -- Verificar duplicidad de correo (50204 -> HTTP 409)
    IF EXISTS (SELECT 1 FROM dbo.Usuario WHERE Correo = @Correo)
        THROW 50204, N'El correo electrónico ya se encuentra registrado en el sistema.', 1;

    -- Obtener ID del rol
    DECLARE @IDRol INT;
    SELECT @IDRol = IDRol FROM dbo.Rol WHERE Nombre = @NombreRol AND EstaActivo = 1;

    IF @IDRol IS NULL
        THROW 50200, N'Error de configuración: El rol solicitado no existe o no está activo.', 1;

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
            @IDRol,
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
                @NombreRol AS rol,
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
            COALESCE(@IDUsuarioAdmin, @NuevoIDUsuario),
            'usuarios',

            'Usuario',
            CAST(@NuevoIDUsuario AS NVARCHAR(100)),
            'registro_usuario_interno',
            NULL,
            @ValorNuevoJson,
            @DireccionIP
        );

    COMMIT TRANSACTION;

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

    -- Si la sesión o el token ya fueron revocados previamente (ej. tras logout o expiración)
    IF @FechaRevocacion IS NOT NULL
        THROW 50201, N'La sesión ha sido revocada o ha expirado. Inicie sesión nuevamente.', 1;

    -- DETECCIÓN DE REUSO / BRECHA DE SEGURIDAD (RF-01)
    -- Si el token NO está revocado pero ya fue consumido anteriormente:
    -- Intento de suplantación con un refresh token rotado. Revoca toda la familia activa.
    IF @FechaUso IS NOT NULL
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

/* =========================================================================
   7. SP_Usuario_ListarPaginado
   Lista usuarios con filtros por texto, rol y estado, ordenamiento
   y paginación del servidor (RF-01, RF-08).
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Usuario_ListarPaginado
    @Busqueda NVARCHAR(100) = NULL,
    @Rol NVARCHAR(50) = NULL,
    @EstaActivo BIT = NULL,
    @Pagina INT = 1,
    @Limite INT = 10,
    @ColumnaOrden VARCHAR(50) = 'FechaCreacion',
    @Orden VARCHAR(4) = 'DESC'
AS
BEGIN
    SET NOCOUNT ON;

    -- Validaciones de paginación
    IF @Pagina < 1 SET @Pagina = 1;
    IF @Limite < 1 SET @Limite = 10;
    IF @Limite > 100 SET @Limite = 100;

    SET @Busqueda = NULLIF(LTRIM(RTRIM(@Busqueda)), '');
    SET @Rol = NULLIF(LTRIM(RTRIM(@Rol)), '');
    IF @Rol = 'todos' SET @Rol = NULL;

    SET @ColumnaOrden = LOWER(ISNULL(@ColumnaOrden, 'fechacreacion'));
    SET @Orden = UPPER(ISNULL(@Orden, 'DESC'));
    IF @Orden NOT IN ('ASC', 'DESC') SET @Orden = 'DESC';

    DECLARE @Offset INT = (@Pagina - 1) * @Limite;

    WITH UsuariosFiltrados AS (
        SELECT 
            u.IDUsuario,
            u.Nombres,
            u.Apellidos,
            u.Correo,
            u.Telefono,
            r.Nombre AS NombreRol,
            u.EstaActivo,
            u.FechaCreacion,
            u.UltimoAcceso,
            COUNT(*) OVER() AS TotalRegistros
        FROM dbo.Usuario u
        JOIN dbo.Rol r ON u.IDRol = r.IDRol
        WHERE (@Busqueda IS NULL OR (
                u.Nombres LIKE N'%' + @Busqueda + N'%' OR
                u.Apellidos LIKE N'%' + @Busqueda + N'%' OR
                u.Correo LIKE N'%' + @Busqueda + N'%'
              ))
          AND (@Rol IS NULL OR r.Nombre = @Rol)
          AND (@EstaActivo IS NULL OR u.EstaActivo = @EstaActivo)
    )
    SELECT 
        IDUsuario,
        Nombres,
        Apellidos,
        Correo,
        Telefono,
        NombreRol,
        EstaActivo,
        FechaCreacion,
        UltimoAcceso,
        TotalRegistros
    FROM UsuariosFiltrados
    ORDER BY 
        CASE WHEN @Orden = 'ASC' AND @ColumnaOrden = 'nombres' THEN Nombres END ASC,
        CASE WHEN @Orden = 'DESC' AND @ColumnaOrden = 'nombres' THEN Nombres END DESC,
        CASE WHEN @Orden = 'ASC' AND @ColumnaOrden = 'apellidos' THEN Apellidos END ASC,
        CASE WHEN @Orden = 'DESC' AND @ColumnaOrden = 'apellidos' THEN Apellidos END DESC,
        CASE WHEN @Orden = 'ASC' AND @ColumnaOrden = 'correo' THEN Correo END ASC,
        CASE WHEN @Orden = 'DESC' AND @ColumnaOrden = 'correo' THEN Correo END DESC,
        CASE WHEN @Orden = 'ASC' AND @ColumnaOrden = 'ultimoacceso' THEN UltimoAcceso END ASC,
        CASE WHEN @Orden = 'DESC' AND @ColumnaOrden = 'ultimoacceso' THEN UltimoAcceso END DESC,
        CASE WHEN @Orden = 'ASC' AND @ColumnaOrden = 'fechacreacion' THEN FechaCreacion END ASC,
        CASE WHEN @Orden = 'DESC' AND @ColumnaOrden = 'fechacreacion' THEN FechaCreacion END DESC,
        IDUsuario DESC
    OFFSET @Offset ROWS
    FETCH NEXT @Limite ROWS ONLY;
END;
GO

/* =========================================================================
   8. SP_Usuario_ObtenerDetalle
   Obtiene el detalle completo de un usuario por su ID, junto con sus
   direcciones registradas (RF-01).
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Usuario_ObtenerDetalle
    @IDUsuario INT
AS
BEGIN
    SET NOCOUNT ON;

    IF @IDUsuario IS NULL OR @IDUsuario <= 0
        THROW 50001, N'El ID del usuario es inválido.', 1;

    -- 1. Datos del Usuario
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
        u.FechaActualizacion,
        u.UltimoAcceso
    FROM dbo.Usuario u
    JOIN dbo.Rol r ON u.IDRol = r.IDRol
    WHERE u.IDUsuario = @IDUsuario;

    IF @@ROWCOUNT = 0
        THROW 50404, N'El usuario especificado no fue encontrado.', 1;

    -- 2. Direcciones registradas por el usuario
    SELECT 
        d.IDDireccion,
        d.Alias,
        d.Destinatario,
        d.Telefono,
        d.Linea1,
        d.Linea2,
        d.Departamento,
        d.Municipio,
        d.CodigoPostal,
        d.Referencia,
        d.EsPredeterminada,
        d.EstaActiva,
        d.FechaCreacion
    FROM dbo.Direccion d
    WHERE d.IDUsuario = @IDUsuario AND d.EstaActiva = 1
    ORDER BY d.EsPredeterminada DESC, d.FechaCreacion DESC;
END;
GO

/* =========================================================================
   9. SP_Usuario_ActualizarAdmin
   Permite al Administrador actualizar datos de un usuario (nombres, teléfono,
   rol) registrando el cambio en la Bitácora de Auditoría (RF-01, RF-09).
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Usuario_ActualizarAdmin
    @IDUsuarioAdmin INT,
    @IDUsuarioObjetivo INT,
    @Nombres NVARCHAR(100),
    @Apellidos NVARCHAR(100),
    @IDRol INT,
    @Telefono NVARCHAR(30) = NULL,
    @DireccionIP VARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @IDUsuarioAdmin IS NULL OR @IDUsuarioAdmin <= 0
        THROW 50001, N'ID de administrador inválido.', 1;

    IF @IDUsuarioObjetivo IS NULL OR @IDUsuarioObjetivo <= 0
        THROW 50001, N'ID de usuario objetivo inválido.', 1;

    IF @Nombres IS NULL OR LTRIM(RTRIM(@Nombres)) = ''
        THROW 50001, N'El nombre es obligatorio.', 1;

    IF @Apellidos IS NULL OR LTRIM(RTRIM(@Apellidos)) = ''
        THROW 50001, N'El apellido es obligatorio.', 1;

    -- Verificar que el usuario objetivo exista
    IF NOT EXISTS (SELECT 1 FROM dbo.Usuario WHERE IDUsuario = @IDUsuarioObjetivo)
        THROW 50404, N'El usuario a actualizar no existe.', 1;

    -- Verificar que el rol exista y esté activo
    IF NOT EXISTS (SELECT 1 FROM dbo.Rol WHERE IDRol = @IDRol AND EstaActivo = 1)
        THROW 50200, N'El rol asignado no existe o no está activo.', 1;

    -- Regla de auto-protección: Un admin no puede quitarse su propio rol de Administrador
    IF @IDUsuarioAdmin = @IDUsuarioObjetivo
    BEGIN
        DECLARE @NombreRolNuevo NVARCHAR(50) = (SELECT Nombre FROM dbo.Rol WHERE IDRol = @IDRol);
        IF @NombreRolNuevo <> 'Administrador'
            THROW 50005, N'No puedes quitarte el rol de Administrador a ti mismo.', 1;
    END

    -- Regla de seguridad y SoD estricta:
    -- 1. Una cuenta de cliente jamás puede convertirse en un rol interno (Operador o Administrador)
    DECLARE @NombreRolActual NVARCHAR(50) = (
        SELECT r.Nombre 
        FROM dbo.Usuario u
        JOIN dbo.Rol r ON u.IDRol = r.IDRol
        WHERE u.IDUsuario = @IDUsuarioObjetivo
    );
    DECLARE @NombreRolDestino NVARCHAR(50) = (SELECT Nombre FROM dbo.Rol WHERE IDRol = @IDRol);

    IF @NombreRolActual = 'Cliente' AND @NombreRolDestino <> 'Cliente'
        THROW 50006, N'Por políticas de seguridad y segregación de funciones (SoD), una cuenta de cliente jamás puede convertirse en un rol de personal interno (Operador o Administrador). Cree una credencial corporativa independiente.', 1;

    -- 2. Una cuenta de personal interno no puede convertirse en cuenta de cliente
    IF @NombreRolActual IN ('Operador', 'Administrador') AND @NombreRolDestino = 'Cliente'
        THROW 50006, N'Por políticas de seguridad y auditoría, una cuenta del personal interno no puede convertirse en cuenta de cliente.', 1;

    DECLARE @ValorAnteriorJson NVARCHAR(MAX);
    DECLARE @ValorNuevoJson NVARCHAR(MAX);

    -- Capturar estado anterior para auditoría (RF-09)
    SET @ValorAnteriorJson = (
        SELECT 
            u.IDUsuario,
            u.Nombres,
            u.Apellidos,
            u.Telefono,
            r.Nombre AS Rol
        FROM dbo.Usuario u
        JOIN dbo.Rol r ON u.IDRol = r.IDRol
        WHERE u.IDUsuario = @IDUsuarioObjetivo
        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
    );

    BEGIN TRANSACTION;

        UPDATE dbo.Usuario
        SET 
            Nombres = LTRIM(RTRIM(@Nombres)),
            Apellidos = LTRIM(RTRIM(@Apellidos)),
            Telefono = NULLIF(LTRIM(RTRIM(@Telefono)), ''),
            IDRol = @IDRol,
            FechaActualizacion = SYSUTCDATETIME()
        WHERE IDUsuario = @IDUsuarioObjetivo;

        -- Capturar nuevo estado para auditoría
        SET @ValorNuevoJson = (
            SELECT 
                u.IDUsuario,
                u.Nombres,
                u.Apellidos,
                u.Telefono,
                r.Nombre AS Rol
            FROM dbo.Usuario u
            JOIN dbo.Rol r ON u.IDRol = r.IDRol
            WHERE u.IDUsuario = @IDUsuarioObjetivo
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
            @IDUsuarioAdmin,
            'usuarios',
            'Usuario',
            CAST(@IDUsuarioObjetivo AS NVARCHAR(100)),
            'actualizar_usuario',
            @ValorAnteriorJson,
            @ValorNuevoJson,
            @DireccionIP
        );

    COMMIT TRANSACTION;

    -- Retornar usuario actualizado
    SELECT 
        u.IDUsuario,
        u.IDRol,
        r.Nombre AS NombreRol,
        u.Nombres,
        u.Apellidos,
        u.Correo,
        u.Telefono,
        u.EstaActivo,
        u.FechaActualizacion
    FROM dbo.Usuario u
    JOIN dbo.Rol r ON u.IDRol = r.IDRol
    WHERE u.IDUsuario = @IDUsuarioObjetivo;
END;
GO

/* =========================================================================
   10. SP_Usuario_CambiarEstado
   Activa o desactiva a un usuario sin borrado físico (RF-01).
   Si se desactiva, revoca inmediatamente todas sus sesiones activas (RF-01).
   Registra el cambio en la Bitácora de Auditoría (RF-09).
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Usuario_CambiarEstado
    @IDUsuarioAdmin INT,
    @IDUsuarioObjetivo INT,
    @EstaActivo BIT,
    @DireccionIP VARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @IDUsuarioAdmin IS NULL OR @IDUsuarioAdmin <= 0
        THROW 50001, N'ID de administrador inválido.', 1;

    IF @IDUsuarioObjetivo IS NULL OR @IDUsuarioObjetivo <= 0
        THROW 50001, N'ID de usuario objetivo inválido.', 1;

    IF @EstaActivo IS NULL
        THROW 50001, N'El estado activo es obligatorio.', 1;

    -- Verificar que el usuario exista
    IF NOT EXISTS (SELECT 1 FROM dbo.Usuario WHERE IDUsuario = @IDUsuarioObjetivo)
        THROW 50404, N'El usuario especificado no existe.', 1;

    -- Regla de auto-protección: Un admin no puede desactivarse a sí mismo
    IF @IDUsuarioAdmin = @IDUsuarioObjetivo AND @EstaActivo = 0
        THROW 50005, N'No puedes desactivar tu propia cuenta de administrador.', 1;

    DECLARE @EstadoActual BIT;
    SELECT @EstadoActual = EstaActivo FROM dbo.Usuario WHERE IDUsuario = @IDUsuarioObjetivo;

    -- Si ya está en el estado deseado, retornar sin cambios
    IF @EstadoActual = @EstaActivo
    BEGIN
        SELECT 
            u.IDUsuario,
            u.Nombres,
            u.Apellidos,
            u.Correo,
            r.Nombre AS NombreRol,
            u.EstaActivo,
            u.FechaActualizacion
        FROM dbo.Usuario u
        JOIN dbo.Rol r ON u.IDRol = r.IDRol
        WHERE u.IDUsuario = @IDUsuarioObjetivo;
        RETURN;
    END

    DECLARE @ValorAnteriorJson NVARCHAR(MAX) = (SELECT @EstadoActual AS estaActivo FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
    DECLARE @ValorNuevoJson NVARCHAR(MAX) = (SELECT @EstaActivo AS estaActivo FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);

    BEGIN TRANSACTION;

        UPDATE dbo.Usuario
        SET 
            EstaActivo = @EstaActivo,
            FechaActualizacion = SYSUTCDATETIME()
        WHERE IDUsuario = @IDUsuarioObjetivo;

        -- Si se desactiva, revocar todas las sesiones activas inmediatamente
        IF @EstaActivo = 0
        BEGIN
            UPDATE dbo.TokenSesion
            SET FechaRevocacion = SYSUTCDATETIME()
            WHERE IDUsuario = @IDUsuarioObjetivo AND FechaRevocacion IS NULL;
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
            @IDUsuarioAdmin,
            'usuarios',
            'Usuario',
            CAST(@IDUsuarioObjetivo AS NVARCHAR(100)),
            CASE WHEN @EstaActivo = 1 THEN 'activar_usuario' ELSE 'desactivar_usuario' END,
            @ValorAnteriorJson,
            @ValorNuevoJson,
            @DireccionIP
        );

    COMMIT TRANSACTION;

    SELECT 
        u.IDUsuario,
        u.Nombres,
        u.Apellidos,
        u.Correo,
        r.Nombre AS NombreRol,
        u.EstaActivo,
        u.FechaActualizacion
    FROM dbo.Usuario u
    JOIN dbo.Rol r ON u.IDRol = r.IDRol
    WHERE u.IDUsuario = @IDUsuarioObjetivo;
END;
GO

