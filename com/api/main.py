"""
COM FastAPI Service
Main API for Context Orchestrator Management
"""

import os
import sys
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.models import (
    Event,
    RetrievalRequest,
    RetrievalResponse,
    ContextPack,
    ServiceHealth,
    MemoryBranch,
    MemoryCommit,
    MemoryTag
)
from storage.event_store import EventStore
from storage.vector_index import VectorIndex, HybridRetriever
from core.policy_engine import PolicyEngine
from core.memory_journal import MemoryJournalService
from core.roll_ups import RollUpService
from services.llm_service import LLMService, get_llm_service


# =============================================================================
# Configuration
# =============================================================================

load_dotenv()

EVENT_LOG_DB_PATH = os.getenv("EVENT_LOG_DB_PATH", "./data/events.db")
VECTOR_INDEX_PATH = os.getenv("VECTOR_INDEX_PATH", "./data/vector_index.faiss")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "BAAI/bge-large-en-v1.5")
EMBEDDING_DIM = int(os.getenv("EMBEDDING_DIM", "1024"))
POLICIES_DIR = os.getenv("POLICIES_DIR", "./policies")
CORS_ORIGIN = os.getenv("CORS_ORIGIN", "http://localhost:8082")


# =============================================================================
# Global State
# =============================================================================

class COMState:
    """Global COM service state"""
    event_store: Optional[EventStore] = None
    vector_index: Optional[VectorIndex] = None
    hybrid_retriever: Optional[HybridRetriever] = None
    policy_engine: Optional[PolicyEngine] = None
    memory_journal: Optional[MemoryJournalService] = None
    rollup_service: Optional[RollUpService] = None
    llm_service: Optional[LLMService] = None


com_state = COMState()


# =============================================================================
# Lifespan Management
# =============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize and cleanup COM services"""
    print("=" * 80)
    print("COM (Context Orchestrator Management) Service Starting...")
    print("=" * 80)

    # Initialize event store
    print(f"\n1. Initializing Event Store: {EVENT_LOG_DB_PATH}")
    com_state.event_store = EventStore(EVENT_LOG_DB_PATH)
    stats = com_state.event_store.get_stats()
    print(f"   ✓ Event Store ready. Total events: {stats['total_events']}")

    # Initialize vector index
    print(f"\n2. Initializing Vector Index: {VECTOR_INDEX_PATH}")
    print(f"   Model: {EMBEDDING_MODEL}")
    com_state.vector_index = VectorIndex(
        model_name=EMBEDDING_MODEL,
        index_path=VECTOR_INDEX_PATH,
        dimension=EMBEDDING_DIM
    )
    vec_stats = com_state.vector_index.get_stats()
    print(f"   ✓ Vector Index ready. Total vectors: {vec_stats['total_vectors']}")

    # Initialize hybrid retriever
    print(f"\n3. Initializing Hybrid Retriever")
    com_state.hybrid_retriever = HybridRetriever(
        vector_index=com_state.vector_index,
        event_store=com_state.event_store
    )
    print(f"   ✓ Hybrid Retriever ready")

    # Initialize policy engine
    print(f"\n4. Initializing Policy Engine: {POLICIES_DIR}")
    com_state.policy_engine = PolicyEngine(
        event_store=com_state.event_store,
        hybrid_retriever=com_state.hybrid_retriever,
        policies_dir=POLICIES_DIR
    )
    print(f"   ✓ Policy Engine ready. Loaded {len(com_state.policy_engine.policies)} policies")

    # Initialize memory journal
    print(f"\n5. Initializing Memory Journal (Git-style)")
    com_state.memory_journal = MemoryJournalService(
        event_store=com_state.event_store
    )
    journal_stats = com_state.memory_journal.get_journal_stats()
    print(f"   ✓ Memory Journal ready. {journal_stats['total_branches']} branches, {journal_stats['total_commits']} commits")

    # Initialize LLM service
    print(f"\n6. Initializing LLM Service")
    try:
        com_state.llm_service = get_llm_service()
        llm_healthy = await com_state.llm_service.check_health()
        if llm_healthy:
            print(f"   ✓ LLM Service ready (LM Studio connected)")
        else:
            print(f"   ⚠ LLM Service initialized but LM Studio not available - will use fallback summaries")
    except Exception as e:
        print(f"   ⚠ LLM Service initialization failed: {e} - will use fallback summaries")
        com_state.llm_service = None

    # Initialize rollup service
    print(f"\n7. Initializing Roll-up Summary Service")
    com_state.rollup_service = RollUpService(
        event_store=com_state.event_store,
        llm_service=com_state.llm_service,
        enable_llm=True
    )
    print(f"   ✓ Roll-up Service ready (LLM enabled: {com_state.llm_service is not None})")

    print("\n" + "=" * 80)
    print("COM Service Ready!")
    print("=" * 80)

    yield

    # Cleanup
    print("\n" + "=" * 80)
    print("COM Service Shutting Down...")
    print("=" * 80)

    if com_state.vector_index and com_state.vector_index.index_path:
        print("Saving vector index...")
        com_state.vector_index.save_index()

    if com_state.llm_service:
        print("Closing LLM service...")
        await com_state.llm_service.close()

    print("✓ Shutdown complete")


