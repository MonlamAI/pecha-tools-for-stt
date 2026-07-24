# QA Sanity Testing Documentation

## Scope

This sanity checklist is prepared for the Pecha STT application (`Next.js + Prisma + PostgreSQL`) and is intended for post-deployment and post-update verification. It covers:

- Frontend pages and core UI flows
- Backend route handlers and server-action-backed behavior
- Authentication and authorization paths
- CRUD modules (department, group, user, task import)
- Task workflow business logic (transcriber/reviewer/final reviewer)
- Reports, dashboards, stats, and integrations
- Database/data integrity checks
- Responsive and browser sanity checks

> Status field is intentionally left as a placeholder (`Pass/Fail`) for execution runs.

---

## Test Environment & Baseline

- **Application type:** Next.js App Router monolith
- **Database:** PostgreSQL via Prisma
- **Core roles:** `TRANSCRIBER`, `REVIEWER`, `FINAL_REVIEWER`
- **Primary states:** `imported`, `transcribing`, `submitted`, `accepted`, `finalised`, `trashed`
- **Key APIs:** `/api/task/*`, `/api/user*`, `/api/sso/receiver`, `/api/roles`, `/api/upload-csv`, `/api/mapping/[email]`
- **Main pages:** `/`, `/dashboard/*`, `/report/*`, `/stats`, `/task`, `/demo`

---

## Module-Wise QA Sanity Checklist

### 1) Authentication, Session, and Authorization

| Feature / Module Name | Test Scenario | Test Steps | Expected Result | Priority | Status (Pass/Fail) | API Validation | UI Validation Points | Error Handling Validation | Authentication & Authorization Checks | Responsive Behavior Checks | Browser Compatibility Considerations | Notes / Edge Cases |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| SSO Receiver (`/api/sso/receiver`) | Valid JWT login flow | Submit valid SSO token and follow redirect | Redirects to `/?session=<email>` and user session resolves successfully | High | Pass/Fail | Verify `POST /api/sso/receiver` returns redirect target and upserts user/group/role data | Home page loads with user context and task UI | Invalid token should return error without app crash | Verify token signature/issuer/audience checks; role mapping should match payload | Confirm login UI and redirect experience on mobile viewports | Validate on latest Chrome, Edge, Firefox, Safari | Validate behavior when `PORTAL_PUBLIC_KEY_PATH` or SSO env values are missing |
| Session Query Login (`/?session=`) | Valid manual session | Open app with existing valid user email in query | User data loads and task queue appears | High | Pass/Fail | Verify `fetchUserDataBySession` path returns user info | No blank loader loop; task panel + sidebar render | Invalid session should show controlled error text | Ensure only intended users can proceed; check behavior for unassigned user/group | Check home layout in small screens when error shown | Confirm query-param login behaves consistently across browsers | Session format is email-sensitive; test uppercase/lowercase variations |
| Authorization Guarding (all protected pages) | Direct URL access to admin/report/stats/task pages | Open `/dashboard/*`, `/report/*`, `/stats`, `/task` with and without session | Access should be restricted per role/policy (or explicitly accepted if intentionally open) | High | Pass/Fail | Validate API responses for unauthorized direct calls | Protected pages should not expose sensitive controls to unauthorized users | Unauthorized access should produce clear 401/403 style UX | Validate route-level auth expectations for admins vs normal users | Verify unauthorized screens on mobile are readable | Verify unauthorized handling across browsers | Current code indicates missing route protection; treat as release risk if not handled by external gateway |
| Role Sync API (`/api/roles`) | API key enforcement | Call endpoint with valid and invalid `x-api-key` | Valid key returns roles; invalid key returns 401/403 | High | Pass/Fail | Validate schema and required fields in response payload | No UI (API-only) | Ensure invalid key returns non-200 with safe message | Confirm key requirement is strict and not bypassable | N/A | Verify header handling in different clients/browsers (dev tools/API tools) | Confirm no sensitive stack traces leaked in error body |

### 2) Core Task Workflow (Business-Critical)

