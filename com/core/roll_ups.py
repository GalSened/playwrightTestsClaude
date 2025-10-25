"""
Roll-up Summary Service
Generates daily/weekly/monthly summaries of events for efficient context retrieval

Enhanced with LLM-powered narrative summarization using LM Studio (Qwen 2.5 32B)
"""

from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from collections import defaultdict
import asyncio

from storage.event_store import EventStore
from core.models import Event, EventType
from services.llm_service import LLMService, get_llm_service


class RollUpService:
    """
    Generates roll-up summaries of events for efficient historical context

    Features:
    - Daily/weekly/monthly aggregations
    - Statistical summaries
    - Pattern detection
    - LLM-powered narrative summaries (with graceful fallback)
    """

    def __init__(
        self,
        event_store: EventStore,
        llm_service: Optional[LLMService] = None,
        enable_llm: bool = True
    ):
        self.event_store = event_store
        self.llm_service = llm_service or (get_llm_service() if enable_llm else None)
        self.enable_llm = enable_llm

    # ==========================================================================
    # Daily Roll-ups
    # ==========================================================================

    def generate_daily_rollup(
        self,
        project: str,
        date: datetime,
        branch: str = 'main'
    ) -> Dict[str, Any]:
        """
        Generate daily summary of events

        Returns statistical aggregation and key highlights
        """
        # Get events for the day
        start_of_day = date.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = start_of_day + timedelta(days=1)

        events = self.event_store.query_events(
            project=project,
            branch=branch,
            limit=10000  # Large limit to get all events for the day
        )

        # Filter by date
        day_events = [
            e for e in events
            if start_of_day <= e.timestamp < end_of_day
        ]

        if not day_events:
            return {
                'date': date.date().isoformat(),
                'project': project,
                'branch': branch,
                'total_events': 0,
                'summary': 'No activity'
            }

        # Aggregate statistics
        stats = self._aggregate_events(day_events)

        # Identify key events
        key_events = self._identify_key_events(day_events)

        return {
            'date': date.date().isoformat(),
            'project': project,
            'branch': branch,
            'total_events': len(day_events),
            'statistics': stats,
            'key_events': key_events,
            'summary': self._generate_daily_summary(stats, key_events)
        }

    async def generate_daily_rollup_async(
        self,
        project: str,
        date: datetime,
        branch: str = 'main',
        use_llm: bool = True
    ) -> Dict[str, Any]:
        """
        Generate daily summary with LLM-powered narrative

        Args:
            project: Project name
            date: Date for the summary
            branch: Memory branch
            use_llm: Use LLM for narrative summary (falls back to simple summary)

        Returns:
            Daily rollup with narrative summary
        """
        # Get events for the day
        start_of_day = date.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = start_of_day + timedelta(days=1)

        events = self.event_store.query_events(
            project=project,
            branch=branch,
            limit=10000
        )

        # Filter by date
        day_events = [
            e for e in events
            if start_of_day <= e.timestamp < end_of_day
        ]

        if not day_events:
            return {
                'date': date.date().isoformat(),
                'project': project,
                'branch': branch,
                'total_events': 0,
                'summary': 'No activity',
                'narrative_summary': 'No testing activity recorded for this day.'
            }

        # Aggregate statistics
        stats = self._aggregate_events(day_events)

        # Identify key events
        key_events = self._identify_key_events(day_events)

        # Generate narrative summary with LLM (if enabled and available)
        narrative_summary = None
        if use_llm and self.enable_llm and self.llm_service:
            try:
                narrative_summary = await self.llm_service.summarize_daily_events(
                    day_events,
                    stats,
                    project,
                    date
                )
            except Exception as e:
                print(f"[RollUpService] LLM summarization failed: {e}")
                # Will fall back to simple summary

        return {
            'date': date.date().isoformat(),
            'project': project,
            'branch': branch,
            'total_events': len(day_events),
            'statistics': stats,
            'key_events': key_events,
            'summary': self._generate_daily_summary(stats, key_events),
            'narrative_summary': narrative_summary or self._generate_daily_summary(stats, key_events)
        }

    def generate_weekly_rollup(
        self,
        project: str,
        week_start: datetime,
        branch: str = 'main'
    ) -> Dict[str, Any]:
        """
        Generate weekly summary of events

        Aggregates daily roll-ups for the week
        """
        week_end = week_start + timedelta(days=7)

        events = self.event_store.query_events(
            project=project,
            branch=branch,
            limit=50000
        )

        # Filter by week
        week_events = [
            e for e in events
            if week_start <= e.timestamp < week_end
        ]

        if not week_events:
            return {
                'week_start': week_start.date().isoformat(),
                'week_end': week_end.date().isoformat(),
                'project': project,
                'branch': branch,
                'total_events': 0,
                'summary': 'No activity this week'
            }

        # Aggregate statistics
        stats = self._aggregate_events(week_events)

        # Identify trends
        trends = self._identify_trends(week_events)

        return {
            'week_start': week_start.date().isoformat(),
            'week_end': week_end.date().isoformat(),
            'project': project,
            'branch': branch,
            'total_events': len(week_events),
            'statistics': stats,
            'trends': trends,
            'summary': self._generate_weekly_summary(stats, trends)
        }

    async def generate_weekly_rollup_async(
        self,
        project: str,
        week_start: datetime,
        branch: str = 'main',
        use_llm: bool = True
    ) -> Dict[str, Any]:
        """
        Generate weekly summary with LLM-powered narrative

        Args:
            project: Project name
            week_start: Start date of the week
            branch: Memory branch
            use_llm: Use LLM for narrative summary

        Returns:
            Weekly rollup with narrative summary
        """
        week_end = week_start + timedelta(days=7)

        events = self.event_store.query_events(
            project=project,
            branch=branch,
            limit=50000
        )

        # Filter by week
        week_events = [
            e for e in events
            if week_start <= e.timestamp < week_end
        ]

        if not week_events:
            return {
                'week_start': week_start.date().isoformat(),
                'week_end': week_end.date().isoformat(),
                'project': project,
                'branch': branch,
                'total_events': 0,
                'summary': 'No activity this week',
                'narrative_summary': 'No testing activity recorded for this week.'
            }

        # Aggregate statistics
        stats = self._aggregate_events(week_events)

        # Identify trends
        trends = self._identify_trends(week_events)

        # Generate narrative summary with LLM (if enabled and available)
        narrative_summary = None
        if use_llm and self.enable_llm and self.llm_service:
            try:
                narrative_summary = await self.llm_service.summarize_weekly_events(
                    week_events,
                    stats,
                    trends,
                    project,
                    week_start
                )
            except Exception as e:
                print(f"[RollUpService] LLM summarization failed: {e}")

        return {
            'week_start': week_start.date().isoformat(),
            'week_end': week_end.date().isoformat(),
            'project': project,
            'branch': branch,
            'total_events': len(week_events),
            'statistics': stats,
            'trends': trends,
            'summary': self._generate_weekly_summary(stats, trends),
            'narrative_summary': narrative_summary or self._generate_weekly_summary(stats, trends)
        }

    async def analyze_failure_pattern_async(
        self,
        project: str,
        pattern_tag: str,
        branch: str = 'main',
        days: int = 30,
        use_llm: bool = True
    ) -> Dict[str, Any]:
        """
        Analyze a specific failure pattern with LLM insights

        Args:
            project: Project name
            pattern_tag: Tag identifying the pattern (e.g., 'timeout', 'selector-failure')
            branch: Memory branch
            days: Number of days to analyze
            use_llm: Use LLM for pattern analysis

        Returns:
            Pattern analysis with narrative insights
        """
        # Get failures with the pattern tag
        cutoff_date = datetime.now() - timedelta(days=days)

        events = self.event_store.query_events(
            project=project,
            branch=branch,
            event_types=[EventType.TEST_FAILURE],
            tags_include=[pattern_tag],
            limit=1000
        )

        # Filter by date
        pattern_failures = [
            e for e in events
            if e.timestamp >= cutoff_date
        ]

        if not pattern_failures:
            return {
                'pattern': pattern_tag,
                'project': project,
                'days': days,
                'total_occurrences': 0,
                'summary': f'No failures found for pattern: {pattern_tag}',
                'narrative_analysis': None
            }

        # Basic statistics
        sources = {}
        for failure in pattern_failures:
            sources[failure.source] = sources.get(failure.source, 0) + 1

        # Generate narrative analysis with LLM
        narrative_analysis = None
        if use_llm and self.enable_llm and self.llm_service:
            try:
                narrative_analysis = await self.llm_service.summarize_failure_pattern(
                    pattern_failures,
                    pattern_tag
                )
            except Exception as e:
                print(f"[RollUpService] LLM pattern analysis failed: {e}")

        return {
            'pattern': pattern_tag,
            'project': project,
            'days': days,
            'total_occurrences': len(pattern_failures),
            'affected_sources': sources,
            'date_range': {
                'start': min(f.timestamp for f in pattern_failures).isoformat(),
                'end': max(f.timestamp for f in pattern_failures).isoformat()
            },
            'summary': f'Pattern "{pattern_tag}" detected {len(pattern_failures)} times across {len(sources)} sources',
            'narrative_analysis': narrative_analysis
        }

    # ==========================================================================
    # Aggregation Helpers
    # ==========================================================================

    def _aggregate_events(self, events: List[Event]) -> Dict[str, Any]:
        """Aggregate event statistics"""
        stats = {
            'by_type': defaultdict(int),
            'by_source': defaultdict(int),
            'by_tag': defaultdict(int),
            'total_events': len(events),
            'avg_importance': 0.0,
            'high_importance_count': 0  # importance > 3.0
        }

        total_importance = 0.0

        for event in events:
            # Count by type
            stats['by_type'][event.type.value] += 1

            # Count by source
            stats['by_source'][event.source] += 1

            # Count by tags
            for tag in event.tags:
                stats['by_tag'][tag] += 1

            # Importance
            total_importance += event.importance
            if event.importance > 3.0:
                stats['high_importance_count'] += 1

        if events:
            stats['avg_importance'] = total_importance / len(events)

        # Convert defaultdicts to regular dicts
        stats['by_type'] = dict(stats['by_type'])
        stats['by_source'] = dict(stats['by_source'])
        stats['by_tag'] = dict(stats['by_tag'])

        return stats

    def _identify_key_events(self, events: List[Event], limit: int = 10) -> List[Dict[str, Any]]:
        """Identify most important events"""
        # Sort by importance
        sorted_events = sorted(events, key=lambda e: e.importance, reverse=True)

        return [
            {
                'id': e.id,
                'type': e.type.value,
                'timestamp': e.timestamp.isoformat(),
                'source': e.source,
                'importance': e.importance,
                'tags': e.tags,
                'summary': self._event_summary(e)
            }
            for e in sorted_events[:limit]
        ]

    def _identify_trends(self, events: List[Event]) -> Dict[str, Any]:
        """Identify trends in events over time"""
        trends = {
            'increasing_failures': False,
            'new_patterns': [],
            'recurring_issues': []
        }

        # Count failures
        failures = [e for e in events if e.type == EventType.TEST_FAILURE]
        failure_rate = len(failures) / len(events) if events else 0

        if failure_rate > 0.3:
            trends['increasing_failures'] = True

        # Detect recurring tags
        tag_counts = defaultdict(int)
        for event in events:
            for tag in event.tags:
                tag_counts[tag] += 1

        # Tags that appear frequently (>5 times) are recurring issues
        for tag, count in tag_counts.items():
            if count > 5:
                trends['recurring_issues'].append({
                    'tag': tag,
                    'count': count
                })

        return trends

    def _event_summary(self, event: Event) -> str:
        """Generate brief summary of an event"""
        summaries = {
            EventType.TEST_FAILURE: f"Test failure: {event.data.get('test_id', 'unknown')}",
            EventType.CODE_CHANGE: f"Code change in {len(event.data.get('files', []))} files",
            EventType.AGENT_ACTION: f"Agent action: {event.data.get('action', 'analysis')}",
            EventType.DEPLOYMENT: f"Deployment to {event.data.get('environment', 'unknown')}"
        }

        return summaries.get(event.type, f"{event.type.value} event")

    def _generate_daily_summary(self, stats: Dict[str, Any], key_events: List[Dict]) -> str:
        """Generate human-readable daily summary"""
        total = stats['total_events']
        high_importance = stats['high_importance_count']

        summary_parts = [
            f"{total} events recorded.",
        ]

        if high_importance > 0:
            summary_parts.append(f"{high_importance} high-importance events.")

        # Most common event type
        if stats['by_type']:
            most_common_type = max(stats['by_type'].items(), key=lambda x: x[1])
            summary_parts.append(f"Most common: {most_common_type[0]} ({most_common_type[1]} occurrences).")

        # Top tags
        if stats['by_tag']:
            top_tags = sorted(stats['by_tag'].items(), key=lambda x: x[1], reverse=True)[:3]
            tag_summary = ", ".join([f"{tag} ({count})" for tag, count in top_tags])
            summary_parts.append(f"Top tags: {tag_summary}.")

        return " ".join(summary_parts)

    def _generate_weekly_summary(self, stats: Dict[str, Any], trends: Dict[str, Any]) -> str:
        """Generate human-readable weekly summary"""
        total = stats['total_events']

        summary_parts = [
            f"{total} events this week.",
        ]

        if trends['increasing_failures']:
            summary_parts.append("⚠ Increasing failure rate detected.")

        if trends['recurring_issues']:
            recurring_count = len(trends['recurring_issues'])
            summary_parts.append(f"{recurring_count} recurring issues identified.")

        # Average importance
        avg_importance = stats['avg_importance']
        summary_parts.append(f"Average importance: {avg_importance:.2f}/5.0.")

        return " ".join(summary_parts)

    # ==========================================================================
    # Storage (Future: Store roll-ups as events for retrieval)
    # ==========================================================================

    def store_rollup(
        self,
        rollup_data: Dict[str, Any],
        rollup_type: str  # 'daily', 'weekly', 'monthly'
    ) -> str:
        """
        Store roll-up as a special event for future retrieval

        Returns: event_id of the stored roll-up
        """
        import uuid

        rollup_event = Event(
            id=f"rollup-{rollup_type}-{uuid.uuid4().hex[:12]}",
            type=EventType.SYSTEM_EVENT,
            project=rollup_data['project'],
            branch=rollup_data.get('branch', 'main'),
            source='RollUpService',
            importance=2.0,  # Moderate importance
            tags=['rollup', f'rollup-{rollup_type}'],
            data=rollup_data
        )

        self.event_store.ingest(rollup_event)

        return rollup_event.id

    def get_rollups(
        self,
        project: str,
        rollup_type: str,
        branch: str = 'main',
        limit: int = 30
    ) -> List[Dict[str, Any]]:
        """
        Retrieve stored roll-ups

        Args:
            project: Project name
            rollup_type: 'daily', 'weekly', or 'monthly'
            branch: Memory branch
            limit: Maximum number of roll-ups to retrieve
        """
        events = self.event_store.query_events(
            project=project,
            branch=branch,
            tags_include=[f'rollup-{rollup_type}'],
            limit=limit
        )

        return [event.data for event in events]
