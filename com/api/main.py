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
    ServiceHealth
)
from storage.event_store import EventStore
from storage.vector_index import VectorIndex, HybridRetriever
from core.policy_engine import PolicyEngine


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
    """List all memory branches"""
    branches = com_state.event_store.list_branches()
    return {"branches": branches}


@app.post("/branches")
async def create_branch(branch_name: str, description: Optional[str] = None):
    """Create a new memory branch"""
    success = com_state.event_store.create_branch(branch_name, description)
    if success:
        return {"success": True, "branch": branch_name}
    else:
        raise HTTPException(status_code=400, detail=f"Branch already exists: {branch_name}")


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
