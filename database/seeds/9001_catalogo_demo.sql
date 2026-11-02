/*
    ShopCart - 9001 Datos Semilla: Catálogo, Inventario y Cupones de Demostración 
    Precios en Quetzales (GTQ) con IVA del 12% incluido.
*/
SET NOCOUNT ON;
GO

/* =========================================================================
   1. CATEGORÍAS JERÁRQUICAS 
   ========================================================================= */
IF NOT EXISTS (SELECT 1 FROM dbo.Categoria WHERE Slug = 'tecnologia')
BEGIN
    INSERT INTO dbo.Categoria (Nombre, Slug, Descripcion, EstaActiva, OrdenVisual)
    VALUES (N'Tecnología', 'tecnologia', N'Dispositivos electrónicos, computación y audio', 1, 1);
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Categoria WHERE Slug = 'ropa-y-calzado')
BEGIN
    INSERT INTO dbo.Categoria (Nombre, Slug, Descripcion, EstaActiva, OrdenVisual)
    VALUES (N'Ropa y Calzado', 'ropa-y-calzado', N'Prendas de vestir y calzado de moda', 1, 2);
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Categoria WHERE Slug = 'hogar-y-oficina')
BEGIN
    INSERT INTO dbo.Categoria (Nombre, Slug, Descripcion, EstaActiva, OrdenVisual)
    VALUES (N'Hogar y Oficina', 'hogar-y-oficina', N'Mobiliario y accesorios ergonómicos', 1, 3);
END;
GO

-- Subcategorías de Tecnología
DECLARE @idTec INT = (SELECT IDCategoria FROM dbo.Categoria WHERE Slug = 'tecnologia');

IF NOT EXISTS (SELECT 1 FROM dbo.Categoria WHERE Slug = 'smartphones')
BEGIN
    INSERT INTO dbo.Categoria (IDCategoriaPadre, Nombre, Slug, Descripcion, EstaActiva, OrdenVisual)
    VALUES (@idTec, N'Smartphones', 'smartphones', N'Teléfonos inteligentes de última generación', 1, 1);
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Categoria WHERE Slug = 'laptops-y-computadoras')
BEGIN
    INSERT INTO dbo.Categoria (IDCategoriaPadre, Nombre, Slug, Descripcion, EstaActiva, OrdenVisual)
    VALUES (@idTec, N'Laptops y Computadoras', 'laptops-y-computadoras', N'Portátiles y equipos de alto rendimiento', 1, 2);
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Categoria WHERE Slug = 'audio-y-accesorios')
BEGIN
    INSERT INTO dbo.Categoria (IDCategoriaPadre, Nombre, Slug, Descripcion, EstaActiva, OrdenVisual)
    VALUES (@idTec, N'Audio y Accesorios', 'audio-y-accesorios', N'Audífonos, bocinas y accesorios', 1, 3);
END;

-- Subcategorías de Ropa
DECLARE @idRopa INT = (SELECT IDCategoria FROM dbo.Categoria WHERE Slug = 'ropa-y-calzado');

IF NOT EXISTS (SELECT 1 FROM dbo.Categoria WHERE Slug = 'ropa-hombre')
BEGIN
    INSERT INTO dbo.Categoria (IDCategoriaPadre, Nombre, Slug, Descripcion, EstaActiva, OrdenVisual)
    VALUES (@idRopa, N'Hombre', 'ropa-hombre', N'Moda masculina contemporánea', 1, 1);
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Categoria WHERE Slug = 'ropa-mujer')
BEGIN
    INSERT INTO dbo.Categoria (IDCategoriaPadre, Nombre, Slug, Descripcion, EstaActiva, OrdenVisual)
    VALUES (@idRopa, N'Mujer', 'ropa-mujer', N'Moda femenina contemporánea', 1, 2);
END;
GO

/* =========================================================================
   2. ATRIBUTOS Y VALORES NORMALIZADOS 
   ========================================================================= */
IF NOT EXISTS (SELECT 1 FROM dbo.Atributo WHERE Nombre = N'Color')
    INSERT INTO dbo.Atributo (Nombre, EstaActivo) VALUES (N'Color', 1);

IF NOT EXISTS (SELECT 1 FROM dbo.Atributo WHERE Nombre = N'Capacidad')
    INSERT INTO dbo.Atributo (Nombre, EstaActivo) VALUES (N'Capacidad', 1);

