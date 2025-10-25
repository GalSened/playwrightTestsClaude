"""
COM Core Data Models
Defines all data structures for Context Orchestrator Management
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# =============================================================================
# Event Types
# =============================================================================

class EventType(str, Enum):
    """Types of events that can be ingested into COM"""
    TEST_EXECUTION = "test_execution"
    TEST_FAILURE = "test_failure"
    CODE_CHANGE = "code_change"
    DEPLOYMENT = "deployment"
    AGENT_ACTION = "agent_action"
    USER_ACTION = "user_action"
    SYSTEM_EVENT = "system_event"


class Event(BaseModel):
    """Core event structure for ingestion"""
    id: str = Field(..., description="Unique event ID (UUID or checksum-based)")
    type: EventType
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    project: str = Field(..., description="Project name (e.g., 'WeSign')")
    branch: str = Field(default="main", description="Memory branch")

    # Event payload
    data: Dict[str, Any] = Field(default_factory=dict)

    # Metadata
    importance: float = Field(default=1.0, ge=0.0, le=5.0, description="Importance score")
    tags: List[str] = Field(default_factory=list)
    source: str = Field(..., description="Event source (e.g., 'TestIntelligenceAgent')")

    # Relationships
    parent_id: Optional[str] = None
    related_ids: List[str] = Field(default_factory=list)

    # Vector embedding (computed)
    embedding: Optional[List[float]] = None

    class Config:
        json_schema_extra = {
            "example": {
                "id": "evt-123456",
                "type": "test_failure",
                "project": "WeSign",
                "branch": "main",
                "data": {
                    "test_id": "test_self_signing_pdf",
                    "error": "Element not found: #signature-field",
                    "screenshot": "artifacts/failure-123.png"
                },
                "importance": 3.5,
                "tags": ["flaky", "self-signing"],
                "source": "TestIntelligenceAgent"
            }
        }


# =============================================================================
# Policy Models
# =============================================================================

class PolicyWeights(BaseModel):
    """Weights for policy-driven retrieval"""
    pinned: float = Field(default=3.0, description="Weight for pinned events")
    importance: float = Field(default=2.0, description="Weight for importance score")
    semantic: float = Field(default=1.6, description="Weight for semantic similarity")
    recency: float = Field(default=1.0, description="Weight for recency")
    diversity: float = Field(default=0.5, description="Diversity penalty")


class RetrievalPolicy(BaseModel):
    """Policy defining how context should be retrieved"""
    policy_id: str = Field(..., description="Unique policy identifier")
    task: str = Field(..., description="Task type (e.g., 'code_review', 'root_cause')")

    # Retrieval configuration
    weights: PolicyWeights = Field(default_factory=PolicyWeights)
    budget_tokens: int = Field(default=4096, description="Token budget for context pack")

    # Filters
    event_types: Optional[List[EventType]] = None
    min_importance: float = Field(default=0.0)
    tags_include: List[str] = Field(default_factory=list)
    tags_exclude: List[str] = Field(default_factory=list)

    # Special features
    include_rollups: bool = Field(default=True, description="Include daily/weekly summaries")
    max_events: int = Field(default=50, description="Maximum events to retrieve")

    class Config:
        json_schema_extra = {
            "example": {
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
                "event_types": ["test_failure", "code_change"],
                "min_importance": 2.0,
                "tags_include": ["regression"],
                "include_rollups": True
            }
        }


# =============================================================================
# Context Pack Models
# =============================================================================

class ContextItem(BaseModel):
    """A single item in the context pack"""
    event_id: str
    content: str = Field(..., description="Formatted content for LLM")
    score: float = Field(..., description="Relevance score")
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ContextPack(BaseModel):
    """Final context package delivered to agent/LLM"""
    pack_id: str = Field(..., description="Unique pack ID")
    policy_id: str
    task: str

    # Context items
    items: List[ContextItem] = Field(default_factory=list)

    # Statistics
    total_items: int = 0
    total_tokens: int = 0
    budget_tokens: int = 4096
    utilization: float = Field(default=0.0, ge=0.0, le=1.0)

    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    project: str
    branch: str

    # Summary
    summary: Optional[str] = None

    def get_formatted_context(self) -> str:
        """Get formatted context string for LLM prompt"""
        sections = []

        if self.summary:
            sections.append(f"# Context Summary\n{self.summary}\n")

        sections.append(f"# Relevant Events ({self.total_items} items, {self.total_tokens} tokens)\n")

        for i, item in enumerate(self.items, 1):
            sections.append(f"## Event {i} (score: {item.score:.2f})\n{item.content}\n")

        return "\n".join(sections)


# =============================================================================
# Retrieval Request/Response
# =============================================================================

class RetrievalRequest(BaseModel):
    """Request for context retrieval"""
    task: str = Field(..., description="Task identifier (maps to policy)")
    project: str
    branch: str = "main"

    # Query
    inputs: Dict[str, Any] = Field(default_factory=dict, description="Task-specific inputs")
    query: Optional[str] = None  # Explicit semantic query

    # Overrides
    policy_id: Optional[str] = None
    token_budget: Optional[int] = None

    # Filters
    event_types: Optional[List[EventType]] = None
    tags_include: List[str] = Field(default_factory=list)

    class Config:
        json_schema_extra = {
            "example": {
                "task": "root_cause",
                "project": "WeSign",
                "branch": "main",
                "inputs": {
                    "test_id": "test_self_signing_pdf",
                    "error": "Element not found"
                },
                "query": "self-signing PDF failures with missing elements",
                "token_budget": 4096
            }
        }


class RetrievalResponse(BaseModel):
    """Response from context retrieval"""
    success: bool
    context_pack: Optional[ContextPack] = None
    error: Optional[str] = None


# =============================================================================
# Memory Journal Models (Git-style)
# =============================================================================

class MemoryBranch(BaseModel):
    """Git-style memory branch"""
    name: str
    head_commit: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    description: Optional[str] = None


class MemoryCommit(BaseModel):
    """Git-style memory commit"""
    commit_id: str
    branch: str
    message: str
    author: str = Field(default="system")
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    # Events in this commit
    event_ids: List[str] = Field(default_factory=list)

    # Commit metadata
    parent_commit: Optional[str] = None
    tags: List[str] = Field(default_factory=list)


class MemoryTag(BaseModel):
    """Git-style tag for important commits"""
    tag_name: str
    commit_id: str
    message: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


# =============================================================================
# Health & Status Models
# =============================================================================

class ServiceHealth(BaseModel):
    """COM service health status"""
    status: str = Field(..., description="'healthy' or 'unhealthy'")
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    # Storage stats
    total_events: int = 0
    total_branches: int = 0
    total_commits: int = 0

    # Index stats
    vector_index_size: int = 0
    inverted_index_size: int = 0
    graph_index_size: int = 0

    # Performance
    avg_retrieval_time_ms: float = 0.0
    cache_hit_rate: float = 0.0
