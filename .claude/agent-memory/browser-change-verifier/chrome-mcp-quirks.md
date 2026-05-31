---
name: chrome-mcp-quirks
description: Practical quirks when verifying this app with the claude-in-chrome MCP (tab selection, controlled inputs, SSR-HTML check)
metadata:
  type: feedback
---

Practical notes for browser verification of the budgeting app via claude-in-chrome MCP.

**Why:** these cost a round-trip each time if rediscovered.
**How to apply:** at the start of a verification run.

- **Browser/tab selection:** `list_connected_browsers` then `select_browser(deviceId)`. As a subagent, `AskUserQuestion` is NOT available — if there's exactly one local browser, proceed with it and note the choice. `tabs_context_mcp` returns the REAL tab id (e.g. the existing "Budgeting" tab on localhost:3000); don't invent ids — a guessed id errors with "Tab N no longer exists".
- **Controlled number inputs** (onboarding budget, Add-entry amount): `form_input` sets the DOM value but does NOT fire React onChange. Use real keystrokes: `left_click` the field → `key cmd+a` → `type`. Verify with `javascript_tool` reading `input.value`.
- **Number amount inputs take a DOT decimal** (`12.50`), rendered back as de-DE `12,50 €`.
- **Authoritative SSR check:** session cookie is httpOnly so `document.cookie` is empty (expected). To prove the first paint is server-rendered, run in-page `fetch('/route',{credentials:'include'}).then(r=>r.text())` and string-match the expected values + assert absence of "Loading"/"Not Found"/"UNAUTHORIZED". This carries the cookie and returns the true SSR HTML.
- **Auth-guard check** is fastest via Bash `curl`: no cookie / garbage cookie → expect `307 .../login`.
- **Console/network:** clear (`clear:true`) before the action you want to observe; `read_console_messages` needs a `pattern` (use `.*` for everything). After a clean hard load this app logs nothing.
- **Screenshots** are condensed by default; pass `save_to_disk:true` then Read the path for full detail, or use `zoom` on a region (e.g. the bottom nav `[0,600,1232,692]`).