IF NOT EXISTS (SELECT 1 FROM dbo.Atributo WHERE Nombre = N'Talla')
    INSERT INTO dbo.Atributo (Nombre, EstaActivo) VALUES (N'Talla', 1);
GO

DECLARE @idAtrColor INT = (SELECT IDAtributo FROM dbo.Atributo WHERE Nombre = N'Color');
DECLARE @idAtrCap INT = (SELECT IDAtributo FROM dbo.Atributo WHERE Nombre = N'Capacidad');
DECLARE @idAtrTalla INT = (SELECT IDAtributo FROM dbo.Atributo WHERE Nombre = N'Talla');

-- Valores Color
IF NOT EXISTS (SELECT 1 FROM dbo.ValorAtributo WHERE IDAtributo = @idAtrColor AND Valor = N'Negro Titanio')
    INSERT INTO dbo.ValorAtributo (IDAtributo, Valor, OrdenVisual) VALUES (@idAtrColor, N'Negro Titanio', 1);

IF NOT EXISTS (SELECT 1 FROM dbo.ValorAtributo WHERE IDAtributo = @idAtrColor AND Valor = N'Gris Espacial')
    INSERT INTO dbo.ValorAtributo (IDAtributo, Valor, OrdenVisual) VALUES (@idAtrColor, N'Gris Espacial', 2);

IF NOT EXISTS (SELECT 1 FROM dbo.ValorAtributo WHERE IDAtributo = @idAtrColor AND Valor = N'Plata')
    INSERT INTO dbo.ValorAtributo (IDAtributo, Valor, OrdenVisual) VALUES (@idAtrColor, N'Plata', 3);

-- Valores Capacidad
IF NOT EXISTS (SELECT 1 FROM dbo.ValorAtributo WHERE IDAtributo = @idAtrCap AND Valor = N'128 GB')
    INSERT INTO dbo.ValorAtributo (IDAtributo, Valor, OrdenVisual) VALUES (@idAtrCap, N'128 GB', 1);

IF NOT EXISTS (SELECT 1 FROM dbo.ValorAtributo WHERE IDAtributo = @idAtrCap AND Valor = N'256 GB')
    INSERT INTO dbo.ValorAtributo (IDAtributo, Valor, OrdenVisual) VALUES (@idAtrCap, N'256 GB', 2);

IF NOT EXISTS (SELECT 1 FROM dbo.ValorAtributo WHERE IDAtributo = @idAtrCap AND Valor = N'512 GB')
    INSERT INTO dbo.ValorAtributo (IDAtributo, Valor, OrdenVisual) VALUES (@idAtrCap, N'512 GB', 3);

-- Valores Talla
IF NOT EXISTS (SELECT 1 FROM dbo.ValorAtributo WHERE IDAtributo = @idAtrTalla AND Valor = N'S')
    INSERT INTO dbo.ValorAtributo (IDAtributo, Valor, OrdenVisual) VALUES (@idAtrTalla, N'S', 1);

IF NOT EXISTS (SELECT 1 FROM dbo.ValorAtributo WHERE IDAtributo = @idAtrTalla AND Valor = N'M')
    INSERT INTO dbo.ValorAtributo (IDAtributo, Valor, OrdenVisual) VALUES (@idAtrTalla, N'M', 2);

IF NOT EXISTS (SELECT 1 FROM dbo.ValorAtributo WHERE IDAtributo = @idAtrTalla AND Valor = N'L')
    INSERT INTO dbo.ValorAtributo (IDAtributo, Valor, OrdenVisual) VALUES (@idAtrTalla, N'L', 3);
GO

/* =========================================================================
   3. PRODUCTOS Y VARIANTES CON EXISTENCIAS EN KARDEX 
   ========================================================================= */
DECLARE @idAdmin INT = (SELECT TOP 1 IDUsuario FROM dbo.Usuario WHERE Correo = 'admin@shopcart.com');
DECLARE @idAlmacen INT = (SELECT TOP 1 IDAlmacen FROM dbo.Almacen WHERE Codigo = 'PRINCIPAL');

-- A. iPhone 15 Pro
DECLARE @idCatSmartphones INT = (SELECT IDCategoria FROM dbo.Categoria WHERE Slug = 'smartphones');
DECLARE @idProdIPhone INT;

