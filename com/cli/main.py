"""
COM CLI Tool
Command-line interface for COM management
"""

import sys
import json
from pathlib import Path
from datetime import datetime
from typing import Optional

import click
from rich.console import Console
from rich.table import Table
from rich import print as rprint

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.models import Event, EventType
from storage.event_store import EventStore
from dotenv import load_dotenv
import os

load_dotenv()

# Configuration
EVENT_LOG_DB_PATH = os.getenv("EVENT_LOG_DB_PATH", "./data/events.db")

console = Console()


# =============================================================================
# CLI Groups
# =============================================================================

@click.group()
def cli():
    """COM (Context Orchestrator Management) CLI"""
    pass


# =============================================================================
# Event Commands
# =============================================================================

@cli.group()
def event():
    """Event management commands"""
    pass


@event.command("ingest")
@click.option("--type", "-t", required=True, type=click.Choice([et.value for et in EventType]), help="Event type")
@click.option("--project", "-p", required=True, help="Project name")
@click.option("--branch", "-b", default="main", help="Memory branch")
@click.option("--source", "-s", required=True, help="Event source")
@click.option("--importance", "-i", default=1.0, type=float, help="Importance (0-5)")
@click.option("--tags", "-g", multiple=True, help="Tags (can specify multiple)")
@click.option("--data", "-d", help="JSON data")
@click.option("--data-file", "-f", type=click.Path(exists=True), help="JSON data file")
def ingest_event(
    type: str,
    project: str,
    branch: str,
    source: str,
    importance: float,
    tags: tuple,
    data: Optional[str],
    data_file: Optional[str]
):
    """Ingest a new event"""
    # Parse data
    event_data = {}
    if data:
        event_data = json.loads(data)
    elif data_file:
        with open(data_file) as f:
            event_data = json.load(f)

    # Create event
    import uuid
    event = Event(
        id=f"evt-{uuid.uuid4().hex[:12]}",
        type=EventType(type),
        project=project,
        branch=branch,
        source=source,
        importance=importance,
        tags=list(tags),
        data=event_data
    )

    # Ingest
    store = EventStore(EVENT_LOG_DB_PATH)
    inserted = store.ingest(event)

    if inserted:
        console.print(f"[green]✓[/green] Event ingested: {event.id}")
    else:
        console.print(f"[yellow]⚠[/yellow] Duplicate event (already exists)")


@event.command("get")
@click.argument("event_id")
def get_event(event_id: str):
    """Get event by ID"""
    store = EventStore(EVENT_LOG_DB_PATH)
    event = store.get_event(event_id)

    if event is None:
        console.print(f"[red]✗[/red] Event not found: {event_id}")
        sys.exit(1)

    # Display event
    rprint("\n[bold]Event Details[/bold]")
    rprint(f"ID: {event.id}")
    rprint(f"Type: {event.type.value}")
    rprint(f"Timestamp: {event.timestamp}")
    rprint(f"Project: {event.project}")
    rprint(f"Branch: {event.branch}")
    rprint(f"Source: {event.source}")
    rprint(f"Importance: {event.importance}/5.0")
    rprint(f"Tags: {', '.join(event.tags)}")
    rprint("\n[bold]Data:[/bold]")
    rprint(json.dumps(event.data, indent=2))


@event.command("list")
@click.option("--project", "-p", required=True, help="Project name")
@click.option("--branch", "-b", default="main", help="Memory branch")
@click.option("--type", "-t", type=click.Choice([et.value for et in EventType]), help="Filter by event type")
@click.option("--limit", "-l", default=20, help="Limit results")
def list_events(project: str, branch: str, type: Optional[str], limit: int):
    """List recent events"""
    store = EventStore(EVENT_LOG_DB_PATH)

    # Query events
    event_types = [EventType(type)] if type else None
    events = store.query_events(
        project=project,
        branch=branch,
        event_types=event_types,
        limit=limit
    )

    if not events:
        console.print("[yellow]No events found[/yellow]")
        return

    # Create table
    table = Table(title=f"Events for {project}/{branch}")
    table.add_column("ID", style="cyan")
    table.add_column("Type", style="magenta")
    table.add_column("Timestamp", style="green")
    table.add_column("Source", style="blue")
    table.add_column("Importance", justify="right")
    table.add_column("Tags")

    for event in events:
        table.add_row(
            event.id[:16] + "...",
            event.type.value,
            event.timestamp.strftime("%Y-%m-%d %H:%M"),
            event.source,
            f"{event.importance:.1f}",
            ", ".join(event.tags[:3])
        )

    console.print(table)
    console.print(f"\nTotal: {len(events)} events")


