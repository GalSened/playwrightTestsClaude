"""
Vector Index - FAISS-based semantic search
Uses sentence-transformers for embedding generation
"""

import faiss
import numpy as np
import pickle
from pathlib import Path
from typing import List, Optional, Tuple, Dict, Any
from sentence_transformers import SentenceTransformer

from core.models import Event


class VectorIndex:
    """
    FAISS-based vector index for semantic search
    Uses BGE-Large embeddings (1024 dimensions)
    """

    def __init__(
        self,
        model_name: str = "BAAI/bge-large-en-v1.5",
        index_path: Optional[str] = None,
        dimension: int = 1024
    ):
        self.model_name = model_name
        self.dimension = dimension
        self.index_path = Path(index_path) if index_path else None

        # Initialize embedding model
        print(f"Loading embedding model: {model_name}...")
        self.model = SentenceTransformer(model_name)
        print(f"Model loaded. Embedding dimension: {self.dimension}")

        # Initialize or load FAISS index
        if self.index_path and self.index_path.exists():
            self._load_index()
        else:
            # Create new index with inner product (for cosine similarity)
            self.index = faiss.IndexFlatIP(self.dimension)
            self.event_id_map: List[str] = []  # Maps FAISS index to event IDs

        self.normalize_embeddings = True  # For cosine similarity

    def _load_index(self):
        """Load FAISS index and metadata from disk"""
        print(f"Loading FAISS index from {self.index_path}...")
        self.index = faiss.read_index(str(self.index_path))

        # Load event ID mapping
        metadata_path = self.index_path.with_suffix(".pkl")
        if metadata_path.exists():
            with open(metadata_path, "rb") as f:
                self.event_id_map = pickle.load(f)
        else:
            self.event_id_map = []

        print(f"Index loaded. Total vectors: {self.index.ntotal}")

    def save_index(self):
        """Save FAISS index and metadata to disk"""
        if not self.index_path:
            raise ValueError("No index_path specified")

        self.index_path.parent.mkdir(parents=True, exist_ok=True)

        print(f"Saving FAISS index to {self.index_path}...")
        faiss.write_index(self.index, str(self.index_path))

        # Save event ID mapping
        metadata_path = self.index_path.with_suffix(".pkl")
        with open(metadata_path, "wb") as f:
            pickle.dump(self.event_id_map, f)

        print(f"Index saved. Total vectors: {self.index.ntotal}")

    def _compute_embedding(self, text: str) -> np.ndarray:
        """Compute embedding for text"""
        embedding = self.model.encode([text], convert_to_numpy=True)[0]

        if self.normalize_embeddings:
            # Normalize for cosine similarity
            norm = np.linalg.norm(embedding)
            if norm > 0:
                embedding = embedding / norm

        return embedding.astype(np.float32)

    def _event_to_text(self, event: Event) -> str:
        """Convert event to text for embedding"""
        # Combine multiple fields for rich semantic representation
        parts = [
            f"Event Type: {event.type.value}",
            f"Source: {event.source}",
            f"Project: {event.project}",
        ]

        if event.tags:
            parts.append(f"Tags: {', '.join(event.tags)}")

        # Add data fields (selective)
        if "error" in event.data:
            parts.append(f"Error: {event.data['error']}")

        if "test_id" in event.data:
            parts.append(f"Test: {event.data['test_id']}")

        if "message" in event.data:
            parts.append(f"Message: {event.data['message']}")

        if "description" in event.data:
            parts.append(f"Description: {event.data['description']}")

        return "\n".join(parts)

    def add_event(self, event: Event) -> bool:
        """
        Add event to vector index
        Returns True if event was added, False if duplicate
        """
        # Check if event already indexed
        if event.id in self.event_id_map:
            return False

        # Compute embedding
        text = self._event_to_text(event)
        embedding = self._compute_embedding(text)

        # Add to index
        self.index.add(np.array([embedding]))
        self.event_id_map.append(event.id)

        return True

    def add_events(self, events: List[Event]) -> int:
        """
        Add multiple events to index
        Returns number of events added
        """
        count = 0
        for event in events:
            if self.add_event(event):
                count += 1
        return count

    def search(
        self,
        query: str,
        k: int = 10,
        min_score: float = 0.0
    ) -> List[Tuple[str, float]]:
        """
        Semantic search for events
        Returns list of (event_id, score) tuples
        """
        if self.index.ntotal == 0:
            return []

        # Compute query embedding
        query_embedding = self._compute_embedding(query)

        # Search
        scores, indices = self.index.search(np.array([query_embedding]), k)

        # Filter and return results
        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx >= 0 and idx < len(self.event_id_map) and score >= min_score:
                event_id = self.event_id_map[idx]
                results.append((event_id, float(score)))

        return results

    def search_with_vector(
        self,
        query_vector: np.ndarray,
        k: int = 10,
        min_score: float = 0.0
    ) -> List[Tuple[str, float]]:
        """
        Search using pre-computed vector
        Useful for advanced retrieval strategies
        """
        if self.index.ntotal == 0:
            return []

        # Normalize if needed
        if self.normalize_embeddings:
            norm = np.linalg.norm(query_vector)
            if norm > 0:
                query_vector = query_vector / norm

        # Search
        scores, indices = self.index.search(
            np.array([query_vector.astype(np.float32)]),
            k
        )

        # Filter and return results
        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx >= 0 and idx < len(self.event_id_map) and score >= min_score:
                event_id = self.event_id_map[idx]
                results.append((event_id, float(score)))

        return results

    def get_stats(self) -> Dict[str, Any]:
        """Get vector index statistics"""
        return {
            "total_vectors": self.index.ntotal,
            "dimension": self.dimension,
            "model": self.model_name,
            "index_type": type(self.index).__name__
        }

    def rebuild(self, events: List[Event]):
        """Rebuild index from scratch with events"""
        print(f"Rebuilding vector index with {len(events)} events...")

        # Create new index
        self.index = faiss.IndexFlatIP(self.dimension)
        self.event_id_map = []

        # Add all events
        added = self.add_events(events)

        print(f"Rebuild complete. Added {added} vectors.")

        # Save if path specified
        if self.index_path:
            self.save_index()