| Feature / Module Name | Test Scenario | Test Steps | Expected Result | Priority | Status (Pass/Fail) | API Validation | UI Validation Points | Error Handling Validation | Authentication & Authorization Checks | Responsive Behavior Checks | Browser Compatibility Considerations | Notes / Edge Cases |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Task Assignment (`/api/task/list`) | Fetch and assign tasks for transcriber | Load home as transcriber and request next tasks | Task list returns only assignable records; user assignment updates correctly | High | Pass/Fail | Validate request includes `userId/groupId/role`; response data shape and state correctness | Audio/transcript panel updates to first task; loading indicators behave | Empty queue should show graceful "no task" state | Ensure user cannot read tasks from another group/role | Validate task panel and sidebar in mobile drawer layout | Validate list loading and rendering in all major browsers | Verify assignment behavior under high concurrency (multiple users fetching simultaneously) |
| Transcriber submit flow | Submit transcript to reviewer stage | Open task, edit transcript, click Submit | Task state transitions to `submitted`; next task appears | High | Pass/Fail | Verify `POST /api/task/update` with `action=submit` and state transition | Submit button state/shortcut feedback is clear | API failure should keep local input and show toast/error | Ensure user cannot submit tasks they do not own | Validate fixed action buttons on small screens | Validate shortcuts/button clicks in Chrome/Firefox/Safari | Test transcript near DB length limit (`VarChar(500)`) |
| Transcriber save flow | Save in-progress transcript | Edit text and click Save | Transcript persists without final state transition | High | Pass/Fail | Validate `action=save` updates transcript field only | Save notification appears and text persists after refresh | Failed save should not silently lose edits | Confirm save restricted to assigned task and valid role | Check save button accessibility on mobile | Validate keyboard and click interactions across browsers | Test intermittent network drops during save |
| Transcriber trash flow | Move task to trashed | Click Trash for active task | Task state changes to `trashed`; user gets next task | High | Pass/Fail | Validate `action=trash` behavior and response payload | Trash action is clearly visible and irreversible intent is clear | API rejection should show clear reason | Verify user cannot trash tasks outside role ownership | Ensure trash confirmation/toast is visible on small screens | Validate consistent button behavior in Safari/Firefox | Validate historical visibility in sidebar after trash |
| Reviewer accept flow | Approve reviewed transcript | Login as reviewer and submit reviewed task | Task transitions from `submitted` to `accepted` | High | Pass/Fail | Validate reviewer transition in `/api/task/update` | Reviewed transcript field displayed and submitted | Invalid transition returns controlled error | Verify only reviewer role can perform reviewer transitions | Ensure review textarea/buttons usable in mobile view | Validate with key + button actions in major browsers | Cross-check reviewer_id assignment and history update |
| Reviewer reject flow | Reject to transcriber stage | Reviewer rejects task with/without edited transcript | Task transitions back to `transcribing` and notes persist as expected | High | Pass/Fail | Validate reject action payload and resulting state | UI reflects task removed from reviewer queue | Reject API errors are surfaced, no silent failure | Verify reject not allowed for unauthorized role/user | Validate reject button visibility on mobile | Validate consistent behavior across browsers | Confirm no stale queue entry remains for reviewer |
| Final reviewer finalise flow | Final approval | Final reviewer finalises accepted task | Task transitions to `finalised` and exits queue | High | Pass/Fail | Validate final reviewer transition and timestamps | Finalise action updates progress widgets | Invalid action/state should return handled error | Ensure only final reviewer can finalise | Ensure action controls remain usable on small devices | Validate audio + final text interactions on browsers | Validate final transcript persists in report views |
| Revert task state (`/api/task/revert`) | Admin/manual revert from history/report | Trigger revert from report/history control | Task state reverts according to role rules and returns correct active task | High | Pass/Fail | Validate response contains updated task and state | UI updates immediately after revert | If revert invalid, show explicit message | Verify only authorized users/admins can revert | Ensure revert controls in tables are usable on mobile scroll | Validate action in Chrome/Firefox/Safari | Revert logic is risk-prone; validate each role-specific path carefully |
| Sidebar progress/history (`/api/user/progress`, `/api/user/history`) | Progress and history refresh consistency | Complete several actions, observe sidebar updates | Counts and history reflect latest state accurately | Medium | Pass/Fail | Validate API counts match DB state transitions | Sidebar badges and history entries render correctly | API timeout/error should show non-blocking fallback | Verify user sees only own progress/history | Verify drawer behavior and readability in small screens | Validate polling/refresh behavior across browsers | In-memory cache can cause temporary staleness in multi-instance deploys |

