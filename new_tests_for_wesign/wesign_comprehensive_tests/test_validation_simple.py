"""
Simple Foundation Validation Test (ASCII only)
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from foundation import WeSignTestFoundation, WeSignNavigationUtils, WeSignTestDataManager

def test_imports():
    """Test foundation imports."""
    print("Testing foundation imports...")

    # Test initialization
    auth = WeSignTestFoundation()
    nav = WeSignNavigationUtils()
    data_mgr = WeSignTestDataManager()

    assert auth.base_url == "https://devtest.comda.co.il"
    assert nav.base_url == "https://devtest.comda.co.il"
    assert data_mgr.test_session_id is not None

    print("[PASS] Foundation imports working correctly")
    return True

def test_data_creation():
    """Test data creation."""
    print("Testing data creation...")

    data_mgr = WeSignTestDataManager()

    # Test document creation
    doc_path = data_mgr.create_test_document("test_doc", "Test content", "txt")
    assert doc_path is not None
    assert os.path.exists(doc_path)

    # Test contact generation
    contacts = data_mgr.generate_contact_data(3)
    assert len(contacts) == 3

    # Cleanup
    data_mgr.cleanup_test_data()

    print("[PASS] Data creation working correctly")
    return True

def main():
    """Run validation tests."""
    print("WESIGN FOUNDATION VALIDATION")
    print("=" * 40)

    try:
        test_imports()
        test_data_creation()

        print("=" * 40)
        print("ALL TESTS PASSED!")
        print("Foundation layer ready for Phase 2")
        return True

    except Exception as e:
        print(f"[FAIL] Validation error: {str(e)}")
        return False

if __name__ == "__main__":
    main()