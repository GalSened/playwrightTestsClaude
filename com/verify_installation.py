#!/usr/bin/env python3
"""
COM Installation Verification Script
Quick check that all components can be imported and initialized
"""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

def check_imports():
    """Check if all modules can be imported"""
    print("=" * 60)
    print("COM Installation Verification")
    print("=" * 60)
    print()

    checks = []

    # Check core models
    print("1. Checking core models...")
    try:
        from core.models import Event, EventType, RetrievalPolicy, ContextPack
        print("   ✓ Core models OK")
        checks.append(True)
    except Exception as e:
        print(f"   ✗ Core models FAILED: {e}")
        checks.append(False)

    # Check event store
    print("2. Checking event store...")
    try:
        from storage.event_store import EventStore
        print("   ✓ Event store OK")
        checks.append(True)
    except Exception as e:
        print(f"   ✗ Event store FAILED: {e}")
        checks.append(False)

    # Check vector index
    print("3. Checking vector index...")
    try:
        from storage.vector_index import VectorIndex
        print("   ✓ Vector index OK")
        checks.append(True)
    except Exception as e:
        print(f"   ✗ Vector index FAILED: {e}")
        checks.append(False)

    # Check policy engine
    print("4. Checking policy engine...")
    try:
        from core.policy_engine import PolicyEngine
        print("   ✓ Policy engine OK")
        checks.append(True)
    except Exception as e:
        print(f"   ✗ Policy engine FAILED: {e}")
        checks.append(False)

    # Check FastAPI
    print("5. Checking FastAPI...")
    try:
        import fastapi
        import uvicorn
        print("   ✓ FastAPI OK")
        checks.append(True)
    except Exception as e:
        print(f"   ✗ FastAPI FAILED: {e}")
        checks.append(False)

    # Check dependencies
    print("6. Checking dependencies...")
    try:
        import faiss
        import sentence_transformers
        import pydantic
        import yaml
        import click
        import rich
        print("   ✓ Dependencies OK")
        checks.append(True)
    except Exception as e:
        print(f"   ✗ Dependencies FAILED: {e}")
        checks.append(False)

    print()
    print("=" * 60)

    passed = sum(checks)
    total = len(checks)

    if passed == total:
        print(f"✓ All checks passed ({passed}/{total})")
        print("=" * 60)
        print()
        print("COM is ready to use!")
        print()
        print("Next steps:")
        print("  1. Start COM service: python -m api.main")
        print("  2. Or use startup script: ./start.sh (Linux/Mac) or start.bat (Windows)")
        print("  3. Verify health: curl http://localhost:8083/health")
        print()
        return True
    else:
        print(f"✗ {total - passed} checks failed ({passed}/{total} passed)")
        print("=" * 60)
        print()
        print("Please fix the issues above before starting COM service.")
        print()
        return False


def check_configuration():
    """Check if configuration is valid"""
    print("Checking configuration...")
    try:
        from dotenv import load_dotenv
        import os

        load_dotenv()

        config = {
            "COM_SERVICE_PORT": os.getenv("COM_SERVICE_PORT", "8083"),
            "EVENT_LOG_DB_PATH": os.getenv("EVENT_LOG_DB_PATH", "./data/events.db"),
            "VECTOR_INDEX_PATH": os.getenv("VECTOR_INDEX_PATH", "./data/vector_index.faiss"),
            "EMBEDDING_MODEL": os.getenv("EMBEDDING_MODEL", "BAAI/bge-large-en-v1.5")
        }

        print("\nConfiguration:")
        for key, value in config.items():
            print(f"  - {key}: {value}")

        return True
    except Exception as e:
        print(f"✗ Configuration check failed: {e}")
        return False


if __name__ == "__main__":
    success = check_imports()

    if success:
        check_configuration()
        sys.exit(0)
    else:
        sys.exit(1)