### 3) CSV Import and Task Management

| Feature / Module Name | Test Scenario | Test Steps | Expected Result | Priority | Status (Pass/Fail) | API Validation | UI Validation Points | Error Handling Validation | Authentication & Authorization Checks | Responsive Behavior Checks | Browser Compatibility Considerations | Notes / Edge Cases |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Upload CSV Page (`/task`) | Valid CSV upload | Select group and valid CSV, then upload | Tasks created successfully; success count matches CSV records | High | Pass/Fail | Validate `POST /api/upload-csv` multipart payload and response count | File picker, group selector, loader, and success toast work | Invalid CSV should return clear validation error | Ensure only authorized role/users can upload tasks | Verify upload form on narrow screens | Validate file selection/upload in Chrome/Firefox/Safari/Edge | Validate max file handling vs UI message consistency (10MB vs 15MB mismatch risk) |
| Duplicate row handling | Upload CSV containing duplicate file name/url | Import duplicate entries | Duplicates are skipped or rejected per design without partial corruption | High | Pass/Fail | Validate unique constraint behavior and response details | UI should display duplicate warning summary | No unhandled 500 errors for duplicates | Restrict import endpoint to authorized users | Validate duplicate error visibility on mobile | Cross-browser upload + error rendering checks | Validate whether duplicates are skipped silently or reported explicitly |
| Oversized import load | Upload near upper row limits | Import large file (close to expected max) | Import completes within acceptable time, no timeout/crash | Medium | Pass/Fail | Validate batch insertion and API duration/error codes | Loading state remains responsive; no frozen page | Timeout or server errors should show actionable message | Verify endpoint is protected from abuse | Check progress/loader readability on mobile | Validate behavior in Safari (file uploads often differ) | Two import pipelines exist (`/task` and `/dashboard/task`) with different limits/validation |
| Dashboard Task Import (`/dashboard/task`) | Admin-side task upload and list pagination | Upload via dashboard task form; navigate pages | New tasks visible and pagination stable | High | Pass/Fail | Validate server action task creation and `getAllTask` query integrity | Table data, page controls, and sorting/filter defaults render correctly | Import/list failure should show toast and keep page stable | Verify only authorized users can access task dashboard | Ensure table horizontal scroll and controls usable on small screens | Validate pagination controls in major browsers | Verify pagination params (`page`, `per_page`) persist across refresh/navigation |

### 4) User, Group, Department CRUD

| Feature / Module Name | Test Scenario | Test Steps | Expected Result | Priority | Status (Pass/Fail) | API Validation | UI Validation Points | Error Handling Validation | Authentication & Authorization Checks | Responsive Behavior Checks | Browser Compatibility Considerations | Notes / Edge Cases |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Department CRUD (`/dashboard/department`) | Create/edit/delete department | Perform create, edit, delete operations with valid/invalid inputs | Data persists correctly; duplicate/invalid names are blocked | High | Pass/Fail | Validate server action responses for success/error | Modal forms, validation text, and table refresh behave correctly | DB/validation errors surface clearly in UI | Verify only authorized admin roles can mutate departments | Modal/table usability on mobile sizes | Validate modal interaction in all target browsers | Deletion may fail due to FK dependencies; verify user-facing message quality |
| Group CRUD (`/dashboard/group`) | Group create/edit/delete with department mapping | Create group under department, edit name, attempt delete | Group records update correctly with dependency checks | High | Pass/Fail | Validate group payload and duplicate checks per department | Group dashboard list and modal controls render correctly | Dependency-related delete failures should be explicit | Ensure mutation endpoints/actions are authorization-protected | Verify table overflow + modal forms on mobile | Verify browser handling of table + form controls | Validate group-to-department linkage integrity after edits |
| User CRUD (`/dashboard/user`, `/api/user`) | User create/edit/delete and role assignment | Add user, edit role/group, attempt delete user with tasks | Valid CRUD works; deletes blocked when linked tasks exist | High | Pass/Fail | Validate `/api/user` GET/PUT and server-action create/delete behavior | Dashboard table rows and edit modal update correctly | Delete blocked errors should be explicit and non-crashing | Validate role-based permissions for user management | Check user table and actions on small viewports | Validate across major browsers | `/api/user` GET exposure should be assessed as potential data leak risk |

