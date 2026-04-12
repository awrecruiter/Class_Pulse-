---
name: plan-feature
description: Create a context-rich implementation plan without writing code.
---

# Plan A Feature

Goal: produce a plan another implementation pass can execute directly.

## Process

1. Understand the requested feature or bug.
2. Read the existing code and tests in the affected area.
3. Identify settings, auth, voice, queue, or schedule behaviors that must remain stable.
4. Research official docs only when the answer may have changed or external APIs are involved.
5. Produce a markdown plan with:
   - feature description
   - user story
   - problem statement
   - solution statement
   - touched systems and files
   - patterns to mirror
   - step-by-step tasks
   - tests to add
   - validation commands
   - risks and open questions

## Rules

- do not implement during this step
- prefer repo evidence over assumptions
- include exact file paths