# =============================================================================
# FastAPI App
# =============================================================================

app = FastAPI(
    title="COM Service",
    description="Context Orchestrator Management for QA Intelligence",
    version="0.1.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[CORS_ORIGIN, "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# API Endpoints
# =============================================================================

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "COM (Context Orchestrator Management)",
        "version": "0.1.0",
        "status": "ready"
    }


@app.get("/health")
async def health() -> ServiceHealth:
    """Health check endpoint"""
    stats = com_state.event_store.get_stats()
    vec_stats = com_state.vector_index.get_stats()

    return ServiceHealth(
        status="healthy",
        total_events=stats["total_events"],
        total_branches=stats["total_branches"],
        total_commits=stats["total_commits"],
        vector_index_size=vec_stats["total_vectors"],
        inverted_index_size=0,  # TODO: implement
        graph_index_size=0,  # TODO: implement
        avg_retrieval_time_ms=0.0,  # TODO: track metrics
        cache_hit_rate=0.0  # TODO: implement cache
    )


@app.post("/ingest", status_code=status.HTTP_201_CREATED)
async def ingest_event(event: Event) -> dict:
    """
    Ingest a new event into COM
    Idempotent - duplicate events will be ignored
    """
    # Ingest into event store
    inserted = com_state.event_store.ingest(event)

    if inserted:
        # Add to vector index
        com_state.vector_index.add_event(event)

        return {
            "success": True,
            "event_id": event.id,
            "message": "Event ingested successfully"
        }
    else:
        return {
            "success": False,
            "event_id": event.id,
            "message": "Duplicate event (already exists)"
        }


@app.post("/retrieve", response_model=RetrievalResponse)
async def retrieve_context(request: RetrievalRequest) -> RetrievalResponse:
    """
    Retrieve context pack based on policy and query
    Main endpoint for agent integration
    """
    try:
        context_pack = com_state.policy_engine.retrieve_context(
            task=request.task,
            project=request.project,
            branch=request.branch,
            inputs=request.inputs,
            policy_id=request.policy_id,
            token_budget=request.token_budget
        )

        return RetrievalResponse(
            success=True,
            context_pack=context_pack
        )

    except Exception as e:
        return RetrievalResponse(
            success=False,
            error=str(e)
        )


@app.get("/policies")
async def list_policies():
    """List all available policies"""
    policies = []
    for policy_id, policy in com_state.policy_engine.policies.items():
        policies.append({
            "policy_id": policy.policy_id,
            "task": policy.task,
            "budget_tokens": policy.budget_tokens,
            "max_events": policy.max_events
        })
    return {"policies": policies}


@app.get("/policies/{policy_id}")
async def get_policy(policy_id: str):
    """Get policy details"""
    policy = com_state.policy_engine.get_policy(policy_id)
    if policy is None:
        raise HTTPException(status_code=404, detail=f"Policy not found: {policy_id}")
    return policy


@app.get("/events/recent")
async def get_recent_events(
    project: str,
    branch: str = "main",
    limit: int = 50
):
    """Get recent events"""
    events = com_state.event_store.get_recent_events(
        project=project,
        branch=branch,
        limit=limit
    )
    return {
        "events": [
            {
                "id": e.id,
                "type": e.type.value,
                "timestamp": e.timestamp.isoformat(),
                "source": e.source,
                "importance": e.importance,
                "tags": e.tags
            }
            for e in events
        ],
        "total": len(events)
    }


@app.get("/events/{event_id}")
async def get_event(event_id: str):
    """Get event by ID"""
    event = com_state.event_store.get_event(event_id)
    if event is None:
        raise HTTPException(status_code=404, detail=f"Event not found: {event_id}")
    return event


@app.get("/branches")
async def list_branches():
    """List all memory branches (Git-style)"""
    branches = com_state.memory_journal.list_branches()
    return {
        "branches": [
            {
                "name": b.name,
                "head_commit": b.head_commit,
                "created_at": b.created_at.isoformat() if b.created_at else None,
                "description": b.description
            }
            for b in branches
        ]
    }


