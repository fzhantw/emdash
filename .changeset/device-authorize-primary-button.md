---
"@emdash-cms/admin": patch
---

Fixes the Authorize button on the device authorization page (`/_emdash/admin/device`), which rendered as a wide neutral button with its label pinned to one edge, so it read like a text field instead of the main action. It now uses the primary button style with a centered label, clearly distinct from Deny.
