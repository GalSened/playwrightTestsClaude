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
# Main Entry Point
# =============================================================================

if __name__ == "__main__":
    cli()
