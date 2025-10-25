"""
LLM Service for Narrative Summarization
Integrates with LM Studio (Qwen 2.5 32B) for intelligent event summarization
"""

import httpx
import os
from typing import List, Dict, Any, Optional
from datetime import datetime
import json

from core.models import Event, EventType


class LLMService:
    """
    LLM Service for generating narrative summaries of events

    Integrates with LM Studio API (OpenAI-compatible endpoint)
    Model: Qwen 2.5 32B Instruct
    """

    def __init__(
        self,
        base_url: str = "http://localhost:1234/v1",
        model: str = "qwen2.5-32b-instruct",
        timeout: int = 60
    ):
        self.base_url = base_url
        self.model = model
        self.timeout = timeout
        self.client = httpx.AsyncClient(timeout=timeout)

    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()

    # ==========================================================================
    # Core LLM Operations
    # ==========================================================================

    async def generate_completion(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 1000
    ) -> str:
        """
        Generate completion using LM Studio API

        Args:
            messages: List of chat messages [{"role": "user", "content": "..."}]
            temperature: Sampling temperature (0.0-1.0)
            max_tokens: Maximum tokens to generate

        Returns:
            Generated text
        """
        try:
            response = await self.client.post(
                f"{self.base_url}/chat/completions",
                json={
                    "model": self.model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens
                }
            )
            response.raise_for_status()

            result = response.json()
            return result["choices"][0]["message"]["content"]

        except httpx.HTTPError as e:
            # Graceful degradation - return empty string on failure
            print(f"[LLMService] API error: {e}")
            return ""
        except Exception as e:
            print(f"[LLMService] Unexpected error: {e}")
            return ""

    async def check_health(self) -> bool:
        """Check if LM Studio is available"""
        try:
            response = await self.client.get(f"{self.base_url}/models", timeout=5.0)
            return response.status_code == 200
        except:
            return False

    # ==========================================================================
    # Event Summarization
    # ==========================================================================

    async def summarize_daily_events(
        self,
        events: List[Event],
        stats: Dict[str, Any],
        project: str,
        date: datetime
    ) -> str:
        """
        Generate narrative summary for daily events

        Args:
            events: List of events for the day
            stats: Statistical aggregation from RollUpService
            project: Project name
            date: Date for the summary

        Returns:
            Narrative summary (2-3 paragraphs)
        """
        if not events:
            return "No activity recorded for this day."

        # Format context for LLM
        context = self._format_daily_context(events, stats, project, date)

        system_prompt = """You are a QA Intelligence analyst summarizing daily testing activity.
Generate a concise, actionable 2-3 paragraph summary highlighting:
- Overall activity level and key metrics
- Notable failures, patterns, or anomalies
- High-impact events requiring attention
- Trends or improvements observed

Be specific, data-driven, and focus on actionable insights."""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": context}
        ]

        summary = await self.generate_completion(
            messages,
            temperature=0.3,  # Lower temp for more focused summaries
            max_tokens=500
        )

        return summary if summary else self._fallback_daily_summary(stats)

    async def summarize_weekly_events(
        self,
        events: List[Event],
        stats: Dict[str, Any],
        trends: Dict[str, Any],
        project: str,
        week_start: datetime
    ) -> str:
        """
        Generate narrative summary for weekly events

        Args:
            events: List of events for the week
            stats: Statistical aggregation
            trends: Trend analysis from RollUpService
            project: Project name
            week_start: Start date of the week

        Returns:
            Narrative summary (3-4 paragraphs)
        """
        if not events:
            return "No activity recorded for this week."

        context = self._format_weekly_context(events, stats, trends, project, week_start)

        system_prompt = """You are a QA Intelligence analyst summarizing weekly testing activity.
Generate a comprehensive 3-4 paragraph summary covering:
- Weekly overview: volume, success rate, key metrics
- Trend analysis: patterns, recurring issues, improvements
- Critical failures and their impact
- Recommendations for the upcoming week

Be analytical, data-driven, and provide actionable strategic insights."""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": context}
        ]

        summary = await self.generate_completion(
            messages,
            temperature=0.4,
            max_tokens=800
        )

        return summary if summary else self._fallback_weekly_summary(stats, trends)

    async def summarize_failure_pattern(
        self,
        failures: List[Event],
        pattern_type: str
    ) -> str:
        """
        Generate summary for a specific failure pattern

        Args:
            failures: Events matching the pattern
            pattern_type: Type of pattern (e.g., "timeout", "selector-failure")

        Returns:
            Pattern analysis summary
        """
        if not failures:
            return f"No failures found for pattern: {pattern_type}"

        context = self._format_pattern_context(failures, pattern_type)

        system_prompt = """You are a QA analyst analyzing recurring failure patterns.
Provide a concise analysis including:
- Root cause hypothesis
- Affected areas/tests
- Suggested remediation steps
- Priority/urgency assessment

Be technical, specific, and actionable."""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": context}
        ]

        summary = await self.generate_completion(
            messages,
            temperature=0.2,  # Very low temp for focused analysis
            max_tokens=400
        )

        return summary if summary else f"Pattern detected: {pattern_type} ({len(failures)} occurrences)"

    # ==========================================================================
    # Context Formatting
    # ==========================================================================

    def _format_daily_context(
        self,
        events: List[Event],
        stats: Dict[str, Any],
        project: str,
        date: datetime
    ) -> str:
        """Format daily events into LLM-friendly context"""
        lines = [
            f"# Daily Activity Summary: {project}",
            f"Date: {date.date().isoformat()}",
            f"",
            f"## Metrics",
            f"- Total Events: {stats['total_events']}",
            f"- Average Importance: {stats['avg_importance']:.2f}/5.0",
            f"- High-Importance Events: {stats['high_importance_count']}",
            f"",
            f"## Event Distribution",
        ]

        # Event types breakdown
        for event_type, count in sorted(stats['by_type'].items(), key=lambda x: x[1], reverse=True):
            lines.append(f"- {event_type}: {count}")

        lines.append("")
        lines.append("## Top Tags")
        for tag, count in sorted(stats['by_tag'].items(), key=lambda x: x[1], reverse=True)[:10]:
            lines.append(f"- {tag}: {count}")

        # High-impact events
        lines.append("")
        lines.append("## High-Impact Events (Top 5)")
        high_impact = sorted(events, key=lambda e: e.importance, reverse=True)[:5]
        for event in high_impact:
            lines.append(f"- [{event.type.value}] {event.source} (importance: {event.importance:.1f})")
            if event.tags:
                lines.append(f"  Tags: {', '.join(event.tags[:5])}")

        return "\n".join(lines)

    def _format_weekly_context(
        self,
        events: List[Event],
        stats: Dict[str, Any],
        trends: Dict[str, Any],
        project: str,
        week_start: datetime
    ) -> str:
        """Format weekly events into LLM-friendly context"""
        week_end = week_start.replace(hour=0, minute=0, second=0, microsecond=0)

        lines = [
            f"# Weekly Activity Summary: {project}",
            f"Week: {week_start.date().isoformat()} - {week_end.date().isoformat()}",
            f"",
            f"## Metrics",
            f"- Total Events: {stats['total_events']}",
            f"- Average Importance: {stats['avg_importance']:.2f}/5.0",
            f"- High-Importance Events: {stats['high_importance_count']}",
            f"",
            f"## Trends",
            f"- Increasing Failures: {'Yes ⚠️' if trends['increasing_failures'] else 'No'}",
            f"- Recurring Issues: {len(trends['recurring_issues'])}",
            f"",
        ]

        if trends['recurring_issues']:
            lines.append("### Recurring Issues")
            for issue in trends['recurring_issues'][:5]:
                lines.append(f"- {issue['tag']}: {issue['count']} occurrences")
            lines.append("")

        # Event types
        lines.append("## Event Distribution")
        for event_type, count in sorted(stats['by_type'].items(), key=lambda x: x[1], reverse=True):
            lines.append(f"- {event_type}: {count}")

        # Failures breakdown
        failures = [e for e in events if e.type == EventType.TEST_FAILURE]
        if failures:
            lines.append("")
            lines.append(f"## Failures Analysis ({len(failures)} total)")
            failure_tags = {}
            for f in failures:
                for tag in f.tags:
                    failure_tags[tag] = failure_tags.get(tag, 0) + 1

            for tag, count in sorted(failure_tags.items(), key=lambda x: x[1], reverse=True)[:5]:
                lines.append(f"- {tag}: {count}")

        return "\n".join(lines)

    def _format_pattern_context(
        self,
        failures: List[Event],
        pattern_type: str
    ) -> str:
        """Format failure pattern into LLM-friendly context"""
        lines = [
            f"# Failure Pattern Analysis: {pattern_type}",
            f"",
            f"## Overview",
            f"- Total Occurrences: {len(failures)}",
            f"- Time Range: {failures[-1].timestamp.isoformat()} to {failures[0].timestamp.isoformat()}",
            f"",
            f"## Affected Sources",
        ]

        sources = {}
        for f in failures:
            sources[f.source] = sources.get(f.source, 0) + 1

        for source, count in sorted(sources.items(), key=lambda x: x[1], reverse=True)[:5]:
            lines.append(f"- {source}: {count}")

        lines.append("")
        lines.append("## Common Tags")

        tags = {}
        for f in failures:
            for tag in f.tags:
                tags[tag] = tags.get(tag, 0) + 1

        for tag, count in sorted(tags.items(), key=lambda x: x[1], reverse=True)[:10]:
            lines.append(f"- {tag}: {count}")

        # Sample recent failures
        lines.append("")
        lines.append("## Recent Examples (Last 3)")
        for failure in failures[:3]:
            lines.append(f"- [{failure.timestamp.isoformat()}] {failure.source}")
            lines.append(f"  Tags: {', '.join(failure.tags[:5])}")

        return "\n".join(lines)

    # ==========================================================================
    # Fallback Summaries (when LLM unavailable)
    # ==========================================================================

    def _fallback_daily_summary(self, stats: Dict[str, Any]) -> str:
        """Generate simple text summary without LLM"""
        total = stats['total_events']
        high_importance = stats['high_importance_count']

        summary_parts = [
            f"Recorded {total} events today.",
        ]

        if high_importance > 0:
            summary_parts.append(f"Includes {high_importance} high-importance events requiring attention.")

        if stats['by_type']:
            most_common = max(stats['by_type'].items(), key=lambda x: x[1])
            summary_parts.append(f"Most common event type: {most_common[0]} ({most_common[1]} occurrences).")

        return " ".join(summary_parts)

    def _fallback_weekly_summary(self, stats: Dict[str, Any], trends: Dict[str, Any]) -> str:
        """Generate simple text summary without LLM"""
        total = stats['total_events']

        summary_parts = [
            f"Recorded {total} events this week.",
        ]

        if trends['increasing_failures']:
            summary_parts.append("⚠️ Warning: Increasing failure rate detected.")

        if trends['recurring_issues']:
            count = len(trends['recurring_issues'])
            summary_parts.append(f"Identified {count} recurring issues requiring investigation.")

        avg_importance = stats['avg_importance']
        summary_parts.append(f"Average event importance: {avg_importance:.2f}/5.0.")

        return " ".join(summary_parts)


# Singleton instance
_llm_service_instance: Optional[LLMService] = None


def get_llm_service(
    base_url: Optional[str] = None,
    model: Optional[str] = None
) -> LLMService:
    """Get singleton LLM service instance"""
    global _llm_service_instance

    if _llm_service_instance is None:
        base_url = base_url or os.getenv("LM_STUDIO_URL", "http://localhost:1234/v1")
        model = model or os.getenv("LLM_MODEL", "qwen2.5-32b-instruct")
        _llm_service_instance = LLMService(base_url=base_url, model=model)

    return _llm_service_instance
