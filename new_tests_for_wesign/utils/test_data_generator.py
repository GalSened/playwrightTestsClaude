"""
Test Data Generator - Unique Data for Every Test Execution
Ensures no collisions across test runs by using timestamps and UUIDs
Date: 2025-11-03
"""

import datetime
import uuid
import random
import string


class TestDataGenerator:
    """
    Generates unique test data for automation tests.

    Usage:
        generator = TestDataGenerator()
        name = generator.unique_name("EDIT_CANCEL")
        email = generator.unique_email("edit.cancel")
        phone = generator.unique_phone()
    """

    def __init__(self):
        """Initialize with timestamp for this test session"""
        self.timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        self.counter = 0

    def _get_unique_suffix(self) -> str:
        """
        Get a unique suffix combining timestamp and counter.

        Returns:
            str: Unique suffix like "20251103_143025_001"
        """
        self.counter += 1
        return f"{self.timestamp}_{self.counter:03d}"

    def unique_name(self, base_name: str) -> str:
        """
        Generate unique contact name.

        Args:
            base_name: Base name like "EDIT_CANCEL" or "TEST_Contact"

        Returns:
            str: Unique name like "EDIT_CANCEL_20251103_143025_001"

        Example:
            >>> gen = TestDataGenerator()
            >>> gen.unique_name("EDIT_CANCEL")
            'EDIT_CANCEL_20251103_143025_001'
        """
        return f"{base_name}_{self._get_unique_suffix()}"

    def unique_email(self, base_email: str = None) -> str:
        """
        Generate unique email address.

        Args:
            base_email: Base email like "test" or "edit.cancel"
                       If None, generates random base

        Returns:
            str: Unique email like "edit.cancel.20251103_143025_001@test.auto"

        Example:
            >>> gen = TestDataGenerator()
            >>> gen.unique_email("edit.cancel")
            'edit.cancel.20251103_143025_001@test.auto'
        """
        if base_email is None:
            base_email = f"test_{uuid.uuid4().hex[:8]}"

        # Remove @ and domain if provided
        base_email = base_email.split('@')[0]

        return f"{base_email}.{self._get_unique_suffix()}@test.auto"

    def unique_phone(self, country_code: str = "05") -> str:
        """
        Generate unique Israeli mobile phone number.

        Args:
            country_code: Israeli mobile prefix (default: "05")

        Returns:
            str: Unique phone like "0501234567"

        Example:
            >>> gen = TestDataGenerator()
            >>> gen.unique_phone()
            '0501234567'  # (unique random digits)
        """
        # Generate 8 random digits for Israeli mobile format
        # Format: 05X-XXX-XXXX (10 digits total)
        random_digits = ''.join(random.choices(string.digits, k=8))
        return f"{country_code}{random_digits}"

    def unique_tag(self, base_tag: str) -> str:
        """
        Generate unique tag.

        Args:
            base_tag: Base tag like "QA" or "Automation"

        Returns:
            str: Unique tag like "QA_20251103_143025_001"

        Example:
            >>> gen = TestDataGenerator()
            >>> gen.unique_tag("QA")
            'QA_20251103_143025_001'
        """
        return f"{base_tag}_{self._get_unique_suffix()}"

    def unique_tags(self, base_tags: list) -> list:
        """
        Generate list of unique tags.

        Args:
            base_tags: List of base tags like ["QA", "Automation"]

        Returns:
            list: List of unique tags

        Example:
            >>> gen = TestDataGenerator()
            >>> gen.unique_tags(["QA", "Automation"])
            ['QA_20251103_143025_001', 'Automation_20251103_143025_002']
        """
        return [self.unique_tag(tag) for tag in base_tags]

    def unique_hebrew_name(self, base_name: str = None) -> str:
        """
        Generate unique Hebrew name.

        Args:
            base_name: Base Hebrew name like "אברהם כהן"
                      If None, uses default

        Returns:
            str: Unique Hebrew name with timestamp suffix

        Example:
            >>> gen = TestDataGenerator()
            >>> gen.unique_hebrew_name("אברהם כהן")
            'אברהם כהן 20251103_143025_001'
        """
        if base_name is None:
            base_name = "בדיקה אוטומטית"  # "Automated Test" in Hebrew

        return f"{base_name} {self._get_unique_suffix()}"

    def unique_uuid(self) -> str:
        """
        Generate unique UUID string.

        Returns:
            str: UUID like "a1b2c3d4-e5f6-7890-abcd-ef1234567890"

        Example:
            >>> gen = TestDataGenerator()
            >>> gen.unique_uuid()
            'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
        """
        return str(uuid.uuid4())

    def reset_counter(self):
        """
        Reset the internal counter (useful for new test sessions).
        Timestamp remains the same within the test session.
        """
        self.counter = 0


# Convenience function for quick usage
def generate_unique_contact(
    name_base: str = "TEST_Contact",
    email_base: str = "test",
    include_phone: bool = False
) -> dict:
    """
    Quick utility to generate complete unique contact data.

    Args:
        name_base: Base name for contact
        email_base: Base for email
        include_phone: Whether to include phone number

    Returns:
        dict: Contact data with keys: name, email, phone (optional)

    Example:
        >>> contact = generate_unique_contact("EDIT_TEST", "edit.test", True)
        >>> contact
        {
            'name': 'EDIT_TEST_20251103_143025_001',
            'email': 'edit.test.20251103_143025_001@test.auto',
            'phone': '0501234567'
        }
    """
    gen = TestDataGenerator()

    contact = {
        'name': gen.unique_name(name_base),
        'email': gen.unique_email(email_base)
    }

    if include_phone:
        contact['phone'] = gen.unique_phone()

    return contact
