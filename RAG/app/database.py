import os
import asyncpg
from dotenv import load_dotenv
from datetime import datetime, timedelta

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")


class Database:
    def __init__(self):
        self.pool = None

    async def connect(self):
        """Connect to database. Schema is managed by backend via Drizzle."""
        self.pool = await asyncpg.create_pool(DATABASE_URL)

    async def disconnect(self):
        if self.pool:
            await self.pool.close()

    # === File Operations ===
    
    async def register_file(
        self, 
        file_id: str, 
        filename: str, 
        storage_path: str,
        domain: str, 
        sector: str,
        content_type: str = "application/pdf"
    ) -> bool:
        """Register a file from Supabase Storage."""
        from uuid import UUID
        async with self.pool.acquire() as conn:
            try:
                # Convert string to UUID for PostgreSQL
                uuid_id = UUID(file_id)
                await conn.execute(
                    """INSERT INTO rag_files (id, filename, storage_path, content_type, domain, sector, vector_status)
                       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
                       ON CONFLICT (id) DO UPDATE SET
                           filename = $2, storage_path = $3, domain = $5, sector = $6, updated_at = NOW()""",
                    uuid_id, filename, storage_path, content_type, domain, sector
                )
                return True
            except ValueError:
                # Invalid UUID format
                return False
            except Exception:
                return False

    async def get_file(self, file_id: str) -> dict | None:
        """Get file metadata by ID."""
        from uuid import UUID
        async with self.pool.acquire() as conn:
            try:
                uuid_id = UUID(file_id)
                row = await conn.fetchrow(
                    "SELECT * FROM rag_files WHERE id = $1", uuid_id
                )
                return dict(row) if row else None
            except ValueError:
                # Invalid UUID format
                return None

    async def list_files(self, domain: str = None, sector: str = None) -> list[dict]:
        """List files with optional filtering."""
        async with self.pool.acquire() as conn:
            if domain and sector:
                rows = await conn.fetch(
                    """SELECT * FROM rag_files WHERE domain = $1 AND sector = $2 
                       ORDER BY created_at DESC""",
                    domain, sector
                )
            elif domain:
                rows = await conn.fetch(
                    "SELECT * FROM rag_files WHERE domain = $1 ORDER BY created_at DESC",
                    domain
                )
            elif sector:
                rows = await conn.fetch(
                    "SELECT * FROM rag_files WHERE sector = $1 ORDER BY created_at DESC",
                    sector
                )
            else:
                rows = await conn.fetch(
                    "SELECT * FROM rag_files ORDER BY created_at DESC"
                )
            return [dict(row) for row in rows]

    async def get_files_for_query(self, domain: str, sector: str) -> list[dict]:
        """Get all files matching domain/sector for a query."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT * FROM rag_files 
                   WHERE domain = $1 AND sector = $2 
                   ORDER BY created_at DESC""",
                domain, sector
            )
            return [dict(row) for row in rows]

    async def delete_file(self, file_id: str) -> bool:
        """Delete file metadata."""
        from uuid import UUID
        async with self.pool.acquire() as conn:
            try:
                uuid_id = UUID(file_id)
                result = await conn.execute(
                    "DELETE FROM rag_files WHERE id = $1", uuid_id
                )
                return "DELETE 1" in result
            except ValueError:
                return False

    # === Vector Status Operations ===

    async def update_vector_status(
        self, 
        file_id: str, 
        status: str, 
        chunk_count: int = 0
    ):
        """Update vector status after indexing."""
        from uuid import UUID
        async with self.pool.acquire() as conn:
            try:
                uuid_id = UUID(file_id)
                await conn.execute(
                    """UPDATE rag_files 
                       SET vector_status = $1, chunk_count = $2, 
                           last_accessed = NOW(), updated_at = NOW()
                       WHERE id = $3""",
                    status, chunk_count, uuid_id
                )
            except ValueError:
                pass  # Invalid UUID, skip update

    async def touch_file(self, file_id: str):
        """Update last_accessed timestamp when vectors are used."""
        from uuid import UUID
        async with self.pool.acquire() as conn:
            try:
                uuid_id = UUID(file_id)
                await conn.execute(
                    "UPDATE rag_files SET last_accessed = NOW() WHERE id = $1",
                    uuid_id
                )
            except ValueError:
                pass  # Invalid UUID, skip update

    async def get_expired_files(self, days: int = 30) -> list[dict]:
        """Get files with vectors not accessed in X days."""
        cutoff = datetime.utcnow() - timedelta(days=days)
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT * FROM rag_files 
                   WHERE vector_status = 'indexed' 
                   AND last_accessed < $1
                   ORDER BY last_accessed ASC""",
                cutoff
            )
            return [dict(row) for row in rows]

    async def get_pending_files(self, domain: str, sector: str) -> list[dict]:
        """Get files that need vectorization for a query."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT * FROM rag_files 
                   WHERE domain = $1 AND sector = $2 
                   AND vector_status IN ('pending', 'expired')
                   ORDER BY created_at DESC""",
                domain, sector
            )
            return [dict(row) for row in rows]

    async def get_indexed_files(self, domain: str, sector: str) -> list[dict]:
        """Get files that are already indexed."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT * FROM rag_files 
                   WHERE domain = $1 AND sector = $2 
                   AND vector_status = 'indexed'
                   ORDER BY created_at DESC""",
                domain, sector
            )
            return [dict(row) for row in rows]


db = Database()
