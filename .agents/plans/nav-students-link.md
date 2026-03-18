# Feature: Students Link in Nav Bar

The following plan should be complete, but validate documentation and codebase patterns before implementing.

## Feature Description

Add a "Students" link to the teacher nav bar (`src/components/nav-bar.tsx`) that navigates to the `/student` join page — the student-facing screen where students enter their join code. This gives teachers a one-tap shortcut to display or reference the student join screen without navigating manually.

## User Story

As a teacher
I want a "Students" link in the top nav bar
So that I can quickly navigate to the student join page to reference or display it during class

## Problem Statement

The student join page (`/student`) is only reachable by directly typing the URL. There's no nav shortcut, so the teacher can't get there quickly mid-lesson.

## Solution Statement

Add a new entry to `NAV_LINKS` in `src/components/nav-bar.tsx` pointing to `/student`. Keep parity with the current nav rendering behavior (labels only).

## Feature Metadata

**Feature Type**: Enhancement
**Estimated Complexity**: Low
**Primary Systems Affected**: `src/components/nav-bar.tsx`
**Dependencies**: None

---

## CONTEXT REFERENCES

### Relevant Codebase Files — MUST READ BEFORE IMPLEMENTING

- `src/components/nav-bar.tsx` (lines 186–193) — `NAV_LINKS` array; add entry here. Verify active-link match logic for `/student`.
- `src/app/student/page.tsx` — confirms `/student` is the student join screen (enter code → pick name). This is the target route.
- `src/middleware.ts` — `/student` is NOT in the protected matcher, so no auth middleware changes needed.
- `src/app/student/layout.tsx` — student routes have their own layout; nav bar is not rendered there. No layout conflict.

### Patterns to Follow

**NAV_LINKS entry pattern** (`src/components/nav-bar.tsx` lines 186–193):
```ts
const NAV_LINKS = [
  { href: "/coach",        label: "Coach",     icon: GraduationCapIcon },
  { href: "/classes",      label: "Classes",   icon: UsersIcon },
  { href: "/gradebook",    label: "Gradebook", icon: BookOpenIcon },
  { href: "/store",        label: "Store",     icon: ShoppingBagIcon },
  { href: "/board",        label: "Board",     icon: MonitorIcon },
  { href: "/parent-comms", label: "Comms",     icon: MessageSquareIcon },
  // ADD:
  { href: "/student",      label: "Students",  icon: UsersIcon },
];
```

Note: `icon` exists in `NAV_LINKS` but is currently not rendered in nav JSX (only `href` and `label` are used). Do not add new icon imports unless icon rendering is added for all links.

---

## STEP-BY-STEP TASKS

### UPDATE `src/components/nav-bar.tsx`

- **ADD** `{ href: "/student", label: "Students", icon: UsersIcon }` or reuse existing icon pattern already in file (avoid introducing unused imports)
- **VERIFY FIRST** active-link matching logic in `nav-bar.tsx` (exact/prefix) so `/student` can highlight correctly
- **GOTCHA**: The `icon` field in `NAV_LINKS` is declared but the current render loop (`map`) only uses `href` and `label` — do NOT add icon rendering unless it already exists for other links (keep parity)
- **GOTCHA**: `/student` is an unauthenticated route. The nav link still works — clicking navigates there normally. The page renders its own layout so no double-nav issue.
- **VALIDATE**: `npx tsc --noEmit`

---

## VALIDATION COMMANDS

### Level 1: Types
```bash
npx tsc --noEmit
```

### Level 2: Lint
```bash
npm run lint
```

### Level 3: Manual Validation

1. Open any teacher dashboard page
2. Verify "Students" appears in the top nav between the appropriate links
3. Click "Students" → confirm navigates to the student join screen (`/student`)
4. Verify active highlight works (nav link highlights when on `/student`)

---

## ACCEPTANCE CRITERIA

- [ ] "Students" link appears in teacher nav bar
- [ ] Clicking it navigates to `/student` (student join screen)
- [ ] Active state highlights correctly when on `/student`
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] No lint errors (`npm run lint`)
- [ ] No existing nav links broken

---

## NOTES

- Prefer reusing existing imports unless nav icon rendering is expanded globally.
- If the user actually wants a new teacher-facing "Students" page (cross-class roster view) rather than linking to the student join screen, a new route `/students` would need to be created and added to the middleware matcher — but this plan assumes linking the existing `/student` page.
- **Confidence Score**: 10/10 — single file edit, zero ambiguity.
