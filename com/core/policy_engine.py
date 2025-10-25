"""
Policy Engine - Manages retrieval policies and orchestrates context packing
Implements deterministic token-budget packing and policy-driven retrieval
"""

import yaml
from pathlib import Path
from typing import Dict, List, Optional, Any
from datetime import datetime
import tiktoken

from core.models import (
    RetrievalPolicy,
    PolicyWeights,
    ContextPack,
    ContextItem,
    Event,
    EventType
)
from storage.event_store import EventStore
from storage.vector_index import HybridRetriever


class PolicyEngine:
    """
    Manages retrieval policies and orchestrates context packing
    """

    def __init__(
        self,
        event_store: EventStore,
        hybrid_retriever: HybridRetriever,
        policies_dir: str = "./policies"
    ):
        self.event_store = event_store
        self.hybrid_retriever = hybrid_retriever
        self.policies_dir = Path(policies_dir)
        self.policies: Dict[str, RetrievalPolicy] = {}

        # Token counter (using GPT-4 tokenizer as approximation)
        self.tokenizer = tiktoken.encoding_for_model("gpt-4")

        # Load policies
        self._load_policies()

    def _load_policies(self):
        """Load all policy definitions from YAML files"""
        if not self.policies_dir.exists():
            self.policies_dir.mkdir(parents=True, exist_ok=True)
            # Create default policy
            self._create_default_policy()

        for policy_file in self.policies_dir.glob("*.yaml"):
            try:
                with open(policy_file) as f:
                    policy_data = yaml.safe_load(f)
                    policy = self._parse_policy(policy_data)
                    self.policies[policy.policy_id] = policy
                    print(f"Loaded policy: {policy.policy_id}")
            except Exception as e:
                print(f"Error loading policy {policy_file}: {e}")

    def _create_default_policy(self):
        """Create default qa_code_review_py policy"""
        default_policy = {
            "policy_id": "qa_code_review_py",
            "task": "code_review",
            "weights": {
                "pinned": 3.0,
                "importance": 2.0,
                "semantic": 1.6,
                "recency": 1.0,
                "diversity": 0.5
            },
            "budget_tokens": 4096,
            "event_types": ["test_failure", "code_change", "agent_action"],
            "min_importance": 2.0,
            "tags_include": ["regression", "flaky"],
            "include_rollups": True,
            "max_events": 50
        }

        policy_path = self.policies_dir / "qa_code_review_py.yaml"
        with open(policy_path, "w") as f:
            yaml.dump(default_policy, f, default_flow_style=False)

    def _parse_policy(self, policy_data: Dict[str, Any]) -> RetrievalPolicy:
        """Parse policy from YAML data"""
        # Parse weights
        weights_data = policy_data.get("weights", {})
        weights = PolicyWeights(
            pinned=weights_data.get("pinned", 3.0),
            importance=weights_data.get("importance", 2.0),
            semantic=weights_data.get("semantic", 1.6),
            recency=weights_data.get("recency", 1.0),
            diversity=weights_data.get("diversity", 0.5)
        )

        # Parse event types
        event_types = None
        if "event_types" in policy_data:
            event_types = [EventType(et) for et in policy_data["event_types"]]

        return RetrievalPolicy(
            policy_id=policy_data["policy_id"],
            task=policy_data["task"],
            weights=weights,
            budget_tokens=policy_data.get("budget_tokens", 4096),
            event_types=event_types,
            min_importance=policy_data.get("min_importance", 0.0),
            tags_include=policy_data.get("tags_include", []),
            tags_exclude=policy_data.get("tags_exclude", []),
            include_rollups=policy_data.get("include_rollups", True),
            max_events=policy_data.get("max_events", 50)
        )

    def get_policy(self, policy_id: str) -> Optional[RetrievalPolicy]:
        """Get policy by ID"""
        return self.policies.get(policy_id)

    def retrieve_context(
        self,
        task: str,
        project: str,
        branch: str = "main",
        inputs: Optional[Dict[str, Any]] = None,
        policy_id: Optional[str] = None,
        token_budget: Optional[int] = None
    ) -> ContextPack:
        """
        Main retrieval function - orchestrates policy-driven context packing
        """
        # Select policy
        if policy_id is None:
            # Map task to default policy
            policy_id = self._map_task_to_policy(task)

        policy = self.get_policy(policy_id)
        if policy is None:
            raise ValueError(f"Policy not found: {policy_id}")

        # Override budget if specified
        if token_budget is not None:
            policy.budget_tokens = token_budget

        # Build query from inputs
        query = self._build_query(task, inputs or {})

        # 1. Hybrid retrieval
        weights = {
            "semantic": policy.weights.semantic,
            "recency": policy.weights.recency,
            "importance": policy.weights.importance
        }

        candidates = self.hybrid_retriever.retrieve(
            query=query,
            project=project,
            branch=branch,
            weights=weights,
            max_events=policy.max_events
        )

        # 2. Apply policy filters
        filtered = self._apply_policy_filters(candidates, policy)

        # 3. Pack with token budget
        context_items = self._pack_with_budget(
            filtered,
            policy.budget_tokens,
            diversity_weight=policy.weights.diversity
        )

        # 4. Create context pack
        total_tokens = sum(self._count_tokens(item.content) for item in context_items)

        pack = ContextPack(
            pack_id=f"pack-{datetime.utcnow().timestamp()}",
            policy_id=policy.policy_id,
            task=task,
            items=context_items,
            total_items=len(context_items),
            total_tokens=total_tokens,
            budget_tokens=policy.budget_tokens,
            utilization=total_tokens / policy.budget_tokens if policy.budget_tokens > 0 else 0,
            project=project,
            branch=branch,
            summary=self._generate_summary(context_items)
        )

        return pack

    def _map_task_to_policy(self, task: str) -> str:
        """Map task type to default policy ID"""
        task_policy_map = {
            "code_review": "qa_code_review_py",
            "root_cause": "qa_root_cause",
            "flaky_triage": "qa_flaky_triage",
            "regression_select": "qa_regression_select",
            "healing": "qa_healing"
        }
        return task_policy_map.get(task, "qa_code_review_py")

    def _build_query(self, task: str, inputs: Dict[str, Any]) -> str:
        """Build semantic query from task and inputs"""
        parts = [f"Task: {task}"]

        # Extract relevant input fields
        if "test_id" in inputs:
            parts.append(f"Test: {inputs['test_id']}")

        if "error" in inputs:
            parts.append(f"Error: {inputs['error']}")

        if "query" in inputs:
            parts.append(inputs["query"])

        if "file_path" in inputs:
            parts.append(f"File: {inputs['file_path']}")

        return " | ".join(parts)

    def _apply_policy_filters(
        self,
        candidates: List[tuple],
        policy: RetrievalPolicy
    ) -> List[tuple]:
        """Apply policy filters to candidates"""
        filtered = []

        for event_id, score, event in candidates:
            # Event type filter
            if policy.event_types and event.type not in policy.event_types:
                continue

            # Importance filter
            if event.importance < policy.min_importance:
                continue

            # Tags include filter
            if policy.tags_include:
                if not any(tag in event.tags for tag in policy.tags_include):
                    continue

            # Tags exclude filter
            if policy.tags_exclude:
                if any(tag in event.tags for tag in policy.tags_exclude):
                    continue

            filtered.append((event_id, score, event))

        return filtered

    def _pack_with_budget(
        self,
        candidates: List[tuple],
        budget_tokens: int,
        diversity_weight: float = 0.5
    ) -> List[ContextItem]:
        """
        Pack events into context items within token budget
        Implements greedy packing with diversity penalty
        """
        items = []
        used_tokens = 0
        used_event_types = set()

        for event_id, score, event in candidates:
            # Format event as context item
            content = self._format_event(event)
            tokens = self._count_tokens(content)

            # Check budget
            if used_tokens + tokens > budget_tokens:
                break

            # Apply diversity penalty (penalize repeated event types)
            adjusted_score = score
            if event.type in used_event_types:
                adjusted_score *= (1.0 - diversity_weight)

            # Create context item
            item = ContextItem(
                event_id=event.id,
                content=content,
                score=adjusted_score,
                metadata={
                    "type": event.type.value,
                    "timestamp": event.timestamp.isoformat(),
                    "importance": event.importance,
                    "tags": event.tags
                }
            )

            items.append(item)
            used_tokens += tokens
            used_event_types.add(event.type)

        return items

    def _format_event(self, event: Event) -> str:
        """Format event as context for LLM"""
        lines = [
            f"**Event ID:** {event.id}",
            f"**Type:** {event.type.value}",
            f"**Timestamp:** {event.timestamp.strftime('%Y-%m-%d %H:%M:%S')}",
            f"**Source:** {event.source}",
            f"**Importance:** {event.importance:.1f}/5.0",
        ]

        if event.tags:
            lines.append(f"**Tags:** {', '.join(event.tags)}")

        lines.append("")
        lines.append("**Data:**")

        # Format data fields
        for key, value in event.data.items():
            if isinstance(value, str) and len(value) > 200:
                value = value[:200] + "..."
            lines.append(f"- {key}: {value}")

        return "\n".join(lines)

    def _count_tokens(self, text: str) -> int:
        """Count tokens in text"""
        return len(self.tokenizer.encode(text))

    def _generate_summary(self, items: List[ContextItem]) -> str:
        """Generate summary of context pack"""
        if not items:
            return "No relevant events found."

        event_types = {}
        for item in items:
            event_type = item.metadata.get("type", "unknown")
            event_types[event_type] = event_types.get(event_type, 0) + 1

        summary_parts = [
            f"Retrieved {len(items)} relevant events:",
        ]

        for event_type, count in sorted(event_types.items(), key=lambda x: x[1], reverse=True):
            summary_parts.append(f"- {count} {event_type} events")

        return "\n".join(summary_parts)
