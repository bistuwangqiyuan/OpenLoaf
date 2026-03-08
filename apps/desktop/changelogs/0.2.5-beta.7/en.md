---
version: 0.2.5-beta.7
date: 2026-03-08
---

## 🐛 Bug Fixes

- Fix incremental update version fallback: prefer bundled server when versions match, preventing Web/Server mismatch after desktop upgrade
- Fix `fs.list` throwing ENOENT when directory does not exist, now returns empty entries
