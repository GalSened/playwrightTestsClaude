#!/usr/bin/env python3
"""
Fix IndentationErrors in test_bulk_operations_converted.py
"""

import re

def fix_bulk_operations_file():
    file_path = "C:/Users/gals/seleniumpythontests-1/playwright_tests/tests/bulk_operations/test_bulk_operations_converted.py"
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Fix all the patterns systematically
    fixed_content = content
    
    # Pattern 1: Fix method blocks with try/finally issues
    patterns = [
        # Document signing method
        (r'    async def test_bulk_document_signing\(self\):\n        """Test bulk document signing functionality\."""\n        await self\._setup_browser\(\)\n        try:\n        # Create document configurations for signing\n(.*?)\n    @pytest\.mark\.contact_bulk\n    @pytest\.mark\.asyncio\n        finally:\n            await self\._cleanup_browser\(\)',
         '''    async def test_bulk_document_signing(self):
        """Test bulk document signing functionality."""
        await self._setup_browser()
        try:
            # Create document configurations for signing\n\\1
        finally:
            await self._cleanup_browser()

    @pytest.mark.contact_bulk
    @pytest.mark.asyncio'''),
        
        # Contact creation method
        (r'    async def test_bulk_contact_creation\(self\):\n        """Test bulk contact creation functionality\."""\n        await self\._setup_browser\(\)\n        try:\n        # Create contact configurations\n(.*?)\n    @pytest\.mark\.contact_bulk\n    @pytest\.mark\.asyncio\n        finally:\n            await self\._cleanup_browser\(\)',
         '''    async def test_bulk_contact_creation(self):
        """Test bulk contact creation functionality."""
        await self._setup_browser()
        try:
            # Create contact configurations\n\\1
        finally:
            await self._cleanup_browser()

    @pytest.mark.contact_bulk
    @pytest.mark.asyncio'''),
        
        # Contact cleanup method
        (r'    async def test_bulk_contact_cleanup\(self\):\n        """Test bulk contact cleanup functionality\."""\n        await self\._setup_browser\(\)\n        try:\n        try:\n(.*?)\n    @pytest\.mark\.template_bulk\n    @pytest\.mark\.asyncio\n        finally:\n            await self\._cleanup_browser\(\)',
         '''    async def test_bulk_contact_cleanup(self):
        """Test bulk contact cleanup functionality."""
        await self._setup_browser()
        try:\n\\1
        finally:
            await self._cleanup_browser()

    @pytest.mark.template_bulk
    @pytest.mark.asyncio'''),
    ]
    
    # Apply each pattern
    for pattern, replacement in patterns:
        fixed_content = re.sub(pattern, replacement, fixed_content, flags=re.DOTALL)
    
    # Generic pattern to fix remaining indentation issues
    # Fix try blocks that are not properly indented
    fixed_content = re.sub(r'(\n        try:\n)        # ', r'\1            # ', fixed_content)
    
    # Fix finally blocks that are mixed with decorators
    fixed_content = re.sub(
        r'(\n    @pytest\.mark\.\w+\n    @pytest\.mark\.asyncio\n)        finally:\n            await self\._cleanup_browser\(\)\n    async def',
        r'\1    async def',
        fixed_content
    )
    
    # Fix finally blocks that should be at method level
    fixed_content = re.sub(
        r'(\n        except Exception as e:\n            pytest\.skip\(f"[^"]*: \{e\}"\)\n\n)    @pytest\.mark\.\w+\n    @pytest\.mark\.asyncio\n        finally:\n            await self\._cleanup_browser\(\)\n    async def',
        r'\1        finally:\n            await self._cleanup_browser()\n\n    @pytest.mark.\\2\n    @pytest.mark.asyncio\n    async def',
        fixed_content
    )
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(fixed_content)
    
    print(f"Fixed indentation errors in {file_path}")

if __name__ == "__main__":
    fix_bulk_operations_file()