/*
    ShopCart - 9002 Datos Semilla: Usuarios de Demostración y Pruebas 
    contraseñas con hash Argon2id (OWASP).
    Credenciales de prueba documentadas:
      - Administrador: admin@shopcart.com / Admin1234!
      - Operador:      operador@shopcart.com / Operador1234!
      - Cliente:       cliente@shopcart.com / Cliente1234!
*/
SET NOCOUNT ON;
GO

-- 1. Usuario Administrador Principal
IF NOT EXISTS (SELECT 1 FROM dbo.Usuario WHERE Correo = 'admin@shopcart.com')
BEGIN
    DECLARE @idAdminRol INT = (SELECT IDRol FROM dbo.Rol WHERE Nombre = 'Administrador');

    INSERT INTO dbo.Usuario (
        IDRol,
        Nombres,
        Apellidos,
        Correo,
        HashContrasena,
        EstaActivo,
        FechaCreacion,
        FechaActualizacion
    )
    VALUES (
        @idAdminRol,
        N'Admin',
        N'Principal',
        'admin@shopcart.com',
        N'$argon2id$v=19$m=65536,t=3,p=4$5QUWFRIsNdCmxwYSyVcZdg$/JdR7Edgm2qPGi93nsLTqvwwESlOAVaYlAteg2O81Wc',
        1,
        SYSUTCDATETIME(),
        SYSUTCDATETIME()
    );
    PRINT 'Usuario Administrador creado exitosamente (admin@shopcart.com / Admin1234!).';
END;
GO

-- 2. Usuario Operador de Almacén
IF NOT EXISTS (SELECT 1 FROM dbo.Usuario WHERE Correo = 'operador@shopcart.com')
BEGIN
    DECLARE @idOpRol INT = (SELECT IDRol FROM dbo.Rol WHERE Nombre = 'Operador');

    INSERT INTO dbo.Usuario (
        IDRol,
        Nombres,
        Apellidos,
        Correo,
        HashContrasena,
        EstaActivo,
        FechaCreacion,
        FechaActualizacion
    )
    VALUES (
        @idOpRol,
        N'Operador',
        N'Almacen',
        'operador@shopcart.com',
        N'$argon2id$v=19$m=65536,t=3,p=4$spn3jGYo5NOtAs3bryGcSg$KFsqfLXwlx8NqkOgpxyv2ccNiAWVZYGA8H6cbAFjQAE',
        1,
        SYSUTCDATETIME(),
        SYSUTCDATETIME()
    );
    PRINT 'Usuario Operador creado exitosamente (operador@shopcart.com / Operador1234!).';
END;
GO

-- 3. Usuario Cliente de Demostración
IF NOT EXISTS (SELECT 1 FROM dbo.Usuario WHERE Correo = 'cliente@shopcart.com')
BEGIN
    DECLARE @idCliRol INT = (SELECT IDRol FROM dbo.Rol WHERE Nombre = 'Cliente');
    DECLARE @idUsuarioCliente INT;

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
        @idCliRol,
        N'Carlos',
        N'Mendoza',
        'cliente@shopcart.com',
        '+50255551234',
        N'$argon2id$v=19$m=65536,t=3,p=4$V6KrYJpN+NdprXgU0AEYMQ$sff70c/FZSrzQ6FKQU3dJ+KQjQy4jU3ncy7Net/SD0Q',
        1,
        SYSUTCDATETIME(),
        SYSUTCDATETIME()
    );
    SET @idUsuarioCliente = SCOPE_IDENTITY();

    -- Dirección predeterminada para el cliente de prueba
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
        EstaActiva
    )
    VALUES (
        @idUsuarioCliente,
        N'Casa',
        N'Carlos Mendoza',
        N'+50255551234',
        N'Avenida Las Américas 12-45, Zona 14',
        N'Edificio Las Torres, Apto 502',
        N'Guatemala',
        N'Guatemala',
        N'01014',
        N'Frente al parque Las Américas',
        1,
        1
    );

    PRINT 'Usuario Cliente creado exitosamente (cliente@shopcart.com / Cliente1234!).';
END;
GO