# =============================================================================
# Branch Commands
# =============================================================================

@cli.group()
def branch():
    """Memory branch commands"""
    pass


@branch.command("list")
def list_branches():
    """List all memory branches"""
    store = EventStore(EVENT_LOG_DB_PATH)
    branches = store.list_branches()

    if not branches:
        console.print("[yellow]No branches found[/yellow]")
        return

    # Create table
    table = Table(title="Memory Branches")
    table.add_column("Name", style="cyan")
    table.add_column("Head Commit", style="magenta")
    table.add_column("Created", style="green")
    table.add_column("Description")

    for b in branches:
        table.add_row(
            b["name"],
            b["head_commit"] or "(empty)",
            b["created_at"],
            b["description"] or ""
        )

    console.print(table)


@branch.command("create")
@click.argument("branch_name")
@click.option("--description", "-d", help="Branch description")
def create_branch(branch_name: str, description: Optional[str]):
    """Create a new memory branch"""
    store = EventStore(EVENT_LOG_DB_PATH)
    success = store.create_branch(branch_name, description)

    if success:
        console.print(f"[green]✓[/green] Branch created: {branch_name}")
    else:
        console.print(f"[red]✗[/red] Branch already exists: {branch_name}")
        sys.exit(1)


# =============================================================================
# Stats Commands
# =============================================================================

@cli.command("stats")
def show_stats():
    """Show COM statistics"""
    store = EventStore(EVENT_LOG_DB_PATH)
    stats = store.get_stats()

    rprint("\n[bold]COM Statistics[/bold]\n")
    rprint(f"Total Events: {stats['total_events']}")
    rprint(f"Total Branches: {stats['total_branches']}")
    rprint(f"Total Commits: {stats['total_commits']}")

    rprint("\n[bold]Events by Type:[/bold]")
    for event_type, count in stats['events_by_type'].items():
        rprint(f"  {event_type}: {count}")

    rprint("\n[bold]Events by Project:[/bold]")
    for project, count in stats['events_by_project'].items():
        rprint(f"  {project}: {count}")


# =============================================================================
# Seed Commands (for testing)
# =============================================================================

@cli.command("seed")
@click.option("--project", "-p", default="WeSign", help="Project name")
@click.option("--count", "-c", default=10, help="Number of events to seed")
def seed_events(project: str, count: int):
    """Seed test events for development"""
    import uuid
    store = EventStore(EVENT_LOG_DB_PATH)

    sample_events = [
        {
            "type": EventType.TEST_FAILURE,
            "source": "TestIntelligenceAgent",
            "importance": 3.5,
            "tags": ["flaky", "self-signing"],
            "data": {
                "test_id": "test_self_signing_pdf",
                "error": "Element not found: #signature-field",
                "screenshot": f"artifacts/failure-{uuid.uuid4().hex[:8]}.png"
            }
        },
        {
            "type": EventType.CODE_CHANGE,
            "source": "GitHubWebhook",
            "importance": 2.0,
            "tags": ["backend", "api"],
            "data": {
                "commit": uuid.uuid4().hex[:12],
                "files": ["src/services/signing.ts"],
                "message": "fix: handle missing signature field gracefully"
            }
        },
        {
            "type": EventType.AGENT_ACTION,
            "source": "FailureAnalysisAgent",
            "importance": 4.0,
            "tags": ["root-cause", "regression"],
            "data": {
                "analysis": "Regression in signature field selector after UI refactor",
                "confidence": 0.87,
                "suggested_fix": "Update selector to use data-testid instead of id"
            }
        }
    ]

    inserted = 0
    for i in range(count):
        template = sample_events[i % len(sample_events)]
        event = Event(
            id=f"evt-{uuid.uuid4().hex[:12]}",
            type=template["type"],
            project=project,
            branch="main",
            source=template["source"],
            importance=template["importance"],
            tags=template["tags"],
            data=template["data"]
        )

        if store.ingest(event):
            inserted += 1

    console.print(f"[green]✓[/green] Seeded {inserted}/{count} events")