### 5) Reports, Stats, and Analytics

| Feature / Module Name | Test Scenario | Test Steps | Expected Result | Priority | Status (Pass/Fail) | API Validation | UI Validation Points | Error Handling Validation | Authentication & Authorization Checks | Responsive Behavior Checks | Browser Compatibility Considerations | Notes / Edge Cases |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Report Hub (`/report`) | Navigation to report modules | Open report hub and navigate to group/department report | Links route correctly and pages load with valid data | Medium | Pass/Fail | Validate dependent report API/server-action data loads | Buttons and route transitions are clean and quick | Failed data load shows fallback message | Verify report pages require correct permission level | Verify report cards/buttons on mobile | Validate routing behavior in Safari/Firefox/Chrome | Confirm unauthorized users cannot deep-link to report pages |
| Group Report (`/report/group`) | Group/date filtered productivity data | Select group + date range and compare table outputs | Metrics and user rows align with expected DB totals | High | Pass/Fail | Validate data filters and aggregation logic by date/group | Tables for transcriber/reviewer/final reviewer render correctly | Empty datasets should show clear empty state | Verify only authorized viewers can access | Ensure table readability and horizontal scroll on mobile | Validate data table rendering across browsers | Validate date boundary behavior (timezone/day cutoffs) |
| Department Report (`/report/department`) | Department-wide aggregated report | Select department and validate aggregate metrics | Correct totals across child groups/users | High | Pass/Fail | Validate aggregation response against known DB sample | Department selector and totals section update consistently | Errors in aggregation should not crash whole page | Verify department report authorization | Check aggregated table layout on mobile | Validate table performance in browsers with larger datasets | Validate behavior when department has no groups/tasks |
| User Report (`/report/user/[id]`) | User-specific task audit and pagination | Open user report, paginate, check row-level details | Task list and metadata persist accurately across pages | High | Pass/Fail | Validate user task query, paging params, and count | Pagination controls and task table data consistent | Invalid user/page should show controlled error | Verify only authorized users can access other users' reports | Ensure table + pagination usable on mobile | Validate pagination state across browser refresh/back | Password gate is client-side (`NEXT_PUBLIC_PASSWORD`); treat as weak control |
| Stats Dashboard (`/stats`) | Real-time-ish operational stats load | Open stats and compare with known recent updates | Cards/charts load and represent latest acceptable data window | Medium | Pass/Fail | Validate stats queries and dataset shape | Chart legends/labels/colors render correctly | Chart/data load failures should show fallback state | Confirm stats page access control expectations | Confirm charts remain readable on small screens | Validate chart rendering in Safari/Firefox/Chrome | `revalidate=300` and in-memory cache can cause temporary stale numbers |

### 6) API-Only Sanity (Backend Contract Focus)

