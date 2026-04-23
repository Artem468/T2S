from sqlalchemy import inspect


class DatabaseInspector:
    def __init__(self, engine):
        self.engine = engine

    async def get_schemas(self):
        """Получить все схемы в БД"""
        async with self.engine.connect() as conn:
            def _get_schemas(connection):
                inspector = inspect(connection)
                try:
                    return inspector.get_schema_names()
                except Exception:
                    return [None]  # Для SQLite и MySQL

            return await conn.run_sync(_get_schemas)

    async def get_tables(self, schema=None):
        """Получить все таблицы в схеме"""
        async with self.engine.connect() as conn:
            def _get_tables(connection):
                inspector = inspect(connection)
                try:
                    return inspector.get_table_names(schema)
                except Exception:
                    return inspector.get_table_names()

            return await conn.run_sync(_get_tables)

    async def get_columns(self, table_name, schema=None):
        """Получить колонки таблицы"""
        async with self.engine.connect() as conn:
            def _get_columns(connection):
                inspector = inspect(connection)
                try:
                    columns = inspector.get_columns(table_name, schema)
                except Exception:
                    columns = inspector.get_columns(table_name)

                return [{
                    "name": col['name'],
                    "type": str(col['type']),
                    "nullable": col.get('nullable', True),
                    "default": str(col.get('default')) if col.get('default') else None,
                    "autoincrement": col.get('autoincrement', False)
                } for col in columns]

            return await conn.run_sync(_get_columns)

    async def get_primary_keys(self, table_name, schema=None):
        """Получить первичные ключи таблицы"""
        async with self.engine.connect() as conn:
            def _get_pk(connection):
                inspector = inspect(connection)
                try:
                    pk = inspector.get_pk_constraint(table_name, schema)
                    return pk.get('constrained_columns', [])
                except Exception:
                    try:
                        return inspector.get_primary_keys(table_name, schema)
                    except Exception:
                        return []

            return await conn.run_sync(_get_pk)

    async def get_foreign_keys(self, table_name, schema=None):
        """Получить внешние ключи таблицы"""
        async with self.engine.connect() as conn:
            def _get_fk(connection):
                inspector = inspect(connection)
                try:
                    fks = inspector.get_foreign_keys(table_name, schema)
                except Exception:
                    fks = []

                return [{
                    "columns": fk['constrained_columns'],
                    "referred_table": fk['referred_table'],
                    "referred_columns": fk['referred_columns'],
                    "name": fk.get('name')
                } for fk in fks]

            return await conn.run_sync(_get_fk)

    async def get_indexes(self, table_name, schema=None):
        """Получить индексы таблицы"""
        async with self.engine.connect() as conn:
            def _get_indexes(connection):
                inspector = inspect(connection)
                try:
                    return inspector.get_indexes(table_name, schema)
                except Exception:
                    return []

            return await conn.run_sync(_get_indexes)

    async def get_full_schema(self):
        """Получить полную схему БД"""
        schemas = await self.get_schemas()
        full_schema = {}

        for schema in schemas:
            schema_key = schema if schema else "default"
            full_schema[schema_key] = {}

            tables = await self.get_tables(schema)

            for table in tables:
                full_schema[schema_key][table] = {
                    "columns": await self.get_columns(table, schema),
                    "primary_keys": await self.get_primary_keys(table, schema),
                    "foreign_keys": await self.get_foreign_keys(table, schema),
                    "indexes": await self.get_indexes(table, schema)
                }

        return full_schema

def schema_to_string(schema) -> str:
    output_lines = []

    for schema_name, tables in schema.items():
        for table_name, table_info in tables.items():
            output_lines.append(f"\nCREATE TABLE {table_name} (")

            for col in table_info["columns"]:
                pk_mark = " PRIMARY KEY" if col['name'] in table_info["primary_keys"] else " "
                null_mark = "NULL" if col['nullable'] else "NOT NULL"
                output_lines.append(f"{col['name']} {col['type']} {pk_mark} {null_mark}")

            if table_info["foreign_keys"]:
                for fk in table_info["foreign_keys"]:
                    output_lines.append(
                        f"FOREIGN KEY ({', '.join(fk['columns'])}) REFERENCES {fk['referred_table']} ({', '.join(fk['referred_columns'])})")
            output_lines.append(")")
        output_lines.append("")

    return '\n'.join(output_lines)


if __name__ == "__main__":
    from sqlalchemy.ext.asyncio import create_async_engine
    import asyncio

    async def main():
        engine = create_async_engine("sqlite+aiosqlite:///../../../incity.db")
        inspector = DatabaseInspector(engine)
        print(schema_to_string(await inspector.get_full_schema()))

    asyncio.run(main())