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

### Low Priority
- [ ] 9. Add `not-found.tsx` to dynamic routes (`/stock/[ticker]`, `/fund/[cik]`, `/insider/[cik]`) for better 404 handling

## Completed
- Tasks 1-4: Lint fixes (unused imports, any types, conditional hooks, aria-sort)
- Tasks 5-6: Verified existing error handling was already in place
- Tasks 7-8: Added error.tsx boundaries to stock and fund detail pages