IF NOT EXISTS (SELECT 1 FROM dbo.Producto WHERE Slug = 'apple-iphone-15-pro')
BEGIN
    INSERT INTO dbo.Producto (IDCategoria, Nombre, Slug, Descripcion, Marca, EstaActivo)
    VALUES (@idCatSmartphones, N'iPhone 15 Pro', 'apple-iphone-15-pro',
            N'Titanio con chip A17 Pro, botón de acción y cámara gran angular de 48 MP.', N'Apple', 1);
    SET @idProdIPhone = SCOPE_IDENTITY();
END
ELSE
BEGIN
    SET @idProdIPhone = (SELECT IDProducto FROM dbo.Producto WHERE Slug = 'apple-iphone-15-pro');
END;

-- Variante 1: 128GB Negro
DECLARE @idVarIPhone128 INT;
IF NOT EXISTS (SELECT 1 FROM dbo.VarianteProducto WHERE SKU = 'IPH15P-128-BLK')
BEGIN
    INSERT INTO dbo.VarianteProducto (IDProducto, SKU, Precio, Costo, PesoGramos, EstaActiva)
    VALUES (@idProdIPhone, 'IPH15P-128-BLK', 8499.00, 6800.00, 187, 1);
    SET @idVarIPhone128 = SCOPE_IDENTITY();

    -- Inventario y Kardex inicial 
    INSERT INTO dbo.Inventario (IDVariante, IDAlmacen, Existencia, CantidadReservada, PuntoReorden)
    VALUES (@idVarIPhone128, @idAlmacen, 30, 0, 5);

    INSERT INTO dbo.MovimientoInventario (
        IDVariante, IDAlmacen, TipoMovimiento, Cantidad, ExistenciaAnterior, ExistenciaPosterior, IDUsuario, Motivo
    )
    VALUES (@idVarIPhone128, @idAlmacen, 'ENTRADA_COMPRA', 30, 0, 30, @idAdmin, N'Stock inicial demo iPhone 15 Pro 128GB');
END;

-- Variante 2: 256GB Negro
DECLARE @idVarIPhone256 INT;
IF NOT EXISTS (SELECT 1 FROM dbo.VarianteProducto WHERE SKU = 'IPH15P-256-BLK')
BEGIN
    INSERT INTO dbo.VarianteProducto (IDProducto, SKU, Precio, Costo, PesoGramos, EstaActiva)
    VALUES (@idProdIPhone, 'IPH15P-256-BLK', 9499.00, 7600.00, 187, 1);
    SET @idVarIPhone256 = SCOPE_IDENTITY();

    INSERT INTO dbo.Inventario (IDVariante, IDAlmacen, Existencia, CantidadReservada, PuntoReorden)
    VALUES (@idVarIPhone256, @idAlmacen, 25, 0, 5);

    INSERT INTO dbo.MovimientoInventario (
        IDVariante, IDAlmacen, TipoMovimiento, Cantidad, ExistenciaAnterior, ExistenciaPosterior, IDUsuario, Motivo
    )
    VALUES (@idVarIPhone256, @idAlmacen, 'ENTRADA_COMPRA', 25, 0, 25, @idAdmin, N'Stock inicial demo iPhone 15 Pro 256GB');
END;

-- B. MacBook Air M3
DECLARE @idCatLaptops INT = (SELECT IDCategoria FROM dbo.Categoria WHERE Slug = 'laptops-y-computadoras');
DECLARE @idProdMacBook INT;

IF NOT EXISTS (SELECT 1 FROM dbo.Producto WHERE Slug = 'apple-macbook-air-m3-13')
BEGIN
    INSERT INTO dbo.Producto (IDCategoria, Nombre, Slug, Descripcion, Marca, EstaActivo)
    VALUES (@idCatLaptops, N'MacBook Air 13" Chip M3', 'apple-macbook-air-m3-13',
            N'Increíblemente delgada y rápida con pantalla Liquid Retina y hasta 18 horas de batería.', N'Apple', 1);
    SET @idProdMacBook = SCOPE_IDENTITY();
END
ELSE
BEGIN
    SET @idProdMacBook = (SELECT IDProducto FROM dbo.Producto WHERE Slug = 'apple-macbook-air-m3-13');
