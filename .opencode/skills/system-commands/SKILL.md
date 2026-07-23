---
name: system-commands
description: Use when the user asks to open programs, files, folders, or websites on their computer. Handles commands like "open Chrome", "open calculator", "open folder", etc.
---

# System Commands Skill

This skill handles system-level commands to open programs, files, and websites.

## Supported Commands

### Open Programs
- "open Chrome" → `Start-Process chrome`
- "open calculator" → `Start-Process calc`
- "open notepad" → `Start-Process notepad`
- "open explorer" → `Start-Process explorer`
- "open Edge" → `Start-Process msedge`

### Open Websites
- "open google" → `Start-Process "https://www.google.com"`
- "open youtube" → `Start-Process "https://www.youtube.com"`

### Open Folders
- "open documents" → `Start-Process explorer "C:\Users\$env:USERNAME\Documents"`
- "open downloads" → `Start-Process explorer "C:\Users\$env:USERNAME\Downloads"`

### System Info
- "what time is it" → `Get-Date`
- "system info" → `Get-ComputerInfo`

## Implementation

Use PowerShell commands with `Start-Process` for opening programs and files.

```powershell
# Open a program
Start-Process programname

# Open a website
Start-Process "https://example.com"

# Open a folder
Start-Process explorer "C:\path\to\folder"
```

## Response Format

When handling system commands:
1. Execute the command immediately
2. Confirm what was done: "Opening Chrome now" or "Calculator opened"
3. Do NOT generate code unless explicitly asked
4. Do NOT discuss unrelated topics like FOREX or coding
