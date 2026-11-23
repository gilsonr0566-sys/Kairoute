# Rule links for commits made without a `Rule:` line

Every commit that changes `src/` or `worker/` after 2026-11-23 23:30 UTC names its rule in docs/qa/RULES.md with a
line `Rule: R-xx`. When a commit went in without one, link it here instead (checked by tools/truth/rules-check.cjs).
One line per commit: the start of its sha (8 or more characters), the rule(s), and why.

| Commit | Rule | Why |
|---|---|---|