class HybridRetriever:
    """
    Hybrid retrieval combining semantic + keyword + graph
    Implements the policy-driven retrieval logic
    """

    def __init__(
        self,
        vector_index: VectorIndex,
        event_store: Any,  # EventStore (avoiding circular import)
    ):
        self.vector_index = vector_index
        self.event_store = event_store

    def retrieve(
        self,
        query: str,
        project: str,
        branch: str = "main",
        weights: Optional[Dict[str, float]] = None,
        max_events: int = 50
    ) -> List[Tuple[str, float, Event]]:
        """
        Hybrid retrieval with policy-driven scoring
        Returns list of (event_id, score, event) tuples
        """
        # Default weights
        if weights is None:
            weights = {
                "semantic": 1.6,
                "recency": 1.0,
                "importance": 2.0
            }

        # 1. Semantic search
        semantic_results = self.vector_index.search(query, k=max_events * 2)
        semantic_scores = {event_id: score for event_id, score in semantic_results}

        # 2. Get candidate events
        candidate_ids = [event_id for event_id, _ in semantic_results]
        candidates = []

        for event_id in candidate_ids:
            event = self.event_store.get_event(event_id)
            if event and event.project == project and event.branch == branch:
                candidates.append(event)

        # 3. Compute hybrid scores
        from datetime import datetime, timedelta
        now = datetime.utcnow()

        scored_events = []
        for event in candidates:
            score = 0.0

            # Semantic similarity
            if event.id in semantic_scores:
                score += weights.get("semantic", 1.0) * semantic_scores[event.id]

            # Importance
            score += weights.get("importance", 1.0) * event.importance

            # Recency (decay over 30 days)
            age_days = (now - event.timestamp).total_seconds() / 86400
            recency_score = max(0, 1.0 - (age_days / 30.0))
            score += weights.get("recency", 1.0) * recency_score

            scored_events.append((event.id, score, event))

        # 4. Sort by score and limit
        scored_events.sort(key=lambda x: x[1], reverse=True)

        return scored_events[:max_events]
