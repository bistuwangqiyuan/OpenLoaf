---
version: 0.2.4-beta.1
date: 2026-03-03
---

## 🐛 Bug Fixes

- Fix PATH resolution on Windows to correctly locate Python and CLI tools
- Fix PATH environment variable not being inherited when server runs as an Electron subprocess
- Fix macOS YML file merge issue that caused auto-update detection to fail
- Fix EPERM permission error when writing incremental update files on Windows
