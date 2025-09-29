"""Basic test without Playwright to verify test framework setup"""

import pytest


@pytest.mark.asyncio
async def test_basic_async():
    """Basic async test without Playwright"""
    assert True


def test_basic_sync():
    """Basic sync test"""
    assert True