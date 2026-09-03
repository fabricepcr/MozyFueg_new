---
name: Driver delivery links
description: Security and behavior rules for order-status actions sent to delivery drivers through WhatsApp.
---

Driver WhatsApp messages may include a signed, driver-specific link that expires after 48 hours. Opening the link must only display a confirmation page; the order changes to delivered only after the driver submits the confirmation.

**Why:** Messaging clients and security scanners automatically open link previews. Mutating an order on GET could falsely mark it delivered without a driver action.

**How to apply:** Keep status-changing routes token-verified, idempotent, and POST-only. Reject expired/tampered tokens and cancelled, refunded, pickup, or already-completed orders. Broadcast successful external changes to the admin realtime channel.