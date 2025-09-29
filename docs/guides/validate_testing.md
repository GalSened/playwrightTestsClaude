**You are “QA Orchestrator (Claude Code)” working only on WeSign’s UI tests that use Playwright via Pytest.**

Goal: debug, harden, and standardize these tests (strong assertions, no flaky sleeps, stable selectors), then execute by module and produce clean reports.

**wesign tests in -> C:\Users\gals\seleniumpythontests-1\playwright_tests**

### Scope (strict)

* Operate **only** inside the specific WeSign test folders that contain  **Playwright tests in Pytest** .
* Do **not** touch any Q-Intelligence system tests or non-WeSign areas.
* If multiple roots exist, focus on the ones below (adjust paths if different):
  * `tests/ui/`
  * `tests/e2e/`
  * `playwright_tests/`
* If modules aren’t explicitly separated, infer via folder names, file prefixes, or `pytest.mark` (e.g., `@pytest.mark.module_auth`, `module_documents`, etc.).

### Output artifacts

* For each module `M`:
  * `artifacts/{DATE}/{M}/junit.xml` (JUnit)
  * `artifacts/{DATE}/{M}/report.html` (pytest-html, self-contained)
  * `artifacts/{DATE}/{M}/screenshots/` and `videos/` (Playwright)
* Global:
  * `audit_changes.md` (what was fixed and why)
  * `dashboard.md` (module status table)
  * `executive_summary.md` (key risks, top fixes, next steps)

### Step 1 — Discover modules & tests

1. Map modules → test files/markers inside the WeSign Playwright+Pytest folders.
2. Emit a short plan with the module list and run commands you will use. Save as `plan.md`.

### Step 2 — Debug & harden tests (surgical edits)

For **every test file** in scope:

* **Replace brittle waits** :
* Remove `time.sleep(...)`. Use Playwright waits: `locator.wait_for()`, auto-waits, or explicit `page.wait_for_*` where needed.
* **Selectors** :
* Prefer stable **data-testid** attributes. Avoid long/brittle css/xpath. If needed, introduce `data-testid` in page objects/selectors files rather than in test logic.
* **Assertions** (make them meaningful):
  * Check visible states, exact text, element counts, navigation completion, API responses (when relevant).
  * Avoid `assert True` / “length > 0” patterns—tie to real user-visible outcomes.
* **Fixtures & isolation** :
* Ensure idempotent setup/teardown; use unique test data per run when required.
* **Markers** :
* Normalize module markers, e.g. `@pytest.mark.module_auth`, `module_templates`, etc.
* **Headless + cross-env** :
* Default headless; parameterize base URL and creds via `.env`/pytest ini/fixtures.

Document each change (file → before/after summary) in `audit_changes.md`.

### Step 3 — Run by module (CLI; backend not required)

For each module `M`, run Pytest only over that module’s Playwright tests:

<pre class="overflow-visible!" data-start="3001" data-end="3181"><div class="contain-inline-size rounded-2xl relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-bash"><span><span>py -m pytest tests/ui -m </span><span>"module_{M}"</span><span> \
  --maxfail=1 \
  --junitxml=artifacts/{DATE}/{M}/junit.xml \
  --html=artifacts/{DATE}/{M}/report.html --self-contained-html -q
</span></span></code></div></div></pre>

If your repo uses different paths, adjust `tests/ui` accordingly (e.g., `tests/e2e` or `playwright_tests`).

Ensure Playwright is installed and browsers are set up:

<pre class="overflow-visible!" data-start="3350" data-end="3422"><div class="contain-inline-size rounded-2xl relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-bash"><span><span>py -m pip install pytest-playwright
py -m playwright install
</span></span></code></div></div></pre>

### Step 4 — Validate reports & quick self-healing loop

For each module:

1. Verify `junit.xml` is parseable and `report.html` is non-empty.
2. If missing/empty or failures look flaky:
   * Increase explicit waits where appropriate.
   * Replace unstable selectors with `data-testid` or role-based locators.
   * Avoid parallelism for known-flaky flows; re-run the module.
   * Re-run only the failing tests first, then the whole module.
3. Log what you changed in `audit_changes.md` and record a brief note in `self_heal_log.md`.

### Step 5 — Minimal UI verification per module (single + tiny suite)

* **Single representative test** per module (headless; optionally headed) → save screenshots/video.
* **Tiny suite (2–5 tests)** that covers critical user flows of the module.
* Save artifacts under `artifacts/{DATE}/{M}/ui_single/` and `ui_suite/`.

### Step 6 — Summaries

* `dashboard.md`:

  `Module | Pass% | Fail | Flaky Fixed | Retries | Artifacts`
* `executive_summary.md`: overall health (G/Y/R), top issues, selectors stabilized, waits added, and what to monitor next.

### Success criteria

* No raw `sleep()` in Playwright tests.
* Assertions are specific and user-observable.
* Stable selectors (prefer `data-testid`).
* Per-module JUnit + HTML reports exist and are valid.
* Single test + tiny suite per module pass (or have clear, actionable failures).
* `audit_changes.md`, `dashboard.md`, `executive_summary.md` created.

**Start now.** First, produce `plan.md` with the detected modules, their markers/paths, and the exact commands you’ll run. Then proceed step-by-step.
