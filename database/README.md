# Base de Datos ShopCart (SQL Server 2019+)

## Convención de Nomenclatura
- Stored Procedures: `SP_Modulo_Proceso`
- Vistas: `VW_Modulo_Proceso`
- Funciones tipo tabla: `FU_Modulo_Proceso`
- Llaves primarias autoincrementables: `ID` + PascalCase (`IDRol`, `IDUsuario`, `IDPedido`)

## Estructura
- `migrations/`: DDL inmutable (tablas, constraints, checks, llaves).
- `programmable/`: Procedimientos, vistas y funciones con `CREATE OR ALTER`.
- `seeds/`: Datos iniciales de demostración.
- `runner/`: Ejecutor de migraciones en TypeScript con transacciones y `GO`.