# =============================================================================
# Memory Journal (Commit) Commands
# =============================================================================

@cli.group()
def commit():
    """Memory commit commands (Git-style)"""
    pass


@commit.command("create")
@click.option("--branch", "-b", default="main", help="Branch to commit to")
@click.option("--message", "-m", required=True, help="Commit message")
@click.option("--author", "-a", default="system", help="Commit author")
@click.option("--event-ids", "-e", multiple=True, help="Event IDs to include (can specify multiple)")
@click.option("--tag", "-t", multiple=True, help="Tags for this commit")
def create_commit(branch: str, message: str, author: str, event_ids: tuple, tag: tuple):
    """Create a memory commit (similar to: git commit -m "message")"""
    from core.memory_journal import MemoryJournalService

    store = EventStore(EVENT_LOG_DB_PATH)
    journal = MemoryJournalService(store)

    if not event_ids:
        console.print("[yellow]⚠[/yellow] No event IDs provided. Use --event-ids or -e")
        return

    try:
        commit_obj = journal.commit(branch, list(event_ids), message, author, list(tag) if tag else None)
        console.print(f"[green]✓[/green] Commit created: {commit_obj.commit_id}")
        console.print(f"  Branch: {commit_obj.branch}")
        console.print(f"  Message: {commit_obj.message}")
        console.print(f"  Events: {len(commit_obj.event_ids)}")
        if commit_obj.tags:
            console.print(f"  Tags: {', '.join(commit_obj.tags)}")
    except Exception as e:
        console.print(f"[red]✗[/red] Failed to create commit: {e}")


@commit.command("list")
@click.option("--branch", "-b", default="main", help="Branch to list commits from")
@click.option("--limit", "-l", default=20, help="Limit results")
def list_commits(branch: str, limit: int):
    """List commit history (similar to: git log)"""
    from core.memory_journal import MemoryJournalService

    store = EventStore(EVENT_LOG_DB_PATH)
    journal = MemoryJournalService(store)

    commits = journal.get_commit_history(branch, limit)

    if not commits:
        console.print(f"[yellow]No commits found on branch '{branch}'[/yellow]")
        return

    table = Table(title=f"Commit History - {branch}")
    table.add_column("Commit ID", style="cyan")
    table.add_column("Message", style="white")
    table.add_column("Author", style="blue")
    table.add_column("Timestamp", style="green")
    table.add_column("Events", justify="right")
    table.add_column("Tags")

    for c in commits:
        table.add_row(
            c.commit_id[:16] + "...",
            c.message[:50] + ("..." if len(c.message) > 50 else ""),
            c.author,
            c.timestamp.strftime("%Y-%m-%d %H:%M") if c.timestamp else "",
            str(len(c.event_ids)),
            ", ".join(c.tags[:2]) if c.tags else ""
        )

    console.print(table)
    console.print(f"\nTotal: {len(commits)} commits")


