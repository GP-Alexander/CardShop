/*
    ShopCart - 9002 Datos Semilla: Usuarios de Demostración y Pruebas (RF-01)
    Motor: Microsoft SQL Server 2019+
    Convención: Idempotente (IF NOT EXISTS), contraseñas con hash Argon2id (OWASP).
    Credenciales de prueba documentadas:
      - Administrador: admin@shopcart.com / Admin1234!
      - Operador:      operador@shopcart.com / Operador1234!
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
