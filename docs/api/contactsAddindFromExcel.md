Requirements:

Allow re-adding deleted contacts

If a contact was previously deleted, the user should be able to add it again without restriction.

Excel upload with duplicates

If an uploaded Excel file contains contacts that already exist in the system, the upload should not fail.

Instead, skip the duplicated contacts and continue adding the rest.

Provide a summary message (e.g., “3 duplicate contacts were skipped.”).

Self-addition

The system must allow the logged-in user to add themselves as a contact, even if they are not already in the contact list.

Error handling and messaging

Introduce clear and user-friendly error messages for different failure scenarios:

Invalid data: “One or more fields contain incorrect data. Please review and correct.”

Duplicate contact (manual add): “This contact already exists in the system.”

Excel upload duplicates: “X duplicate contacts were skipped during upload.”

Other errors: Map and display specific messages where applicable.