| Feature / Module Name | Test Scenario | Test Steps | Expected Result | Priority | Status (Pass/Fail) | API Validation | UI Validation Points | Error Handling Validation | Authentication & Authorization Checks | Responsive Behavior Checks | Browser Compatibility Considerations | Notes / Edge Cases |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Task Update API (`/api/task/update`) | Payload schema validation | Send missing/invalid fields and invalid `action` values | Returns proper non-200 error and message | High | Pass/Fail | Validate required keys (`id`, `role`, `action`, etc.) and status codes | N/A | Must not throw unhandled exceptions | Validate caller identity vs provided `userId/role` assumptions | N/A | Validate from multiple clients (browser/API clients) | Test malformed JSON and large transcript payload |
| Task List API (`/api/task/list`) | Unauthorized task access attempt | Request tasks with another user/group combination | Access should be rejected or safely scoped | High | Pass/Fail | Validate no cross-user data leakage | N/A | On denied access, return explicit 401/403 semantics | Ensure endpoint is not vulnerable to IDOR patterns | N/A | Verify consistent response semantics across clients | Current implementation appears trust-based; flag as high risk |
| User API (`/api/user`) | Sensitive user data exposure | Call GET as unauthenticated client | Endpoint should enforce proper access control | High | Pass/Fail | Validate response fields and auth requirement | N/A | Unauthorized requests should return proper errors | Confirm PII exposure controls for names/emails/roles | N/A | Verify response consistency across environments | If endpoint remains open, include explicit operational acceptance signoff |
| Mapping API (`/api/mapping/[email]`) | Mapping lookup and URL safety | Request known/unknown email mappings | Known mapping resolves expected tool URLs; unknown returns safe response | Medium | Pass/Fail | Validate status codes and response body shape | N/A | Unknown or malformed emails handled safely | Confirm endpoint does not expose excessive user/session details | N/A | Verify behavior in API clients/browsers | Validate session param consistency (`name` vs `email`) in generated URLs |

### 7) UI/UX, Forms, and Frontend Stability

| Feature / Module Name | Test Scenario | Test Steps | Expected Result | Priority | Status (Pass/Fail) | API Validation | UI Validation Points | Error Handling Validation | Authentication & Authorization Checks | Responsive Behavior Checks | Browser Compatibility Considerations | Notes / Edge Cases |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Home Transcript UI (`/`) | End-to-end task editing UX | Load task, play audio, edit transcript, execute actions | Smooth, non-blocking user flow with clear feedback | High | Pass/Fail | Verify API sequence list -> update -> progress/history refresh | Audio player, transcript box, hotkeys, toasts behave consistently | Network errors should not clear user draft unexpectedly | Confirm user context is consistent through session | Validate sidebar drawer + action bar at mobile widths | Validate keyboard and audio interactions across major browsers | Audio source/CORS issues should show clear user feedback |
| Form Validation (modals and selectors) | Required field and invalid value checks | Submit empty/invalid forms for user/group/department/task upload | Client/server both prevent invalid submission | High | Pass/Fail | Validate 4xx response consistency for validation failures | Inline field errors and disabled submit states are intuitive | No broken modal state after validation failure | Ensure only authorized users can reach submit paths | Confirm modal forms work in mobile/touch contexts | Verify form controls across browsers | Include special characters, whitespace-only values, long strings |
| Global Error Boundary (`src/app/error.js`) | Runtime error fallback | Trigger controlled runtime exception in page/component | Error UI appears and app remains recoverable | Medium | Pass/Fail | Validate API errors don’t cascade into fatal render where avoidable | Error message readability and retry path clarity | Ensure no raw stack traces or secrets exposed | Ensure error pages do not leak privileged data | Validate error UI layout on mobile | Verify fallback rendering in browsers | Ensure user can navigate back safely after failure |

### 8) Database and Data Integrity

