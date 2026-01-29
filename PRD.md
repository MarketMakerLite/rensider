# PRD: renbot-next Continuous Improvement

## Goal
Fix lint errors, type issues, and code quality problems in the renbot-next codebase.

## Tasks

### High Priority
- [x] 1. Fix unused imports and variables (11 instances across codebase)
- [x] 2. Fix `any` types in chart layer components (AxisLayer, BarLayer, GridLayer, LineLayer)
- [x] 3. Fix conditional useMemo call in `components/twc/pagination.tsx`
- [x] 4. Fix aria-sort accessibility warning in `components/twc/sortable-header.tsx`

### Medium Priority
- [x] 5. Add error handling to `/new` page (already had Promise.allSettled + error.tsx)
- [x] 6. Add error handling to `/alerts` page (already had useServerAction error state + error.tsx)
- [x] 7. Add error.tsx boundary to `/stock/[ticker]` route
- [x] 8. Add error.tsx boundary to `/fund/[cik]` route
- [x] 9. Add `not-found.tsx` to dynamic routes with proper `notFound()` calls
- [x] 10. Build passes without errors
- [x] 11. Convert robots.txt to dynamic app/robots.ts, block /api/ from crawlers
- [x] 12. Suppress legitimate `set-state-in-effect` lint errors (0 errors, 0 warnings)

### Low Priority
- [ ] 13. Add `aria-label` attributes to filter/action buttons that only have icon content

## Completed
- Tasks 1-4: Lint fixes (unused imports, any types, conditional hooks, aria-sort)
- Tasks 5-6: Verified existing error handling was already in place
- Tasks 7-8: Added error.tsx boundaries to stock and fund detail pages
- Task 9: Added not-found.tsx to /stock/[ticker], /fund/[cik], /insider/[cik] with notFound() calls
- Task 10: Verified build passes cleanly
- Task 11: Dynamic robots.ts with /api/ disallow rule
- Task 12: Clean lint run — 0 errors, 0 warnings
