---
version: 0.2.5-beta.13
date: 2026-03-10
---

## 🐛 Bug Fixes

- Fix critical bug where database migration SQL statements with leading Prisma comments were silently dropped, preventing Board table creation
- Add repair mechanism to detect and re-execute "ghost" migrations that were recorded as applied but never actually executed
- Fix HTML content stripping and URL validation security issues