END;

DECLARE @idVarMacBook INT;
IF NOT EXISTS (SELECT 1 FROM dbo.VarianteProducto WHERE SKU = 'MBA-M3-13-SLV')
BEGIN
    INSERT INTO dbo.VarianteProducto (IDProducto, SKU, Precio, Costo, PesoGramos, EstaActiva)
    VALUES (@idProdMacBook, 'MBA-M3-13-SLV', 10499.00, 8500.00, 1240, 1);
    SET @idVarMacBook = SCOPE_IDENTITY();

    INSERT INTO dbo.Inventario (IDVariante, IDAlmacen, Existencia, CantidadReservada, PuntoReorden)
    VALUES (@idVarMacBook, @idAlmacen, 15, 0, 3);

    INSERT INTO dbo.MovimientoInventario (
        IDVariante, IDAlmacen, TipoMovimiento, Cantidad, ExistenciaAnterior, ExistenciaPosterior, IDUsuario, Motivo
    )
    VALUES (@idVarMacBook, @idAlmacen, 'ENTRADA_COMPRA', 15, 0, 15, @idAdmin, N'Stock inicial demo MacBook Air M3');
END;

-- C. Audífonos Sony WH-1000XM5
DECLARE @idCatAudio INT = (SELECT IDCategoria FROM dbo.Categoria WHERE Slug = 'audio-y-accesorios');
DECLARE @idProdSony INT;

IF NOT EXISTS (SELECT 1 FROM dbo.Producto WHERE Slug = 'sony-wh-1000xm5-noise-canceling')
BEGIN
    INSERT INTO dbo.Producto (IDCategoria, Nombre, Slug, Descripcion, Marca, EstaActivo)
    VALUES (@idCatAudio, N'Sony WH-1000XM5', 'sony-wh-1000xm5-noise-canceling',
            N'Cancelación de ruido líder en la industria con procesador integrado V1 y llamadas ultra nítidas.', N'Sony', 1);
    SET @idProdSony = SCOPE_IDENTITY();
END
ELSE
BEGIN
    SET @idProdSony = (SELECT IDProducto FROM dbo.Producto WHERE Slug = 'sony-wh-1000xm5-noise-canceling');
END;

DECLARE @idVarSony INT;
IF NOT EXISTS (SELECT 1 FROM dbo.VarianteProducto WHERE SKU = 'SNY-WH1000XM5-BLK')
BEGIN
    INSERT INTO dbo.VarianteProducto (IDProducto, SKU, Precio, Costo, PesoGramos, EstaActiva)
    VALUES (@idProdSony, 'SNY-WH1000XM5-BLK', 2899.00, 2100.00, 250, 1);
    SET @idVarSony = SCOPE_IDENTITY();

    INSERT INTO dbo.Inventario (IDVariante, IDAlmacen, Existencia, CantidadReservada, PuntoReorden)
    VALUES (@idVarSony, @idAlmacen, 40, 0, 8);

    INSERT INTO dbo.MovimientoInventario (
        IDVariante, IDAlmacen, TipoMovimiento, Cantidad, ExistenciaAnterior, ExistenciaPosterior, IDUsuario, Motivo
    )
    VALUES (@idVarSony, @idAlmacen, 'ENTRADA_COMPRA', 40, 0, 40, @idAdmin, N'Stock inicial demo Sony WH-1000XM5');
END;

-- D. Playera Casual Premium Hombre
DECLARE @idCatHombre INT = (SELECT IDCategoria FROM dbo.Categoria WHERE Slug = 'ropa-hombre');
DECLARE @idProdPlayera INT;

IF NOT EXISTS (SELECT 1 FROM dbo.Producto WHERE Slug = 'playera-casual-algodon-pima')
BEGIN
    INSERT INTO dbo.Producto (IDCategoria, Nombre, Slug, Descripcion, Marca, EstaActivo)
    VALUES (@idCatHombre, N'Playera Casual Algodón Pima', 'playera-casual-algodon-pima',
            N'Playera de algodón pima 100% transpirable y suave al tacto con corte regular.', N'ShopCart Apparel', 1);
    SET @idProdPlayera = SCOPE_IDENTITY();
