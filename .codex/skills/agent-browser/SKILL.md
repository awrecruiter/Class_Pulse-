---
name: agent-browser
description: Browser automation reference for end-to-end testing and UI validation.
---

# Browser Automation

Use browser automation when the task requires real UI interaction, screenshots, or end-to-end verification.

## Typical Flow

1. Start the app locally.
2. Open the target URL.
3. Snapshot interactive elements.
4. Click, fill, or navigate.
5. Re-snapshot after DOM changes.
6. Capture screenshots for important states.

## Core Commands

```bash
agent-browser open <url>
agent-browser snapshot -i
agent-browser click @e1
agent-browser fill @e2 "text"
agent-browser wait --load networkidle
agent-browser screenshot path.png
agent-browser close
```

## Notes

- re-snapshot after navigation
- use this for real verification, not speculative browsing
