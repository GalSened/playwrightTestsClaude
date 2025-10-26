"""
Smart Regression Test Selector
Uses historical data and code change analysis to intelligently select regression tests
"""

from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Set, Tuple
from collections import defaultdict
from dataclasses import dataclass
import re

from core.models import Event, EventType
from storage.event_store import EventStore
from storage.vector_index import HybridRetriever
from core.policy_engine import PolicyEngine


@dataclass
class TestScore:
    """Scored test for regression selection"""
    test_id: str
    test_name: str
    score: float
    reasons: List[str]
    risk_level: str  # low, medium, high, critical
    metadata: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return {
            'test_id': self.test_id,
            'test_name': self.test_name,
            'score': round(self.score, 3),
            'reasons': self.reasons,
            'risk_level': self.risk_level,
            'metadata': self.metadata
        }


@dataclass
class CodeChange:
    """Represents a code change"""
    file_path: str
    change_type: str  # added, modified, deleted
    lines_added: int
    lines_deleted: int
    functions_changed: Optional[List[str]] = None
    modules_changed: Optional[List[str]] = None


class RegressionSelector:
    """
    Smart Regression Test Selector

    Features:
    - Analyze code changes and map to affected tests
    - Use historical failure patterns
    - Prioritize based on criticality and risk
    - Consider recent flakiness
    - Optimize for test execution time vs. coverage
    """

    def __init__(
        self,
        event_store: EventStore,
        hybrid_retriever: HybridRetriever,
        policy_engine: PolicyEngine
    ):
        self.event_store = event_store
        self.hybrid_retriever = hybrid_retriever
        self.policy_engine = policy_engine

    # ==========================================================================
    # Main Selection Logic
    # ==========================================================================

    def select_tests(
        self,
        project: str,
        code_changes: List[CodeChange],
        available_tests: List[str],
        max_tests: Optional[int] = None,
        time_budget_minutes: Optional[int] = None,
        branch: str = "main"
    ) -> List[TestScore]:
        """
        Select regression tests based on code changes

        Args:
            project: Project name
            code_changes: List of code changes
            available_tests: All available tests
            max_tests: Maximum number of tests to select
            time_budget_minutes: Time budget for test execution
            branch: Memory branch

        Returns:
            Ranked list of tests to run
        """
        # Score each available test
        test_scores: List[TestScore] = []

        for test_id in available_tests:
            score = self._calculate_test_score(
                test_id=test_id,
                code_changes=code_changes,
                project=project,
                branch=branch
            )

            if score:
                test_scores.append(score)

        # Sort by score (descending)
        test_scores.sort(key=lambda x: x.score, reverse=True)

        # Apply constraints
        if max_tests:
            test_scores = test_scores[:max_tests]

        if time_budget_minutes:
            test_scores = self._apply_time_budget(
                test_scores,
                time_budget_minutes,
                project,
                branch
            )

        return test_scores

    def _calculate_test_score(
        self,
        test_id: str,
        code_changes: List[CodeChange],
        project: str,
        branch: str
    ) -> Optional[TestScore]:
        """
        Calculate score for a single test

        Scoring factors:
        1. Semantic similarity to code changes (40%)
        2. Historical failure correlation (30%)
        3. Test criticality (15%)
        4. Recent flakiness penalty (10%)
        5. Execution time efficiency (5%)
        """
        reasons = []
        score = 0.0
        metadata = {}

        # 1. Semantic similarity (40%)
        semantic_score = self._calculate_semantic_similarity(
            test_id, code_changes, project, branch
        )
        score += semantic_score * 0.40

        if semantic_score > 0.5:
            reasons.append(f"High semantic similarity to changed code ({semantic_score:.2f})")

        # 2. Historical failure correlation (30%)
        failure_score = self._calculate_failure_correlation(
            test_id, code_changes, project, branch
        )
        score += failure_score * 0.30

        if failure_score > 0.5:
            reasons.append(f"Previously failed with similar changes ({failure_score:.2f})")

        # 3. Test criticality (15%)
        criticality_score = self._get_test_criticality(test_id, project, branch)
        score += criticality_score * 0.15
        metadata['criticality'] = criticality_score

        if criticality_score > 0.7:
            reasons.append(f"Critical test (importance: {criticality_score:.2f})")

        # 4. Recent flakiness penalty (10%)
        flakiness_penalty = self._get_flakiness_penalty(test_id, project, branch)
        score -= flakiness_penalty * 0.10
        metadata['flakiness_penalty'] = flakiness_penalty

        if flakiness_penalty > 0.3:
            reasons.append(f"Recently flaky (penalty: {flakiness_penalty:.2f})")

        # 5. Execution time efficiency (5%)
        efficiency_score = self._get_execution_efficiency(test_id, project, branch)
        score += efficiency_score * 0.05
        metadata['efficiency'] = efficiency_score

        # Normalize score to 0-1 range
        score = max(0.0, min(1.0, score))

        # Determine risk level
        risk_level = self._determine_risk_level(score, semantic_score, failure_score)

        if score < 0.1:
            return None  # Too low to include

        return TestScore(
            test_id=test_id,
            test_name=test_id,  # Could lookup full name
            score=score,
            reasons=reasons,
            risk_level=risk_level,
            metadata=metadata
        )

    # ==========================================================================
    # Scoring Components
    # ==========================================================================

    def _calculate_semantic_similarity(
        self,
        test_id: str,
        code_changes: List[CodeChange],
        project: str,
        branch: str
    ) -> float:
        """
        Calculate semantic similarity between test and code changes

        Uses vector search to find if test has historically been affected
        by similar code changes
        """
        # Build query from code changes
        change_descriptions = []
        for change in code_changes:
            desc = f"{change.change_type} {change.file_path}"
            if change.functions_changed:
                desc += f" functions: {', '.join(change.functions_changed)}"
            change_descriptions.append(desc)

        query = f"Test coverage for: {'; '.join(change_descriptions)}"

        # Use policy engine with regression_select policy
        try:
            context_pack = self.policy_engine.retrieve_context(
                task="smart_regression_selection",
                project=project,
                branch=branch,
                inputs={'code_changes': change_descriptions, 'test_id': test_id},
                policy_id="qa_regression_select",
                token_budget=2048
            )

            # Check if this test appears in relevant context
            test_mentions = sum(
                1 for item in context_pack.items
                if test_id in str(item.event.data)
            )

            # Normalize by number of context items
            similarity = min(1.0, test_mentions / max(1, len(context_pack.items) * 0.3))

            return similarity

        except Exception:
            return 0.0

    def _calculate_failure_correlation(
        self,
        test_id: str,
        code_changes: List[CodeChange],
        project: str,
        branch: str,
        days: int = 90
    ) -> float:
        """
        Check if test historically failed after similar code changes

        Higher score if:
        - Test failed after changes to same files
        - Test failed after changes to related modules
        """
        cutoff = datetime.now() - timedelta(days=days)

        # Get test failures
        failures = self.event_store.query_events(
            project=project,
            branch=branch,
            event_types=[EventType.TEST_FAILURE],
            limit=500
        )

        failures = [f for f in failures if f.timestamp >= cutoff and f.data.get('test_id') == test_id]

        if not failures:
            return 0.0

        # Get code changes around failure times
        code_change_events = self.event_store.query_events(
            project=project,
            branch=branch,
            event_types=[EventType.CODE_CHANGE],
            limit=1000
        )

        code_change_events = [c for c in code_change_events if c.timestamp >= cutoff]

        # Check correlation
        correlated_failures = 0
        changed_files = {change.file_path for change in code_changes}

        for failure in failures:
            # Find code changes within 24 hours before failure
            failure_time = failure.timestamp
            recent_changes = [
                c for c in code_change_events
                if failure_time - timedelta(hours=24) <= c.timestamp <= failure_time
            ]

            # Check if any recent change touched same files
            for change_event in recent_changes:
                changed_in_event = set(change_event.data.get('files', []))
                if changed_files & changed_in_event:  # Intersection
                    correlated_failures += 1
                    break

        correlation = correlated_failures / len(failures) if failures else 0.0
        return correlation

    def _get_test_criticality(
        self,
        test_id: str,
        project: str,
        branch: str
    ) -> float:
        """
        Get test criticality score

        Based on:
        - Test tags (critical-path, integration, e2e)
        - Historical importance
        - Coverage metrics
        """
        # Get recent test executions
        executions = self.event_store.query_events(
            project=project,
            branch=branch,
            event_types=[EventType.TEST_EXECUTION],
            limit=100
        )

        test_executions = [e for e in executions if e.data.get('test_id') == test_id]

        if not test_executions:
            return 0.5  # Default medium criticality

        # Average importance from events
        avg_importance = sum(e.importance for e in test_executions) / len(test_executions)

        # Normalize to 0-1
        criticality = avg_importance / 5.0

        # Boost for critical tags
        for execution in test_executions:
            if any(tag in execution.tags for tag in ['critical-path', 'e2e', 'integration']):
                criticality = min(1.0, criticality + 0.2)
                break

        return criticality

    def _get_flakiness_penalty(
        self,
        test_id: str,
        project: str,
        branch: str,
        days: int = 30
    ) -> float:
        """
        Calculate flakiness penalty

        Higher penalty for tests that are currently flaky
        """
        cutoff = datetime.now() - timedelta(days=days)

        executions = self.event_store.query_events(
            project=project,
            branch=branch,
            event_types=[EventType.TEST_EXECUTION],
            limit=200
        )

        failures = self.event_store.query_events(
            project=project,
            branch=branch,
            event_types=[EventType.TEST_FAILURE],
            limit=200
        )

        # Filter for this test and time period
        test_executions = [
            e for e in executions
            if e.data.get('test_id') == test_id and e.timestamp >= cutoff
        ]

        test_failures = [
            f for f in failures
            if f.data.get('test_id') == test_id and f.timestamp >= cutoff
        ]

        if len(test_executions) < 5:
            return 0.0  # Not enough data

        failure_rate = len(test_failures) / len(test_executions)

        # Flaky if 10% < failure_rate < 90%
        if 0.1 <= failure_rate <= 0.9:
            # Higher penalty for more volatile flakiness
            penalty = abs(failure_rate - 0.5) * 2  # 0 at 50%, increases toward extremes
            return min(1.0, penalty)

        return 0.0

    def _get_execution_efficiency(
        self,
        test_id: str,
        project: str,
        branch: str
    ) -> float:
        """
        Get execution efficiency score

        Favor faster tests (all else being equal)
        """
        # Get recent executions with duration
        executions = self.event_store.query_events(
            project=project,
            branch=branch,
            event_types=[EventType.TEST_EXECUTION],
            limit=50
        )

        test_executions = [e for e in executions if e.data.get('test_id') == test_id]

        if not test_executions:
            return 0.5  # Default medium efficiency

        # Get average duration
        durations = [e.data.get('duration_ms', 0) for e in test_executions]
        avg_duration = sum(durations) / len(durations) if durations else 0

        # Fast tests (< 1 sec) get high score, slow tests (> 60 sec) get low score
        if avg_duration < 1000:
            return 1.0
        elif avg_duration < 5000:
            return 0.8
        elif avg_duration < 15000:
            return 0.6
        elif avg_duration < 60000:
            return 0.4
        else:
            return 0.2

    def _determine_risk_level(
        self,
        overall_score: float,
        semantic_score: float,
        failure_score: float
    ) -> str:
        """Determine risk level for skipping this test"""
        # Critical if high semantic match OR high failure correlation
        if semantic_score > 0.7 or failure_score > 0.7:
            return "critical"

        if overall_score > 0.7:
            return "high"
        elif overall_score > 0.4:
            return "medium"
        else:
            return "low"

    # ==========================================================================
    # Budget Constraints
    # ==========================================================================

    def _apply_time_budget(
        self,
        test_scores: List[TestScore],
        time_budget_minutes: int,
        project: str,
        branch: str
    ) -> List[TestScore]:
        """
        Apply time budget constraint using knapsack-style selection

        Select maximum value tests within time budget
        """
        # Get test durations
        test_durations = self._get_test_durations(
            [ts.test_id for ts in test_scores],
            project,
            branch
        )

        # Greedy selection by score/duration ratio
        selected = []
        total_time = 0
        time_budget_ms = time_budget_minutes * 60 * 1000

        for test_score in test_scores:
            duration = test_durations.get(test_score.test_id, 5000)  # Default 5 sec

            if total_time + duration <= time_budget_ms:
                selected.append(test_score)
                total_time += duration
            else:
                break

        return selected

    def _get_test_durations(
        self,
        test_ids: List[str],
        project: str,
        branch: str
    ) -> Dict[str, int]:
        """Get average duration for each test in milliseconds"""
        executions = self.event_store.query_events(
            project=project,
            branch=branch,
            event_types=[EventType.TEST_EXECUTION],
            limit=1000
        )

        durations = defaultdict(list)

        for execution in executions:
            test_id = execution.data.get('test_id')
            duration = execution.data.get('duration_ms', 0)

            if test_id in test_ids and duration > 0:
                durations[test_id].append(duration)

        # Return average duration
        return {
            test_id: int(sum(vals) / len(vals))
            for test_id, vals in durations.items()
        }

    # ==========================================================================
    # Reporting
    # ==========================================================================

    def generate_selection_report(
        self,
        selected_tests: List[TestScore],
        total_available: int,
        code_changes: List[CodeChange]
    ) -> Dict[str, Any]:
        """Generate report on test selection"""
        return {
            'summary': {
                'total_available_tests': total_available,
                'selected_tests': len(selected_tests),
                'selection_ratio': len(selected_tests) / total_available if total_available > 0 else 0,
                'code_changes_analyzed': len(code_changes)
            },
            'risk_distribution': {
                risk_level: sum(1 for t in selected_tests if t.risk_level == risk_level)
                for risk_level in ['critical', 'high', 'medium', 'low']
            },
            'average_score': sum(t.score for t in selected_tests) / len(selected_tests) if selected_tests else 0,
            'selected_tests': [t.to_dict() for t in selected_tests],
            'code_changes': [
                {
                    'file': change.file_path,
                    'type': change.change_type,
                    'lines_added': change.lines_added,
                    'lines_deleted': change.lines_deleted
                }
                for change in code_changes
            ]
        }
