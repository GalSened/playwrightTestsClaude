"""
Memory Journal Service - Git-style memory management for COM
Provides branch, commit, and tag operations for event versioning
"""

import hashlib
import json
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from pathlib import Path

from core.models import MemoryBranch, MemoryCommit, MemoryTag
from storage.event_store import EventStore


class MemoryJournalService:
    """
    Git-style memory journal for COM

    Provides:
    - Branch management (create, switch, merge)
    - Commit operations (create, history, diff)
    - Tag management (create, list, delete)
    - Context retrieval at specific commits
    """

    def __init__(self, event_store: EventStore):
        self.event_store = event_store

    # ==========================================================================
    # Branch Operations
    # ==========================================================================

    def create_branch(
        self,
        branch_name: str,
        from_branch: str = 'main',
        description: Optional[str] = None
    ) -> MemoryBranch:
        """
        Create a new memory branch from an existing branch
        Similar to: git branch <new-branch> <from-branch>
        """
        # Verify source branch exists
        branches = self.event_store.list_branches()
        source_branch = next((b for b in branches if b['name'] == from_branch), None)

        if not source_branch:
            raise ValueError(f"Source branch not found: {from_branch}")

        # Create new branch with same head as source
        success = self.event_store.create_branch(branch_name, description)

        if not success:
            raise ValueError(f"Branch already exists: {branch_name}")

        # Copy head commit from source branch if it exists
        if source_branch['head_commit']:
            import sqlite3
            with self.event_store._get_connection() as conn:
                conn.execute("""
                    UPDATE memory_branches
                    SET head_commit = ?
                    WHERE name = ?
                """, (source_branch['head_commit'], branch_name))
                conn.commit()

        return MemoryBranch(
            name=branch_name,
            head_commit=source_branch['head_commit'],
            description=description
        )

    def list_branches(self) -> List[MemoryBranch]:
        """
        List all memory branches
        Similar to: git branch -a
        """
        branches_data = self.event_store.list_branches()
        return [
            MemoryBranch(
                name=b['name'],
                head_commit=b['head_commit'],
                created_at=datetime.fromisoformat(b['created_at']),
                description=b['description']
            )
            for b in branches_data
        ]

    def get_branch(self, branch_name: str) -> Optional[MemoryBranch]:
        """Get branch details"""
        branches = self.list_branches()
        return next((b for b in branches if b.name == branch_name), None)

    def delete_branch(self, branch_name: str, force: bool = False) -> bool:
        """
        Delete a memory branch
        Similar to: git branch -d <branch>

        Args:
            branch_name: Branch to delete
            force: If True, delete even if branch has unmerged commits
        """
        if branch_name == 'main':
            raise ValueError("Cannot delete main branch")

        # Check if branch has unmerged commits (unless force)
        if not force:
            # TODO: Implement merge detection
            pass

        import sqlite3
        with self.event_store._get_connection() as conn:
            try:
                conn.execute("DELETE FROM memory_branches WHERE name = ?", (branch_name,))
                conn.commit()
                return True
            except sqlite3.Error:
                return False

    # ==========================================================================
    # Commit Operations
    # ==========================================================================

    def commit(
        self,
        branch: str,
        event_ids: List[str],
        message: str,
        author: str = 'system',
        tags: Optional[List[str]] = None
    ) -> MemoryCommit:
        """
        Create a memory commit on a branch
        Similar to: git commit -m "message"

        Args:
            branch: Branch to commit to
            event_ids: List of event IDs to include in commit
            message: Commit message
            author: Commit author
            tags: Optional tags for this commit
        """
        commit_id = self.event_store.commit_events(branch, event_ids, message, author)

        # Add tags if provided
        if tags:
            import sqlite3
            with self.event_store._get_connection() as conn:
                # Get current tags
                cursor = conn.execute("""
                    SELECT tags_json FROM memory_commits WHERE commit_id = ?
                """, (commit_id,))
                row = cursor.fetchone()

                if row:
                    existing_tags = json.loads(row[0])
                    updated_tags = list(set(existing_tags + tags))

                    conn.execute("""
                        UPDATE memory_commits
                        SET tags_json = ?
                        WHERE commit_id = ?
                    """, (json.dumps(updated_tags), commit_id))
                    conn.commit()

        return MemoryCommit(
            commit_id=commit_id,
            branch=branch,
            message=message,
            author=author,
            event_ids=event_ids,
            tags=tags or []
        )

    def get_commit(self, commit_id: str) -> Optional[MemoryCommit]:
        """Get commit details"""
        import sqlite3
        with self.event_store._get_connection() as conn:
            cursor = conn.execute("""
                SELECT commit_id, branch, message, author, timestamp,
                       event_ids_json, parent_commit, tags_json
                FROM memory_commits
                WHERE commit_id = ?
            """, (commit_id,))
            row = cursor.fetchone()

            if not row:
                return None

            return MemoryCommit(
                commit_id=row['commit_id'],
                branch=row['branch'],
                message=row['message'],
                author=row['author'],
                timestamp=datetime.fromisoformat(row['timestamp']),
                event_ids=json.loads(row['event_ids_json']),
                parent_commit=row['parent_commit'],
                tags=json.loads(row['tags_json'])
            )

    def get_commit_history(
        self,
        branch: str,
        limit: int = 50
    ) -> List[MemoryCommit]:
        """
        Get commit history for a branch
        Similar to: git log
        """
        import sqlite3
        with self.event_store._get_connection() as conn:
            cursor = conn.execute("""
                SELECT commit_id, branch, message, author, timestamp,
                       event_ids_json, parent_commit, tags_json
                FROM memory_commits
                WHERE branch = ?
                ORDER BY timestamp DESC
                LIMIT ?
            """, (branch, limit))

            commits = []
            for row in cursor.fetchall():
                commits.append(MemoryCommit(
                    commit_id=row['commit_id'],
                    branch=row['branch'],
                    message=row['message'],
                    author=row['author'],
                    timestamp=datetime.fromisoformat(row['timestamp']),
                    event_ids=json.loads(row['event_ids_json']),
                    parent_commit=row['parent_commit'],
                    tags=json.loads(row['tags_json'])
                ))

            return commits

    def get_events_at_commit(self, commit_id: str) -> List[Any]:
        """
        Get all events included in a commit
        Useful for context retrieval at specific points in time
        """
        commit = self.get_commit(commit_id)
        if not commit:
            return []

        events = []
        for event_id in commit.event_ids:
            event = self.event_store.get_event(event_id)
            if event:
                events.append(event)

        return events

    # ==========================================================================
    # Tag Operations
    # ==========================================================================

    def create_tag(
        self,
        tag_name: str,
        commit_id: str,
        message: str
    ) -> MemoryTag:
        """
        Create a tag pointing to a commit
        Similar to: git tag -a <tag> -m "message" <commit>
        """
        # Verify commit exists
        commit = self.get_commit(commit_id)
        if not commit:
            raise ValueError(f"Commit not found: {commit_id}")

        import sqlite3
        with self.event_store._get_connection() as conn:
            try:
                conn.execute("""
                    INSERT INTO memory_tags (tag_name, commit_id, message)
                    VALUES (?, ?, ?)
                """, (tag_name, commit_id, message))
                conn.commit()

                return MemoryTag(
                    tag_name=tag_name,
                    commit_id=commit_id,
                    message=message
                )
            except sqlite3.IntegrityError:
                raise ValueError(f"Tag already exists: {tag_name}")

    def get_tag(self, tag_name: str) -> Optional[MemoryTag]:
        """Get tag details"""
        import sqlite3
        with self.event_store._get_connection() as conn:
            cursor = conn.execute("""
                SELECT tag_name, commit_id, message, created_at
                FROM memory_tags
                WHERE tag_name = ?
            """, (tag_name,))
            row = cursor.fetchone()

            if not row:
                return None

            return MemoryTag(
                tag_name=row['tag_name'],
                commit_id=row['commit_id'],
                message=row['message'],
                created_at=datetime.fromisoformat(row['created_at'])
            )

    def list_tags(self) -> List[MemoryTag]:
        """
        List all tags
        Similar to: git tag -l
        """
        import sqlite3
        with self.event_store._get_connection() as conn:
            cursor = conn.execute("""
                SELECT tag_name, commit_id, message, created_at
                FROM memory_tags
                ORDER BY created_at DESC
            """)

            tags = []
            for row in cursor.fetchall():
                tags.append(MemoryTag(
                    tag_name=row['tag_name'],
                    commit_id=row['commit_id'],
                    message=row['message'],
                    created_at=datetime.fromisoformat(row['created_at'])
                ))

            return tags

    def delete_tag(self, tag_name: str) -> bool:
        """
        Delete a tag
        Similar to: git tag -d <tag>
        """
        import sqlite3
        with self.event_store._get_connection() as conn:
            cursor = conn.execute("""
                DELETE FROM memory_tags WHERE tag_name = ?
            """, (tag_name,))
            conn.commit()
            return cursor.rowcount > 0

    # ==========================================================================
    # Context Retrieval at Specific Points
    # ==========================================================================

    def get_context_at_commit(
        self,
        commit_id: str,
        max_events: int = 100
    ) -> Dict[str, Any]:
        """
        Get context snapshot at a specific commit
        Useful for reproducing analysis with historical state
        """
        commit = self.get_commit(commit_id)
        if not commit:
            raise ValueError(f"Commit not found: {commit_id}")

        # Get all events up to this commit
        events = self.get_events_at_commit(commit_id)

        # Get commit metadata
        return {
            'commit_id': commit_id,
            'commit_message': commit.message,
            'commit_timestamp': commit.timestamp.isoformat(),
            'branch': commit.branch,
            'author': commit.author,
            'event_count': len(events),
            'events': events[:max_events]
        }

    def get_context_at_tag(self, tag_name: str) -> Dict[str, Any]:
        """
        Get context snapshot at a tagged commit
        """
        tag = self.get_tag(tag_name)
        if not tag:
            raise ValueError(f"Tag not found: {tag_name}")

        return self.get_context_at_commit(tag.commit_id)

    # ==========================================================================
    # Diff Operations
    # ==========================================================================

    def diff_commits(
        self,
        commit_id_1: str,
        commit_id_2: str
    ) -> Dict[str, Any]:
        """
        Compare two commits
        Similar to: git diff <commit1> <commit2>
        """
        commit1 = self.get_commit(commit_id_1)
        commit2 = self.get_commit(commit_id_2)

        if not commit1 or not commit2:
            raise ValueError("One or both commits not found")

        events1 = set(commit1.event_ids)
        events2 = set(commit2.event_ids)

        return {
            'commit_1': {
                'id': commit1.commit_id,
                'message': commit1.message,
                'timestamp': commit1.timestamp.isoformat(),
                'event_count': len(events1)
            },
            'commit_2': {
                'id': commit2.commit_id,
                'message': commit2.message,
                'timestamp': commit2.timestamp.isoformat(),
                'event_count': len(events2)
            },
            'added_events': list(events2 - events1),
            'removed_events': list(events1 - events2),
            'common_events': list(events1 & events2)
        }

    # ==========================================================================
    # Statistics
    # ==========================================================================

    def get_journal_stats(self) -> Dict[str, Any]:
        """Get memory journal statistics"""
        branches = self.list_branches()
        tags = self.list_tags()

        import sqlite3
        with self.event_store._get_connection() as conn:
            # Total commits
            cursor = conn.execute("SELECT COUNT(*) FROM memory_commits")
            total_commits = cursor.fetchone()[0]

            # Commits by branch
            cursor = conn.execute("""
                SELECT branch, COUNT(*) as count
                FROM memory_commits
                GROUP BY branch
            """)
            commits_by_branch = dict(cursor.fetchall())

            # Recent activity (last 7 days)
            seven_days_ago = (datetime.utcnow() - timedelta(days=7)).isoformat()
            cursor = conn.execute("""
                SELECT COUNT(*) FROM memory_commits
                WHERE timestamp > ?
            """, (seven_days_ago,))
            recent_commits = cursor.fetchone()[0]

        return {
            'total_branches': len(branches),
            'total_commits': total_commits,
            'total_tags': len(tags),
            'commits_by_branch': commits_by_branch,
            'recent_commits_7d': recent_commits,
            'branches': [{'name': b.name, 'head': b.head_commit} for b in branches]
        }