@commit.command("show")
@click.argument("commit_id")
def show_commit(commit_id: str):
    """Show commit details"""
    from core.memory_journal import MemoryJournalService

    store = EventStore(EVENT_LOG_DB_PATH)
    journal = MemoryJournalService(store)

    commit_obj = journal.get_commit(commit_id)

    if not commit_obj:
        console.print(f"[red]✗[/red] Commit not found: {commit_id}")
        return

    rprint("\n[bold]Commit Details[/bold]")
    rprint(f"ID: {commit_obj.commit_id}")
    rprint(f"Branch: {commit_obj.branch}")
    rprint(f"Message: {commit_obj.message}")
    rprint(f"Author: {commit_obj.author}")
    rprint(f"Timestamp: {commit_obj.timestamp}")
    if commit_obj.parent_commit:
        rprint(f"Parent: {commit_obj.parent_commit}")
    if commit_obj.tags:
        rprint(f"Tags: {', '.join(commit_obj.tags)}")
    rprint(f"\nEvent IDs ({len(commit_obj.event_ids)}):")
    for event_id in commit_obj.event_ids[:10]:
        rprint(f"  - {event_id}")
    if len(commit_obj.event_ids) > 10:
        rprint(f"  ... and {len(commit_obj.event_ids) - 10} more")


# =============================================================================
# Memory Journal (Tag) Commands
# =============================================================================

@cli.group()
def tag():
    """Memory tag commands (Git-style)"""
    pass


@tag.command("create")
@click.argument("tag_name")
@click.argument("commit_id")
@click.option("--message", "-m", required=True, help="Tag message")
def create_tag(tag_name: str, commit_id: str, message: str):
    """Create a tag (similar to: git tag -a <tag> -m "message" <commit>)"""
    from core.memory_journal import MemoryJournalService

    store = EventStore(EVENT_LOG_DB_PATH)
    journal = MemoryJournalService(store)

    try:
        tag_obj = journal.create_tag(tag_name, commit_id, message)
        console.print(f"[green]✓[/green] Tag created: {tag_obj.tag_name}")
        console.print(f"  Commit: {tag_obj.commit_id}")
        console.print(f"  Message: {tag_obj.message}")
    except ValueError as e:
        console.print(f"[red]✗[/red] Failed to create tag: {e}")


@tag.command("list")
def list_tags():
    """List all tags (similar to: git tag -l)"""
    from core.memory_journal import MemoryJournalService

    store = EventStore(EVENT_LOG_DB_PATH)
    journal = MemoryJournalService(store)

    tags = journal.list_tags()

    if not tags:
        console.print("[yellow]No tags found[/yellow]")
        return

    table = Table(title="Memory Tags")
    table.add_column("Tag Name", style="cyan")
    table.add_column("Commit ID", style="magenta")
    table.add_column("Message", style="white")
    table.add_column("Created", style="green")

    for t in tags:
        table.add_row(
            t.tag_name,
            t.commit_id[:16] + "...",
            t.message[:50] + ("..." if len(t.message) > 50 else ""),
            t.created_at.strftime("%Y-%m-%d %H:%M") if t.created_at else ""
        )

    console.print(table)
    console.print(f"\nTotal: {len(tags)} tags")


@tag.command("show")
@click.argument("tag_name")
def show_tag(tag_name: str):
    """Show tag details"""
    from core.memory_journal import MemoryJournalService

    store = EventStore(EVENT_LOG_DB_PATH)
    journal = MemoryJournalService(store)

    tag_obj = journal.get_tag(tag_name)

    if not tag_obj:
        console.print(f"[red]✗[/red] Tag not found: {tag_name}")
        return

    rprint("\n[bold]Tag Details[/bold]")
    rprint(f"Name: {tag_obj.tag_name}")
    rprint(f"Commit: {tag_obj.commit_id}")
    rprint(f"Message: {tag_obj.message}")
    rprint(f"Created: {tag_obj.created_at}")


@tag.command("delete")
@click.argument("tag_name")
def delete_tag_cmd(tag_name: str):
    """Delete a tag (similar to: git tag -d <tag>)"""
    from core.memory_journal import MemoryJournalService

    store = EventStore(EVENT_LOG_DB_PATH)
    journal = MemoryJournalService(store)

    success = journal.delete_tag(tag_name)

    if success:
        console.print(f"[green]✓[/green] Tag deleted: {tag_name}")
    else:
        console.print(f"[red]✗[/red] Tag not found: {tag_name}")