| Feature / Module Name | Test Scenario | Test Steps | Expected Result | Priority | Status (Pass/Fail) | API Validation | UI Validation Points | Error Handling Validation | Authentication & Authorization Checks | Responsive Behavior Checks | Browser Compatibility Considerations | Notes / Edge Cases |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Schema constraints | Unique and FK integrity under CRUD/import | Attempt duplicate user/task inserts and invalid FK associations | DB constraints prevent invalid records; app returns clear messages | High | Pass/Fail | Validate 409/400-like behavior for conflicts | UI should map DB conflicts to actionable toasts/messages | Constraint errors must be handled and not crash pages | Validate privileged operations only | N/A | N/A | Check `Task.file_name` and `Task.url` unique conflict handling in both import paths |
| State transition integrity | Illegal transitions are blocked | Attempt state changes not allowed by role/state rules | Invalid transitions rejected; valid transitions persist | High | Pass/Fail | Validate transition matrix against `TASK_RULES` | UI should not offer illegal actions, or if offered must fail safely | Illegal update calls should return controlled errors | Ensure role cannot perform another role’s transition | N/A | N/A | Test all role-state transitions including reject/trash/revert edge paths |
| Text field limits | Transcript fields max length and encoding | Submit transcripts >500 chars and special characters | Inputs beyond limits are handled predictably (reject/truncate with notice) | Medium | Pass/Fail | Validate API behavior and DB error mapping | UI should display length guidance or clear failure reason | No generic 500 on overflow | Ensure malicious payloads are sanitized/escaped | N/A | Validate unicode/special char behavior in major browsers | Current DB limit is 500 chars across transcript columns |

### 9) Integrations and External Dependencies

| Feature / Module Name | Test Scenario | Test Steps | Expected Result | Priority | Status (Pass/Fail) | API Validation | UI Validation Points | Error Handling Validation | Authentication & Authorization Checks | Responsive Behavior Checks | Browser Compatibility Considerations | Notes / Edge Cases |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Google Sheets Sidebar iframe | Embedded sheet render | Load home and verify right sidebar sheet | Sheet displays or fails gracefully without breaking core workflow | Low | Pass/Fail | N/A | Iframe area should not overlap core controls | Embed failures should not block task operations | Confirm no sensitive tokens exposed in URL | Verify sidebar usability on small screens | Validate iframe behavior in Safari/Firefox/Chrome | Cross-site embed policies can break by environment |
| Audio URL Integration | External audio playback | Open tasks with valid/invalid audio URLs | Valid audio plays; invalid URL shows clear failure behavior | High | Pass/Fail | Validate task payload includes correct URL format | Audio controls (playback speed/loop) function correctly | Playback errors should be visible and non-fatal | Ensure only authorized task data is loaded | Confirm audio controls accessible on small screens | Validate media playback engine differences across browsers | Test slow network and partially loaded media files |
| Discord Webhook Utility | Alerting behavior on threshold | Trigger expected webhook event path (if enabled) | Alert sent with correct payload or clearly documented disabled state | Low | Pass/Fail | Validate webhook request payload and response logging | N/A | Failure to send should log safely and not break user flow | Keep webhook secret inaccessible to client | N/A | N/A | Current webhook trigger appears commented/disabled; verify intended behavior before release |

---

## Critical Breakpoints Likely to Fail After Deployment

| Risk Area | Why It Is Fragile | Sanity Verification Required |
|---|---|---|
| Route/API authorization gaps | Admin/report/task APIs and pages appear broadly accessible | Run unauthorized access matrix for all admin/report/task endpoints before signoff |
| Task ownership validation | Task APIs rely on client-provided role/user context | Attempt cross-user/cross-role actions via API clients |
| Dual CSV import implementations | Two paths use different validations and limits | Execute import sanity on both `/task` and `/dashboard/task` |
| Transcript length limits | DB transcript fields capped at 500 chars | Test boundary lengths and long-text rejection handling |
| Revert logic complexity | Role-based revert transitions can misroute state | Validate revert for each role and each prior state |
| Cache staleness in production | Stats/progress use ISR + in-memory cache windows | Compare UI stats with DB truth after rapid updates |
| Node/runtime mismatch | `package.json` targets Node 20.x, deployment config may differ | Validate build/start behavior in actual deployment runtime |

---

## Missing Validations / Risky Areas Discovered

