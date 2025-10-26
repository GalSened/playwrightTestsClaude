"""
Flaky Test Registry
Tracks flaky tests, their manifestations, and healing attempts with memory journal integration
"""

from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict
from enum import Enum
import uuid

from core.models import Event, EventType
from storage.event_store import EventStore
from core.memory_journal import MemoryJournalService


class FlakinessLevel(str, Enum):
    """Classification of flakiness severity"""
    INTERMITTENT = "intermittent"  # < 25% failure rate
    MODERATE = "moderate"          # 25-50% failure rate
    HIGH = "high"                  # 50-75% failure rate
    SEVERE = "severe"              # > 75% failure rate


class FlakyTestStatus(str, Enum):
    """Status of flaky test investigation"""
    DETECTED = "detected"          # Just detected
    INVESTIGATING = "investigating"  # Under investigation
    HEALING_ATTEMPTED = "healing_attempted"  # Healing in progress
    HEALED = "healed"              # Successfully healed
    QUARANTINED = "quarantined"    # Disabled/quarantined
    FALSE_POSITIVE = "false_positive"  # Not actually flaky


class FlakyTestRecord:
    """Record of a flaky test"""

    def __init__(
        self,
        test_id: str,
        test_name: str,
        first_detected: datetime,
        flakiness_level: FlakinessLevel,
        status: FlakyTestStatus,
        failure_count: int = 0,
        success_count: int = 0,
        manifestations: Optional[List[str]] = None,
        healing_attempts: Optional[List[Dict[str, Any]]] = None,
        tags: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ):
        self.test_id = test_id
        self.test_name = test_name
        self.first_detected = first_detected
        self.last_seen = first_detected
        self.flakiness_level = flakiness_level
        self.status = status
        self.failure_count = failure_count
        self.success_count = success_count
        self.manifestations = manifestations or []
        self.healing_attempts = healing_attempts or []
        self.tags = tags or []
        self.metadata = metadata or {}

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for storage"""
        return {
            'test_id': self.test_id,
            'test_name': self.test_name,
            'first_detected': self.first_detected.isoformat(),
            'last_seen': self.last_seen.isoformat(),
            'flakiness_level': self.flakiness_level.value,
            'status': self.status.value,
            'failure_count': self.failure_count,
            'success_count': self.success_count,
            'failure_rate': self.failure_rate,
            'manifestations': self.manifestations,
            'healing_attempts': self.healing_attempts,
            'tags': self.tags,
            'metadata': self.metadata
        }

    @property
    def failure_rate(self) -> float:
        """Calculate failure rate"""
        total = self.failure_count + self.success_count
        return self.failure_count / total if total > 0 else 0.0

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'FlakyTestRecord':
        """Create from dictionary"""
        return cls(
            test_id=data['test_id'],
            test_name=data['test_name'],
            first_detected=datetime.fromisoformat(data['first_detected']),
            flakiness_level=FlakinessLevel(data['flakiness_level']),
            status=FlakyTestStatus(data['status']),
            failure_count=data.get('failure_count', 0),
            success_count=data.get('success_count', 0),
            manifestations=data.get('manifestations', []),
            healing_attempts=data.get('healing_attempts', []),
            tags=data.get('tags', []),
            metadata=data.get('metadata', {})
        )


class FlakyRegistry:
    """
    Flaky Test Registry with Memory Journal Integration

    Features:
    - Detect flaky tests from failure patterns
    - Track manifestations (different ways tests fail)
    - Record healing attempts and success rates
    - Integrate with memory journal for versioning
    - Generate flakiness reports
    """

    def __init__(
        self,
        event_store: EventStore,
        memory_journal: MemoryJournalService,
        branch: str = "main"
    ):
        self.event_store = event_store
        self.memory_journal = memory_journal
        self.branch = branch

        # In-memory cache (in production, use Redis or similar)
        self._registry_cache: Dict[str, FlakyTestRecord] = {}

    # ==========================================================================
    # Flaky Test Detection
    # ==========================================================================

    def detect_flaky_tests(
        self,
        project: str,
        days: int = 30,
        min_executions: int = 5,
        flakiness_threshold: float = 0.1
    ) -> List[FlakyTestRecord]:
        """
        Detect flaky tests from execution history

        Args:
            project: Project name
            days: Number of days to analyze
            min_executions: Minimum executions required to classify as flaky
            flakiness_threshold: Minimum failure rate to consider flaky

        Returns:
            List of detected flaky tests
        """
        cutoff = datetime.now() - timedelta(days=days)

        # Get test executions and failures
        executions = self.event_store.query_events(
            project=project,
            branch=self.branch,
            event_types=[EventType.TEST_EXECUTION],
            limit=10000
        )

        failures = self.event_store.query_events(
            project=project,
            branch=self.branch,
            event_types=[EventType.TEST_FAILURE],
            limit=10000
        )

        # Filter by date
        executions = [e for e in executions if e.timestamp >= cutoff]
        failures = [f for f in failures if f.timestamp >= cutoff]

        # Build test execution statistics
        test_stats = defaultdict(lambda: {'executions': 0, 'failures': 0, 'first_seen': None, 'last_seen': None})

        for event in executions:
            test_id = event.data.get('test_id')
            if test_id:
                test_stats[test_id]['executions'] += 1
                if not test_stats[test_id]['first_seen']:
                    test_stats[test_id]['first_seen'] = event.timestamp
                test_stats[test_id]['last_seen'] = event.timestamp

        for event in failures:
            test_id = event.data.get('test_id')
            if test_id:
                test_stats[test_id]['failures'] += 1

        # Identify flaky tests
        flaky_tests = []

        for test_id, stats in test_stats.items():
            total_executions = stats['executions']
            failures_count = stats['failures']

            if total_executions < min_executions:
                continue

            failure_rate = failures_count / total_executions

            # Test is flaky if it sometimes fails but not always
            if flakiness_threshold <= failure_rate < 1.0:
                # Determine flakiness level
                if failure_rate < 0.25:
                    level = FlakinessLevel.INTERMITTENT
                elif failure_rate < 0.50:
                    level = FlakinessLevel.MODERATE
                elif failure_rate < 0.75:
                    level = FlakinessLevel.HIGH
                else:
                    level = FlakinessLevel.SEVERE

                record = FlakyTestRecord(
                    test_id=test_id,
                    test_name=test_id,  # Use test_id as name for now
                    first_detected=stats['first_seen'],
                    flakiness_level=level,
                    status=FlakyTestStatus.DETECTED,
                    failure_count=failures_count,
                    success_count=total_executions - failures_count,
                    tags=['auto-detected', f'failure-rate-{int(failure_rate * 100)}pct']
                )

                record.last_seen = stats['last_seen']
                flaky_tests.append(record)

                # Cache the record
                self._registry_cache[test_id] = record

        return flaky_tests

    def analyze_manifestations(
        self,
        test_id: str,
        project: str,
        days: int = 30
    ) -> Dict[str, Any]:
        """
        Analyze different ways a flaky test fails (manifestations)

        Returns:
            Dictionary with manifestation patterns
        """
        cutoff = datetime.now() - timedelta(days=days)

        failures = self.event_store.query_events(
            project=project,
            branch=self.branch,
            event_types=[EventType.TEST_FAILURE],
            limit=1000
        )

        # Filter for this test and date range
        test_failures = [
            f for f in failures
            if f.data.get('test_id') == test_id and f.timestamp >= cutoff
        ]

        # Group by error patterns
        manifestations = defaultdict(list)

        for failure in test_failures:
            error_msg = failure.data.get('error_message', 'Unknown')
            error_type = failure.data.get('error_type', 'Unknown')

            # Create manifestation key
            key = f"{error_type}: {error_msg[:100]}"
            manifestations[key].append({
                'timestamp': failure.timestamp.isoformat(),
                'error_message': error_msg,
                'tags': failure.tags
            })

        return {
            'test_id': test_id,
            'total_failures': len(test_failures),
            'manifestation_count': len(manifestations),
            'manifestations': {
                pattern: {
                    'count': len(occurrences),
                    'percentage': len(occurrences) / len(test_failures) * 100,
                    'recent_occurrence': occurrences[-1]
                }
                for pattern, occurrences in manifestations.items()
            }
        }

    # ==========================================================================
    # Healing Integration
    # ==========================================================================

    def record_healing_attempt(
        self,
        test_id: str,
        healing_strategy: str,
        success: bool,
        details: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Record a healing attempt for a flaky test

        Returns:
            Event ID of the recorded healing attempt
        """
        healing_event = Event(
            id=f"healing-{uuid.uuid4().hex[:12]}",
            type=EventType.AGENT_ACTION,
            project=details.get('project', 'unknown') if details else 'unknown',
            branch=self.branch,
            source='FlakyRegistry',
            importance=3.5 if success else 2.5,
            tags=[
                'self-healing',
                'healing-attempt',
                f'healing-{healing_strategy}',
                'healed-successfully' if success else 'healing-failed'
            ],
            data={
                'test_id': test_id,
                'healing_strategy': healing_strategy,
                'success': success,
                'timestamp': datetime.now().isoformat(),
                **(details or {})
            }
        )

        self.event_store.ingest(healing_event)

        # Update registry record
        if test_id in self._registry_cache:
            record = self._registry_cache[test_id]
            record.healing_attempts.append({
                'strategy': healing_strategy,
                'success': success,
                'timestamp': datetime.now().isoformat(),
                'event_id': healing_event.id
            })

            if success:
                record.status = FlakyTestStatus.HEALED
                record.tags.append('healed')

        return healing_event.id

    def get_healing_success_rate(
        self,
        test_id: Optional[str] = None,
        strategy: Optional[str] = None,
        days: int = 30
    ) -> Dict[str, Any]:
        """
        Calculate healing success rate for tests or strategies

        Args:
            test_id: Specific test (None = all tests)
            strategy: Specific strategy (None = all strategies)
            days: Time window

        Returns:
            Success rate statistics
        """
        cutoff = datetime.now() - timedelta(days=days)

        # Get healing attempt events
        healing_events = self.event_store.query_events(
            project='*',
            branch=self.branch,
            event_types=[EventType.AGENT_ACTION],
            tags_include=['healing-attempt'],
            limit=1000
        )

        # Filter
        healing_events = [e for e in healing_events if e.timestamp >= cutoff]

        if test_id:
            healing_events = [e for e in healing_events if e.data.get('test_id') == test_id]

        if strategy:
            healing_events = [e for e in healing_events if e.data.get('healing_strategy') == strategy]

        # Calculate stats
        total_attempts = len(healing_events)
        successful = sum(1 for e in healing_events if e.data.get('success', False))

        # Group by strategy
        strategy_stats = defaultdict(lambda: {'attempts': 0, 'successes': 0})

        for event in healing_events:
            strat = event.data.get('healing_strategy', 'unknown')
            strategy_stats[strat]['attempts'] += 1
            if event.data.get('success', False):
                strategy_stats[strat]['successes'] += 1

        return {
            'total_attempts': total_attempts,
            'successful_attempts': successful,
            'success_rate': successful / total_attempts if total_attempts > 0 else 0.0,
            'by_strategy': {
                strat: {
                    'attempts': stats['attempts'],
                    'successes': stats['successes'],
                    'success_rate': stats['successes'] / stats['attempts'] if stats['attempts'] > 0 else 0.0
                }
                for strat, stats in strategy_stats.items()
            }
        }

    # ==========================================================================
    # Memory Journal Integration
    # ==========================================================================

    def commit_registry_snapshot(
        self,
        project: str,
        message: str,
        author: str = "FlakyRegistry"
    ) -> str:
        """
        Commit current registry state to memory journal

        Returns:
            Commit ID
        """
        # Create registry snapshot event
        snapshot_event = Event(
            id=f"registry-snapshot-{uuid.uuid4().hex[:12]}",
            type=EventType.SYSTEM_EVENT,
            project=project,
            branch=self.branch,
            source='FlakyRegistry',
            importance=2.5,
            tags=['flaky-registry', 'snapshot'],
            data={
                'snapshot_time': datetime.now().isoformat(),
                'total_flaky_tests': len(self._registry_cache),
                'by_status': self._get_status_breakdown(),
                'by_level': self._get_level_breakdown(),
                'registry_records': [
                    record.to_dict() for record in self._registry_cache.values()
                ]
            }
        )

        self.event_store.ingest(snapshot_event)

        # Commit to memory journal
        commit = self.memory_journal.commit(
            branch=self.branch,
            event_ids=[snapshot_event.id],
            message=message,
            author=author,
            tags=['flaky-registry', 'snapshot']
        )

        return commit.commit_id

    def tag_major_milestone(
        self,
        tag_name: str,
        commit_id: str,
        message: str
    ) -> str:
        """
        Tag a major flaky registry milestone

        Examples:
        - "flaky-free-sprint-10" - No flaky tests
        - "healing-95pct" - 95% healing success rate
        """
        tag = self.memory_journal.create_tag(
            tag_name=tag_name,
            commit_id=commit_id,
            message=message
        )

        return tag.tag_name

    # ==========================================================================
    # Reporting
    # ==========================================================================

    def generate_flakiness_report(
        self,
        project: str,
        days: int = 30
    ) -> Dict[str, Any]:
        """Generate comprehensive flakiness report"""
        # Detect flaky tests
        flaky_tests = self.detect_flaky_tests(project, days=days)

        # Get healing stats
        healing_stats = self.get_healing_success_rate(days=days)

        # Categorize by level
        by_level = defaultdict(int)
        by_status = defaultdict(int)

        for test in flaky_tests:
            by_level[test.flakiness_level.value] += 1
            by_status[test.status.value] += 1

        return {
            'project': project,
            'period_days': days,
            'generated_at': datetime.now().isoformat(),
            'summary': {
                'total_flaky_tests': len(flaky_tests),
                'by_level': dict(by_level),
                'by_status': dict(by_status),
                'healing_success_rate': healing_stats['success_rate']
            },
            'healing_stats': healing_stats,
            'top_flaky_tests': sorted(
                [t.to_dict() for t in flaky_tests],
                key=lambda x: x['failure_rate'],
                reverse=True
            )[:20]
        }

    def _get_status_breakdown(self) -> Dict[str, int]:
        """Get breakdown by status"""
        breakdown = defaultdict(int)
        for record in self._registry_cache.values():
            breakdown[record.status.value] += 1
        return dict(breakdown)

    def _get_level_breakdown(self) -> Dict[str, int]:
        """Get breakdown by flakiness level"""
        breakdown = defaultdict(int)
        for record in self._registry_cache.values():
            breakdown[record.flakiness_level.value] += 1
        return dict(breakdown)