# =============================================================================
# Roll-up Summaries (LLM-Enhanced)
# =============================================================================

@cli.group()
def rollup():
    """Roll-up summary commands (LLM-enhanced)"""
    pass


@rollup.command("daily")
@click.option("--project", "-p", required=True, help="Project name")
@click.option("--date", "-d", required=True, help="Date (YYYY-MM-DD)")
@click.option("--branch", "-b", default="main", help="Memory branch")
@click.option("--no-llm", is_flag=True, help="Disable LLM (use simple summaries)")
def generate_daily_rollup(project: str, date: str, branch: str, no_llm: bool):
    """Generate daily rollup summary"""
    import asyncio
    from datetime import datetime
    from core.roll_ups import RollUpService
    from services.llm_service import get_llm_service

    store = EventStore(EVENT_LOG_DB_PATH)
    llm_service = None if no_llm else get_llm_service()
    rollup_service = RollUpService(
        event_store=store,
        llm_service=llm_service,
        enable_llm=not no_llm
    )

    date_obj = datetime.fromisoformat(date)

    async def run():
        rollup = await rollup_service.generate_daily_rollup_async(
            project=project,
            date=date_obj,
            branch=branch,
            use_llm=not no_llm
        )

        rprint(f"\n[bold]Daily Rollup: {rollup['project']} - {rollup['date']}[/bold]")
        rprint(f"Branch: {rollup['branch']}")
        rprint(f"Total Events: {rollup['total_events']}")

        if rollup['total_events'] > 0:
            stats = rollup['statistics']
            rprint(f"\n[bold]Statistics:[/bold]")
            rprint(f"  Average Importance: {stats['avg_importance']:.2f}/5.0")
            rprint(f"  High-Importance Events: {stats['high_importance_count']}")

            rprint(f"\n[bold]Event Types:[/bold]")
            for event_type, count in sorted(stats['by_type'].items(), key=lambda x: x[1], reverse=True)[:5]:
                rprint(f"  {event_type}: {count}")

            if 'narrative_summary' in rollup and rollup['narrative_summary']:
                rprint(f"\n[bold]Narrative Summary:[/bold]")
                rprint(f"{rollup['narrative_summary']}")
            else:
                rprint(f"\n[bold]Summary:[/bold]")
                rprint(f"{rollup['summary']}")

    asyncio.run(run())


@rollup.command("weekly")
@click.option("--project", "-p", required=True, help="Project name")
@click.option("--week-start", "-w", required=True, help="Week start date (YYYY-MM-DD)")
@click.option("--branch", "-b", default="main", help="Memory branch")
@click.option("--no-llm", is_flag=True, help="Disable LLM (use simple summaries)")
def generate_weekly_rollup(project: str, week_start: str, branch: str, no_llm: bool):
    """Generate weekly rollup summary"""
    import asyncio
    from datetime import datetime
    from core.roll_ups import RollUpService
    from services.llm_service import get_llm_service

    store = EventStore(EVENT_LOG_DB_PATH)
    llm_service = None if no_llm else get_llm_service()
    rollup_service = RollUpService(
        event_store=store,
        llm_service=llm_service,
        enable_llm=not no_llm
    )

    week_start_obj = datetime.fromisoformat(week_start)

    async def run():
        rollup = await rollup_service.generate_weekly_rollup_async(
            project=project,
            week_start=week_start_obj,
            branch=branch,
            use_llm=not no_llm
        )

        rprint(f"\n[bold]Weekly Rollup: {rollup['project']}[/bold]")
        rprint(f"Week: {rollup['week_start']} to {rollup['week_end']}")
        rprint(f"Branch: {rollup['branch']}")
        rprint(f"Total Events: {rollup['total_events']}")

        if rollup['total_events'] > 0:
            stats = rollup['statistics']
            trends = rollup['trends']

            rprint(f"\n[bold]Statistics:[/bold]")
            rprint(f"  Average Importance: {stats['avg_importance']:.2f}/5.0")
            rprint(f"  High-Importance Events: {stats['high_importance_count']}")

            rprint(f"\n[bold]Trends:[/bold]")
            rprint(f"  Increasing Failures: {'⚠️ Yes' if trends['increasing_failures'] else 'No'}")
            rprint(f"  Recurring Issues: {len(trends['recurring_issues'])}")

            if 'narrative_summary' in rollup and rollup['narrative_summary']:
                rprint(f"\n[bold]Narrative Summary:[/bold]")
                rprint(f"{rollup['narrative_summary']}")
            else:
                rprint(f"\n[bold]Summary:[/bold]")
                rprint(f"{rollup['summary']}")

    asyncio.run(run())