- Missing or weak route-level authorization controls on critical dashboards/reports/APIs.
- Potential IDOR risk in task APIs due to trust in client-provided identity fields.
- Client-side password gate (`NEXT_PUBLIC_PASSWORD`) should not be treated as secure authorization.
- Inconsistent session identifier usage (`email` vs `name`) in integration mapping path.
- No automated test suite (unit/integration/e2e) exists; regression protection depends heavily on manual QA.
- Error handling is inconsistent across APIs; some catch blocks may not return structured responses.
- Large CSV imports and duplicate scenarios need explicit production guardrails and observability.

---

## Deployment Verification Steps (Post-Deploy Smoke)

| Step | Verification Action | Expected Result | Priority | Status (Pass/Fail) | Notes |
|---|---|---|---|---|---|
| 1. Service health | Open root page and key routes (`/`, `/dashboard`, `/report`, `/stats`, `/task`) | Pages load without fatal runtime/build errors | High | Pass/Fail | Check server logs for startup exceptions |
| 2. Database migration status | Confirm migrations applied and Prisma client in sync | No migration failures; schema matches runtime code | High | Pass/Fail | Validate new columns/indexes are active |
| 3. Env configuration | Validate required env vars (`DATABASE_URL`, SSO vars, API keys) | Auth and API flows work as expected | High | Pass/Fail | Include secret rotation checks |
| 4. SSO login smoke | Execute valid and invalid SSO token tests | Valid token logs in; invalid token rejected safely | High | Pass/Fail | Confirm redirect and role/group assignment |
| 5. Core workflow smoke | Perform one full task lifecycle across roles | `transcribing -> submitted -> accepted -> finalised` succeeds | High | Pass/Fail | Include reject/trash alternate path |
| 6. CSV import smoke | Run sample import on both upload paths | Records imported correctly with duplicate handling | High | Pass/Fail | Check performance and error messages |
| 7. Report/stat checks | Validate report pages and stats values against sample DB truth | Metrics and pagination are consistent and non-empty | Medium | Pass/Fail | Allow expected cache delay window |
| 8. API security checks | Run unauthorized endpoint checks | Restricted endpoints deny unauthorized calls | High | Pass/Fail | Must pass for production signoff |
| 9. Browser sanity | Execute quick smoke in Chrome, Firefox, Safari, Edge | No blocking UI or workflow regressions | Medium | Pass/Fail | Cover login + one task action + one report |
| 10. Mobile/responsive sanity | Test critical pages at mobile/tablet breakpoints | Controls remain usable and readable | Medium | Pass/Fail | Focus on sidebar, action buttons, and tables |

---

## Pre-Release QA Signoff Checklist

| Signoff Item | Owner | Status (Pass/Fail) | Notes |
|---|---|---|---|
| Auth and authorization sanity complete for all critical pages/APIs | QA + Backend | Pass/Fail | Include evidence of unauthorized access checks |
| Core role workflows validated end-to-end | QA | Pass/Fail | Cover submit/reject/trash/finalise paths |
| CRUD modules validated with positive/negative cases | QA | Pass/Fail | User/group/department/task import |
| API contract sanity complete (200/4xx/5xx behavior) | QA + Backend | Pass/Fail | Include malformed payload and invalid auth checks |
| Database integrity checks completed | Backend + QA | Pass/Fail | Constraints, transitions, duplicate handling |
| Reports and stats validated against trusted sample data | QA + Product | Pass/Fail | Confirm date-range and pagination behavior |
| Responsive and browser smoke completed | QA | Pass/Fail | Chrome/Firefox/Safari/Edge + mobile widths |
| Deployment smoke and runtime log checks completed | DevOps + QA | Pass/Fail | Build/migrate/env/startup verification |
| Known risks documented and accepted by stakeholders | Product + Engineering | Pass/Fail | Explicitly track unresolved high risks |
| Final release approval provided | Engineering Lead / PM | Pass/Fail | Release ticket reference |

---

## Recommended Reuse Process for Future Releases

1. Copy this checklist into release-specific execution sheet.
2. Mark feature ownership and assign pass/fail owner for each section.
3. Run high-priority rows first (auth, task workflow, CSV import, API auth).
4. Attach logs/screenshots for failed or risky checks.
5. Track recurring failures as automation candidates (API tests/e2e smoke tests).