END
ELSE
BEGIN
    SET @idProdPlayera = (SELECT IDProducto FROM dbo.Producto WHERE Slug = 'playera-casual-algodon-pima');
END;

DECLARE @idVarPlayeraM INT;
IF NOT EXISTS (SELECT 1 FROM dbo.VarianteProducto WHERE SKU = 'PLY-PIMA-BLK-M')
BEGIN
    INSERT INTO dbo.VarianteProducto (IDProducto, SKU, Precio, Costo, PesoGramos, EstaActiva)
    VALUES (@idProdPlayera, 'PLY-PIMA-BLK-M', 189.00, 95.00, 180, 1);
    SET @idVarPlayeraM = SCOPE_IDENTITY();

    INSERT INTO dbo.Inventario (IDVariante, IDAlmacen, Existencia, CantidadReservada, PuntoReorden)
    VALUES (@idVarPlayeraM, @idAlmacen, 60, 0, 10);

    INSERT INTO dbo.MovimientoInventario (
        IDVariante, IDAlmacen, TipoMovimiento, Cantidad, ExistenciaAnterior, ExistenciaPosterior, IDUsuario, Motivo
    )
    VALUES (@idVarPlayeraM, @idAlmacen, 'ENTRADA_COMPRA', 60, 0, 60, @idAdmin, N'Stock inicial demo Playera Talla M');
END;

-- E. Silla Ergonómica Pro Desk
DECLARE @idCatHogar INT = (SELECT IDCategoria FROM dbo.Categoria WHERE Slug = 'hogar-y-oficina');
DECLARE @idProdSilla INT;

IF NOT EXISTS (SELECT 1 FROM dbo.Producto WHERE Slug = 'silla-ergonomica-pro-desk')
BEGIN
    INSERT INTO dbo.Producto (IDCategoria, Nombre, Slug, Descripcion, Marca, EstaActivo)
    VALUES (@idCatHogar, N'Silla Ergonómica Pro Desk', 'silla-ergonomica-pro-desk',
            N'Silla ejecutiva de malla transpirable con soporte lumbar ajustable y reposabrazos 3D.', N'ErgoComfort', 1);
    SET @idProdSilla = SCOPE_IDENTITY();
END
ELSE
BEGIN
    SET @idProdSilla = (SELECT IDProducto FROM dbo.Producto WHERE Slug = 'silla-ergonomica-pro-desk');
END;

DECLARE @idVarSilla INT;
IF NOT EXISTS (SELECT 1 FROM dbo.VarianteProducto WHERE SKU = 'SIL-ERG-PRO-BLK')
BEGIN
    INSERT INTO dbo.VarianteProducto (IDProducto, SKU, Precio, Costo, PesoGramos, EstaActiva)
    VALUES (@idProdSilla, 'SIL-ERG-PRO-BLK', 1499.00, 950.00, 14500, 1);
    SET @idVarSilla = SCOPE_IDENTITY();

    INSERT INTO dbo.Inventario (IDVariante, IDAlmacen, Existencia, CantidadReservada, PuntoReorden)
    VALUES (@idVarSilla, @idAlmacen, 20, 0, 3);

    INSERT INTO dbo.MovimientoInventario (
        IDVariante, IDAlmacen, TipoMovimiento, Cantidad, ExistenciaAnterior, ExistenciaPosterior, IDUsuario, Motivo
    )
    VALUES (@idVarSilla, @idAlmacen, 'ENTRADA_COMPRA', 20, 0, 20, @idAdmin, N'Stock inicial demo Silla Ergonómica');
END;
GO

/* =========================================================================
   4. CUPONES Y PROMOCIONES DE DEMOSTRACIÓN 
   ========================================================================= */
DECLARE @idAdmin INT = (SELECT TOP 1 IDUsuario FROM dbo.Usuario WHERE Correo = 'admin@shopcart.com');
DECLARE @idCatTec INT = (SELECT IDCategoria FROM dbo.Categoria WHERE Slug = 'tecnologia');