@app.post("/branches")
async def create_branch(
    branch_name: str,
    from_branch: str = "main",
    description: Optional[str] = None
):
    """Create a new memory branch (similar to: git branch <name> <from-branch>)"""
    try:
        branch = com_state.memory_journal.create_branch(branch_name, from_branch, description)
        return {
            "success": True,
            "branch": {
                "name": branch.name,
                "head_commit": branch.head_commit,
                "description": branch.description
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.delete("/branches/{branch_name}")
async def delete_branch(branch_name: str, force: bool = False):
    """Delete a memory branch (similar to: git branch -d <name>)"""
    try:
        success = com_state.memory_journal.delete_branch(branch_name, force)
        if success:
            return {"success": True, "message": f"Branch '{branch_name}' deleted"}
        else:
            raise HTTPException(status_code=404, detail=f"Branch not found: {branch_name}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# =============================================================================
# Memory Commits API
# =============================================================================

@app.post("/commits")
async def create_commit(
    branch: str,
    event_ids: List[str],
    message: str,
    author: str = "system",
    tags: Optional[List[str]] = None
):
    """Create a memory commit (similar to: git commit -m "message")"""
    try:
        commit = com_state.memory_journal.commit(branch, event_ids, message, author, tags)
        return {
            "success": True,
            "commit": {
                "commit_id": commit.commit_id,
                "branch": commit.branch,
                "message": commit.message,
                "author": commit.author,
                "timestamp": commit.timestamp.isoformat() if commit.timestamp else None,
                "event_count": len(commit.event_ids),
                "tags": commit.tags
            }
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/commits/{commit_id}")
async def get_commit(commit_id: str):
    """Get commit details"""
    commit = com_state.memory_journal.get_commit(commit_id)
    if commit is None:
        raise HTTPException(status_code=404, detail=f"Commit not found: {commit_id}")

    return {
        "commit_id": commit.commit_id,
        "branch": commit.branch,
        "message": commit.message,
        "author": commit.author,
        "timestamp": commit.timestamp.isoformat() if commit.timestamp else None,
        "event_ids": commit.event_ids,
        "parent_commit": commit.parent_commit,
        "tags": commit.tags
    }


@app.get("/commits")
async def get_commit_history(branch: str = "main", limit: int = 50):
    """Get commit history for a branch (similar to: git log)"""
    commits = com_state.memory_journal.get_commit_history(branch, limit)
    return {
        "branch": branch,
        "commits": [
            {
                "commit_id": c.commit_id,
                "message": c.message,
                "author": c.author,
                "timestamp": c.timestamp.isoformat() if c.timestamp else None,
                "event_count": len(c.event_ids),
                "tags": c.tags
            }
            for c in commits
        ],
        "total": len(commits)
    }


@app.get("/commits/{commit_id}/events")
async def get_commit_events(commit_id: str):
    """Get all events included in a commit"""
    events = com_state.memory_journal.get_events_at_commit(commit_id)
    return {
        "commit_id": commit_id,
        "events": [
            {
                "id": e.id,
                "type": e.type.value,
                "timestamp": e.timestamp.isoformat(),
                "source": e.source,
                "importance": e.importance,
                "tags": e.tags
            }
            for e in events
        ],
        "total": len(events)
    }


@app.get("/commits/{commit_id}/context")
async def get_context_at_commit(commit_id: str, max_events: int = 100):
    """Get context snapshot at a specific commit"""
    try:
        context = com_state.memory_journal.get_context_at_commit(commit_id, max_events)
        return context
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/commits/diff")
async def diff_commits(commit_id_1: str, commit_id_2: str):
    """Compare two commits (similar to: git diff <commit1> <commit2>)"""
    try:
        diff = com_state.memory_journal.diff_commits(commit_id_1, commit_id_2)
        return diff
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# =============================================================================
# Memory Tags API
# =============================================================================

@app.post("/tags")
async def create_tag(tag_name: str, commit_id: str, message: str):
    """Create a tag pointing to a commit (similar to: git tag -a <tag> -m "message" <commit>)"""
    try:
        tag = com_state.memory_journal.create_tag(tag_name, commit_id, message)
        return {
            "success": True,
            "tag": {
                "tag_name": tag.tag_name,
                "commit_id": tag.commit_id,
                "message": tag.message,
                "created_at": tag.created_at.isoformat() if tag.created_at else None
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/tags")
async def list_tags():
    """List all tags (similar to: git tag -l)"""
    tags = com_state.memory_journal.list_tags()
    return {
        "tags": [
            {
                "tag_name": t.tag_name,
                "commit_id": t.commit_id,
                "message": t.message,
                "created_at": t.created_at.isoformat() if t.created_at else None
            }
            for t in tags
        ]
    }


@app.get("/tags/{tag_name}")
async def get_tag(tag_name: str):
    """Get tag details"""
    tag = com_state.memory_journal.get_tag(tag_name)
    if tag is None:
        raise HTTPException(status_code=404, detail=f"Tag not found: {tag_name}")

    return {
        "tag_name": tag.tag_name,
        "commit_id": tag.commit_id,
        "message": tag.message,
        "created_at": tag.created_at.isoformat() if tag.created_at else None
    }


@app.get("/tags/{tag_name}/context")
async def get_context_at_tag(tag_name: str):
    """Get context snapshot at a tagged commit"""
    try:
        context = com_state.memory_journal.get_context_at_tag(tag_name)
        return context
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.delete("/tags/{tag_name}")
async def delete_tag(tag_name: str):
    """Delete a tag (similar to: git tag -d <tag>)"""
    success = com_state.memory_journal.delete_tag(tag_name)
    if success:
        return {"success": True, "message": f"Tag '{tag_name}' deleted"}
    else:
        raise HTTPException(status_code=404, detail=f"Tag not found: {tag_name}")


# =============================================================================
# Memory Journal Statistics
# =============================================================================

@app.get("/journal/stats")
async def get_journal_stats():
    """Get memory journal statistics"""
    return com_state.memory_journal.get_journal_stats()


@app.get("/stats")
async def get_stats():
    """Get comprehensive COM statistics"""
    event_stats = com_state.event_store.get_stats()
    vector_stats = com_state.vector_index.get_stats()

    return {
        "event_store": event_stats,
        "vector_index": vector_stats,
        "policies": len(com_state.policy_engine.policies)
    }


# =============================================================================
# Roll-up Summary Endpoints (LLM-Enhanced)
# =============================================================================

class DailyRollupRequest(BaseModel):
    """Request for daily rollup"""
    project: str
    date: str  # ISO format YYYY-MM-DD
    branch: str = "main"
    use_llm: bool = True


class WeeklyRollupRequest(BaseModel):
    """Request for weekly rollup"""
    project: str
    week_start: str  # ISO format YYYY-MM-DD
    branch: str = "main"
    use_llm: bool = True


class PatternAnalysisRequest(BaseModel):
    """Request for failure pattern analysis"""
    project: str
    pattern_tag: str
    branch: str = "main"
    days: int = 30
    use_llm: bool = True


@app.post("/rollups/daily")
async def generate_daily_rollup(request: DailyRollupRequest):
    """
    Generate daily rollup summary with LLM-powered narrative

    Returns:
        - Statistical aggregation
        - Key events
        - Simple text summary
        - Narrative summary (LLM-generated if available)
    """
    from datetime import datetime

    date = datetime.fromisoformat(request.date)

    rollup = await com_state.rollup_service.generate_daily_rollup_async(
        project=request.project,
        date=date,
        branch=request.branch,
        use_llm=request.use_llm
    )

    return rollup


@app.post("/rollups/weekly")
async def generate_weekly_rollup(request: WeeklyRollupRequest):
    """
    Generate weekly rollup summary with LLM-powered narrative

    Returns:
        - Statistical aggregation
        - Trend analysis
        - Simple text summary
        - Narrative summary (LLM-generated if available)
    """
    from datetime import datetime

    week_start = datetime.fromisoformat(request.week_start)

    rollup = await com_state.rollup_service.generate_weekly_rollup_async(
        project=request.project,
        week_start=week_start,
        branch=request.branch,
        use_llm=request.use_llm
    )

    return rollup


@app.post("/rollups/pattern-analysis")
async def analyze_failure_pattern(request: PatternAnalysisRequest):
    """
    Analyze a specific failure pattern with LLM insights

    Returns:
        - Pattern statistics
        - Affected sources
        - Simple summary
        - Narrative analysis (LLM-generated if available)
    """
    analysis = await com_state.rollup_service.analyze_failure_pattern_async(
        project=request.project,
        pattern_tag=request.pattern_tag,
        branch=request.branch,
        days=request.days,
        use_llm=request.use_llm
    )

    return analysis


@app.get("/rollups/llm-status")
async def check_llm_status():
    """Check if LLM service is available"""
    if not com_state.llm_service:
        return {
            "available": False,
            "status": "LLM service not initialized",
            "fallback_mode": True
        }

    healthy = await com_state.llm_service.check_health()

    return {
        "available": healthy,
        "status": "LM Studio connected" if healthy else "LM Studio not available",
        "fallback_mode": not healthy,
        "model": com_state.llm_service.model if healthy else None
    }


# =============================================================================
# Error Handlers
# =============================================================================

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler"""
    print(f"Error: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "detail": str(exc)
        }
    )


# =============================================================================
# Run Server
# =============================================================================

def start():
    """Start COM service"""
    import uvicorn

    port = int(os.getenv("COM_SERVICE_PORT", "8083"))
    host = os.getenv("COM_SERVICE_HOST", "0.0.0.0")

    uvicorn.run(
        "api.main:app",
        host=host,
        port=port,
        reload=True,
        log_level="info"
    )


if __name__ == "__main__":
    start()
