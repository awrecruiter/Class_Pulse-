Create a product requirements document from the current conversation and codebase context.

Output:
- default file: `PRD.md`
- if the user gives a path or filename, write there instead

Required sections:
- Executive Summary
- Mission
- Target Users
- MVP Scope
- User Stories
- Core Architecture And Patterns
- Tools Or Features
- Technology Stack
- Security And Configuration
- API Specification when applicable
- Success Criteria
- Implementation Phases
- Future Considerations
- Risks And Mitigations
- Appendix when useful

Rules:
- use markdown
- keep it specific to this repo and current request
- mark in-scope items with `✅`
- mark out-of-scope items with `❌`
- note assumptions clearly