@rollup.command("pattern")
@click.option("--project", "-p", required=True, help="Project name")
@click.option("--tag", "-t", required=True, help="Pattern tag (e.g., 'timeout', 'selector-failure')")
@click.option("--branch", "-b", default="main", help="Memory branch")
@click.option("--days", "-d", default=30, help="Number of days to analyze")
@click.option("--no-llm", is_flag=True, help="Disable LLM (use simple summaries)")
def analyze_pattern(project: str, tag: str, branch: str, days: int, no_llm: bool):
    """Analyze failure pattern"""
    import asyncio
    from core.roll_ups import RollUpService
    from services.llm_service import get_llm_service

    store = EventStore(EVENT_LOG_DB_PATH)
    llm_service = None if no_llm else get_llm_service()
    rollup_service = RollUpService(
        event_store=store,
        llm_service=llm_service,
        enable_llm=not no_llm
    )

    async def run():
        analysis = await rollup_service.analyze_failure_pattern_async(
            project=project,
            pattern_tag=tag,
            branch=branch,
            days=days,
            use_llm=not no_llm
        )

        rprint(f"\n[bold]Pattern Analysis: {analysis['pattern']}[/bold]")
        rprint(f"Project: {analysis['project']}")
        rprint(f"Analysis Period: {analysis['days']} days")
        rprint(f"Total Occurrences: {analysis['total_occurrences']}")

        if analysis['total_occurrences'] > 0:
            rprint(f"\n[bold]Affected Sources:[/bold]")
            for source, count in sorted(analysis['affected_sources'].items(), key=lambda x: x[1], reverse=True)[:10]:
                rprint(f"  {source}: {count}")

            if 'narrative_analysis' in analysis and analysis['narrative_analysis']:
                rprint(f"\n[bold]Narrative Analysis:[/bold]")
                rprint(f"{analysis['narrative_analysis']}")
            else:
                rprint(f"\n[bold]Summary:[/bold]")
                rprint(f"{analysis['summary']}")

    asyncio.run(run())


# =============================================================================
# Memory Journal Statistics
# =============================================================================

@cli.command("journal")
def journal_stats():
    """Show memory journal statistics"""
    from core.memory_journal import MemoryJournalService

    store = EventStore(EVENT_LOG_DB_PATH)
    journal = MemoryJournalService(store)

    stats = journal.get_journal_stats()

    rprint("\n[bold]Memory Journal Statistics[/bold]\n")
    rprint(f"Total Branches: {stats['total_branches']}")
    rprint(f"Total Commits: {stats['total_commits']}")
    rprint(f"Total Tags: {stats['total_tags']}")

    if stats['commits_by_branch']:
        rprint("\n[bold]Commits by Branch:[/bold]")
        for branch, count in stats['commits_by_branch'].items():
            rprint(f"  {branch}: {count}")

    rprint(f"\nRecent Commits (7 days): {stats['recent_commits_7d']}")

    rprint("\n[bold]Branches:[/bold]")
    for branch in stats['branches']:
        head = branch['head'] if branch['head'] else '(empty)'
        rprint(f"  {branch['name']}: {head}")


# =============================================================================
# Main Entry Point
# =============================================================================

if __name__ == "__main__":
    cli()
