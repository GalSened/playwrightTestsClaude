"""
Event Store - SQLite-based event log with Parquet archiving
Provides idempotent ingestion and efficient querying
"""

import sqlite3
import json
import hashlib
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any
from contextlib import contextmanager

from core.models import Event, EventType


class EventStore:
    """
    SQLite-based event log with idempotent ingestion
    Supports checksum-based deduplication and efficient querying
    """

    def __init__(self, db_path: str):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_schema()

    @contextmanager
    def _get_connection(self):
        """Get database connection with WAL mode enabled"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

    def _init_schema(self):
        """Initialize database schema"""
        with self._get_connection() as conn:
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA synchronous=NORMAL")

            # Main events table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS events (
                    id TEXT PRIMARY KEY,
                    checksum TEXT UNIQUE NOT NULL,
                    type TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    project TEXT NOT NULL,
                    branch TEXT NOT NULL,
                    data_json TEXT NOT NULL,
                    importance REAL NOT NULL DEFAULT 1.0,
                    tags_json TEXT NOT NULL,
                    source TEXT NOT NULL,
                    parent_id TEXT,
                    related_ids_json TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT (datetime('now'))
                )
            """)

            # Indexes for efficient querying
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_events_type
                ON events(type)
            """)

            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_events_project_branch
                ON events(project, branch)
            """)

            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_events_timestamp
                ON events(timestamp DESC)
            """)

            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_events_importance
                ON events(importance DESC)
            """)

            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_events_checksum
                ON events(checksum)
            """)

            # Memory journal tables
            conn.execute("""
                CREATE TABLE IF NOT EXISTS memory_branches (
                    name TEXT PRIMARY KEY,
                    head_commit TEXT,
                    created_at TEXT NOT NULL DEFAULT (datetime('now')),
                    description TEXT
                )
            """)

            conn.execute("""
                CREATE TABLE IF NOT EXISTS memory_commits (
                    commit_id TEXT PRIMARY KEY,
                    branch TEXT NOT NULL,
                    message TEXT NOT NULL,
                    author TEXT NOT NULL DEFAULT 'system',
                    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
                    event_ids_json TEXT NOT NULL,
                    parent_commit TEXT,
                    tags_json TEXT NOT NULL
                )
            """)

            conn.execute("""
                CREATE TABLE IF NOT EXISTS memory_tags (
                    tag_name TEXT PRIMARY KEY,
                    commit_id TEXT NOT NULL,
                    message TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT (datetime('now'))
                )
            """)

            conn.commit()

            # Initialize main branch if not exists
            conn.execute("""
                INSERT OR IGNORE INTO memory_branches (name, description)
                VALUES ('main', 'Default memory branch')
            """)
            conn.commit()

    @staticmethod
    def _compute_checksum(event: Event) -> str:
        """Compute checksum for event deduplication"""
        # Use timestamp + type + project + source + data for uniqueness
        content = f"{event.timestamp.isoformat()}|{event.type}|{event.project}|{event.source}|{json.dumps(event.data, sort_keys=True)}"
        return hashlib.sha256(content.encode()).hexdigest()

    def ingest(self, event: Event) -> bool:
        """
        Ingest event with idempotent deduplication
        Returns True if event was inserted, False if duplicate
        """
        # Compute checksum
        checksum = self._compute_checksum(event)

        # Prepare data
        tags_json = json.dumps(event.tags)
        related_ids_json = json.dumps(event.related_ids)
        data_json = json.dumps(event.data)

        with self._get_connection() as conn:
            try:
                conn.execute("""
                    INSERT INTO events (
                        id, checksum, type, timestamp, project, branch,
                        data_json, importance, tags_json, source,
                        parent_id, related_ids_json
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    event.id,
                    checksum,
                    event.type.value,
                    event.timestamp.isoformat(),
                    event.project,
                    event.branch,
                    data_json,
                    event.importance,
                    tags_json,
                    event.source,
                    event.parent_id,
                    related_ids_json
                ))
                conn.commit()
                return True
            except sqlite3.IntegrityError:
                # Duplicate event (checksum collision)
                return False

    def get_event(self, event_id: str) -> Optional[Event]:
        """Retrieve event by ID"""
        with self._get_connection() as conn:
            cursor = conn.execute("""
                SELECT * FROM events WHERE id = ?
            """, (event_id,))
            row = cursor.fetchone()

            if row is None:
                return None

            return self._row_to_event(row)

    def query_events(
        self,
        project: str,
        branch: str = "main",
        event_types: Optional[List[EventType]] = None,
        min_importance: float = 0.0,
        tags_include: Optional[List[str]] = None,
        tags_exclude: Optional[List[str]] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Event]:
        """Query events with filters"""
        conditions = ["project = ?", "branch = ?", "importance >= ?"]
        params: List[Any] = [project, branch, min_importance]

        # Event type filter
        if event_types:
            placeholders = ",".join("?" * len(event_types))
            conditions.append(f"type IN ({placeholders})")
            params.extend([et.value for et in event_types])

        # Tags filter (simplified - full JSON query would be better)
        # For now, we'll fetch and filter in Python

        query = f"""
            SELECT * FROM events
            WHERE {' AND '.join(conditions)}
            ORDER BY timestamp DESC
            LIMIT ? OFFSET ?
        """
        params.extend([limit, offset])

        with self._get_connection() as conn:
            cursor = conn.execute(query, params)
            rows = cursor.fetchall()

        events = [self._row_to_event(row) for row in rows]

        # Apply tag filters in Python
        if tags_include:
            events = [e for e in events if any(tag in e.tags for tag in tags_include)]

        if tags_exclude:
            events = [e for e in events if not any(tag in e.tags for tag in tags_exclude)]

        return events

    def get_recent_events(
        self,
        project: str,
        branch: str = "main",
        limit: int = 50
    ) -> List[Event]:
        """Get most recent events"""
        return self.query_events(
            project=project,
            branch=branch,
            limit=limit
        )

    def get_stats(self) -> Dict[str, Any]:
        """Get event store statistics"""
        with self._get_connection() as conn:
            # Total events
            cursor = conn.execute("SELECT COUNT(*) FROM events")
            total_events = cursor.fetchone()[0]

            # Events by type
            cursor = conn.execute("""
                SELECT type, COUNT(*) as count
                FROM events
                GROUP BY type
            """)
            events_by_type = dict(cursor.fetchall())

            # Events by project
            cursor = conn.execute("""
                SELECT project, COUNT(*) as count
                FROM events
                GROUP BY project
            """)
            events_by_project = dict(cursor.fetchall())

            # Total branches
            cursor = conn.execute("SELECT COUNT(*) FROM memory_branches")
            total_branches = cursor.fetchone()[0]

            # Total commits
            cursor = conn.execute("SELECT COUNT(*) FROM memory_commits")
            total_commits = cursor.fetchone()[0]

        return {
            "total_events": total_events,
            "events_by_type": events_by_type,
            "events_by_project": events_by_project,
            "total_branches": total_branches,
            "total_commits": total_commits
        }

    @staticmethod
    def _row_to_event(row: sqlite3.Row) -> Event:
        """Convert database row to Event model"""
        return Event(
            id=row["id"],
            type=EventType(row["type"]),
            timestamp=datetime.fromisoformat(row["timestamp"]),
            project=row["project"],
            branch=row["branch"],
            data=json.loads(row["data_json"]),
            importance=row["importance"],
            tags=json.loads(row["tags_json"]),
            source=row["source"],
            parent_id=row["parent_id"],
            related_ids=json.loads(row["related_ids_json"])
        )

    def create_branch(self, branch_name: str, description: Optional[str] = None) -> bool:
        """Create a new memory branch"""
        with self._get_connection() as conn:
            try:
                conn.execute("""
                    INSERT INTO memory_branches (name, description)
                    VALUES (?, ?)
                """, (branch_name, description))
                conn.commit()
                return True
            except sqlite3.IntegrityError:
                return False

    def list_branches(self) -> List[Dict[str, Any]]:
        """List all memory branches"""
        with self._get_connection() as conn:
            cursor = conn.execute("""
                SELECT name, head_commit, created_at, description
                FROM memory_branches
                ORDER BY created_at DESC
            """)
            return [dict(row) for row in cursor.fetchall()]

    def commit_events(
        self,
        branch: str,
        event_ids: List[str],
        message: str,
        author: str = "system"
    ) -> str:
        """Create a memory commit"""
        import uuid
        commit_id = f"commit-{uuid.uuid4().hex[:12]}"

        with self._get_connection() as conn:
            # Get parent commit
            cursor = conn.execute("""
                SELECT head_commit FROM memory_branches WHERE name = ?
            """, (branch,))
            row = cursor.fetchone()
            parent_commit = row["head_commit"] if row else None

            # Create commit
            conn.execute("""
                INSERT INTO memory_commits (
                    commit_id, branch, message, author, event_ids_json, parent_commit, tags_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                commit_id,
                branch,
                message,
                author,
                json.dumps(event_ids),
                parent_commit,
                json.dumps([])
            ))

            # Update branch head
            conn.execute("""
                UPDATE memory_branches
                SET head_commit = ?
                WHERE name = ?
            """, (commit_id, branch))

            conn.commit()

        return commit_id