-- Cupón 1: 10% en todo el carrito con mínimo Q100
IF NOT EXISTS (SELECT 1 FROM dbo.Cupon WHERE Codigo = 'BIENVENIDO10')
BEGIN
    INSERT INTO dbo.Cupon (
        Codigo, Descripcion, TipoDescuento, ValorDescuento, Alcance,
        MontoMinimoCompra, DescuentoMaximo, LimiteUsosTotal, UsosActuales, LimiteUsosPorCliente,
        FechaInicio, FechaFin, EstaActivo, CreadoPor
    )
    VALUES (
        'BIENVENIDO10', N'10% de descuento en tu primera compra (mínimo Q100)', 'PORCENTAJE', 10.00, 'CARRITO',
        100.00, 500.00, 100, 0, 1,
        SYSUTCDATETIME(), DATEADD(MONTH, 6, SYSUTCDATETIME()), 1, @idAdmin
    );
END;

-- Cupón 2: Q50 de descuento directo en carrito
IF NOT EXISTS (SELECT 1 FROM dbo.Cupon WHERE Codigo = 'SHOPCART50')
BEGIN
    INSERT INTO dbo.Cupon (
        Codigo, Descripcion, TipoDescuento, ValorDescuento, Alcance,
        MontoMinimoCompra, DescuentoMaximo, LimiteUsosTotal, UsosActuales, LimiteUsosPorCliente,
        FechaInicio, FechaFin, EstaActivo, CreadoPor
    )
    VALUES (
        'SHOPCART50', N'Q50 de descuento directo en compras mayores a Q250', 'MONTO', 50.00, 'CARRITO',
        250.00, NULL, 50, 0, 1,
        SYSUTCDATETIME(), DATEADD(MONTH, 3, SYSUTCDATETIME()), 1, @idAdmin
    );
END;

-- Cupón 3: 15% en categoría Tecnología
IF NOT EXISTS (SELECT 1 FROM dbo.Cupon WHERE Codigo = 'TECH15')
BEGIN
    INSERT INTO dbo.Cupon (
        Codigo, Descripcion, TipoDescuento, ValorDescuento, Alcance, IDCategoria,
        MontoMinimoCompra, DescuentoMaximo, LimiteUsosTotal, UsosActuales, LimiteUsosPorCliente,
        FechaInicio, FechaFin, EstaActivo, CreadoPor
    )
    VALUES (
        'TECH15', N'15% de descuento en artículos de tecnología', 'PORCENTAJE', 15.00, 'CATEGORIA', @idCatTec,
        500.00, 1000.00, 50, 0, 2,
        SYSUTCDATETIME(), DATEADD(MONTH, 3, SYSUTCDATETIME()), 1, @idAdmin
    );
END;

-- Cupón 4: Cupón vencido para probar validación negativa (rechazo esperado)
IF NOT EXISTS (SELECT 1 FROM dbo.Cupon WHERE Codigo = 'VENCIDO2025')
BEGIN
    INSERT INTO dbo.Cupon (
        Codigo, Descripcion, TipoDescuento, ValorDescuento, Alcance,
        MontoMinimoCompra, DescuentoMaximo, LimiteUsosTotal, UsosActuales, LimiteUsosPorCliente,
        FechaInicio, FechaFin, EstaActivo, CreadoPor
    )
    VALUES (
        'VENCIDO2025', N'Cupón expirado para pruebas de validación', 'PORCENTAJE', 20.00, 'CARRITO',
        50.00, NULL, 10, 0, 1,
        DATEADD(MONTH, -3, SYSUTCDATETIME()), DATEADD(DAY, -1, SYSUTCDATETIME()), 1, @idAdmin
    );
END;

-- Promoción automática: 5% en compras superiores a Q2,000
IF NOT EXISTS (SELECT 1 FROM dbo.Promocion WHERE Nombre = N'Descuento por Volumen Lanzamiento')
BEGIN
    INSERT INTO dbo.Promocion (
        Nombre, Descripcion, TipoDescuento, ValorDescuento, DescuentoMaximo,
        FechaInicio, FechaFin, Prioridad, EsAcumulable, EstaActiva, CreadaPor
    )
    VALUES (
        N'Descuento por Volumen Lanzamiento', N'5% de descuento en compras de alto volumen',
        'PORCENTAJE', 5.00, 250.00,
        SYSUTCDATETIME(), DATEADD(MONTH, 6, SYSUTCDATETIME()), 1, 0, 1, @idAdmin
    );
END;
GO

PRINT 'Catálogo, existencias iniciales en kardex y cupones de demostración aplicados exitosamente.';
GO
