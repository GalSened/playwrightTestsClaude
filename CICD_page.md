

**You are Claude Code acting as a senior Staff+ engineer and product+DevOps architect.**

Your job is to implement a full **CI/CD Application** page and backend orchestration for **QA Intelligence** that lets me press one button, e.g., “Deploy WeSign to DevTest,” and it will:  **Preflight → Build → Package → Config Transform → Cross-server Deploy to DevTest (IIS) → Smoke Checks → API tests (Newman) → E2E tests (Playwright+pytest) → Rollback on failure → Aggregate reports → Notify** .

## Non-negotiable principles

* **Assume nothing** . Everything must be validated by **preflight** before proceeding.
* **Full files only** — deliver complete, runnable files, not diffs.
* **Windows-friendly** and  **Docker-friendly** . CI server is Windows Jenkins; target is Windows DevTest with IIS.
* **No Jenkins Agent on DevTest.** Cross-server operations use **SMB (robocopy)** and **WinRM** (prefer HTTPS 5986). Avoid double-hop issues; favor `Copy-Item -ToSession` when appropriate.
* Use **`py`** (not `python`) in docs/examples/steps, per my preference.
* **Security** : never print secrets; use Jenkins Credentials + backend env secrets; redact logs.

---

## Fill these variables at the top of every generated config/script (as constants or `.env`)

<pre class="overflow-visible!" data-start="1674" data-end="2525"><div class="contain-inline-size rounded-2xl relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre!"><span><span>APP_NAME</span><span> = </span><span>"WeSign"</span><span>
</span><span>ENV_NAME</span><span> = </span><span>"DevTest"</span><span>
</span><span>GIT_REPO_URL</span><span> = </span><span>"https://gitlab.comda.co.il/comsigntrust/comsigntrustcms.git"</span><span>
</span><span>JENKINS_URL</span><span> = </span><span>"http://<jenkins-host>/"</span><span>
</span><span>JENKINS_JOB_NAME</span><span> = </span><span>"WeSign-CI"</span><span>
</span><span>JENKINS_CREDENTIALS_ID</span><span> = </span><span>"svc-devtest"</span><span></span><span># domain user for SMB/WinRM</span><span>
</span><span>DEVTEST_SERVER</span><span> = </span><span>"DevTest"</span><span>
</span><span>IIS_APP_POOLS</span><span> = [</span><span>"UserApi"</span><span>,</span><span>"SignerApi"</span><span>,</span><span>"ManagementApi"</span><span>,</span><span>"DefaultAppPool"</span><span>,</span><span>"PdfConvertorService"</span><span>]
</span><span>DEPLOY_DIR</span><span> = </span><span>"C:\\inetpub\\WeSign"</span><span>
</span><span>DEPLOY_STAGING</span><span> = </span><span>"C:\\deploy"</span><span>
</span><span>BACKUP_ROOT</span><span> = </span><span>"C:\\backup\\WeSign"</span><span>
</span><span>ARTIFACT_NAME</span><span> = </span><span>"WeSign.DevTest.zip"</span><span>

</span><span>POSTMAN_COLLECTION</span><span> = </span><span>"postman/collection.json"</span><span>
</span><span>POSTMAN_ENV</span><span> = </span><span>"postman/devtest_env.json"</span><span>
</span><span>PYTEST_E2E_DIR</span><span> = </span><span>"tests/e2e"</span><span></span><span># Playwright + pytest tests</span><span>
</span><span>SMOKE_URLS</span><span> = [</span><span>"http://DevTest/health"</span><span>, </span><span>"http://DevTest/WeSignManagement/health"</span><span>]
</span><span>ARTIFACT_STORE</span><span> = </span><span>"reports"</span><span></span><span># where to save HTML reports/artifacts</span><span>
</span></span></code></div></div></pre>

---

## Deliverables (generate all of these as full files)

1. **Backend orchestration service** (Python  **FastAPI** ) under `backend/ci/`:
   * `api/routes/ci.py` — REST + WS endpoints:
     * `POST /ci/runs` (start run with params: branch/tag, dry_run, test_suite [api|e2e|full|none], provider=jenkins)
     * `GET /ci/runs/{id}` (status, stages, metrics, artifacts)
     * `WS /ci/runs/{id}/logs` (live logs streaming)
   * `ci/orchestrator.py` — enqueues and executes the pipeline stages via a task queue (RQ/Arq/Celery).
   * `ci/providers/jenkins_client.py` — trigger Jenkins job with parameters, poll console output, fetch artifacts links.
   * `ci/models.py` — Pydantic models for Run/Stage/Artifact; SQLite schema migrations if needed.
   * `ci/report_aggregator.py` — merges results into a single JSON summary + produces a human-friendly summary.
   * `ci/notify.py` — Teams/email notifier (stub with clear interface; wire later).
   * `.env.example` — all env vars required; never hardcode secrets.
2. **Jenkins pipeline** `Jenkinsfile` (Windows) with stages:
   * `Parameters`: `BRANCH_OR_TAG`, `DRY_RUN`, `TEST_SUITE`(`api|e2e|full|none`)
   * `Checkout` (from `GIT_REPO_URL`)
   * `Pre-flight` (network reachability to `DevTest`, disk space, IIS reach)
   * `Build & Unit Tests` (`dotnet restore/build/test`, archive TRX)
   * `Package` (ZIP artifacts)
   * `Config Transform` (`py scripts/appsettings_patch.py --env DevTest --input artifact\WeSign.zip --output artifact\WeSign.DevTest.zip`)
   * `Transfer Artifact` to `\\DevTest\c$\deploy` using **Jenkins Credentials** (or `Copy-Item -ToSession` if WinRM only)
   * `Stop IIS Pools` (WinRM)
   * `Backup & Deploy` (WinRM)
   * `Start IIS + Smoke` (WinRM)
   * `Tests: API/E2E` (Newman + pytest-Playwright; produce HTML reports)
   * `Post`: archive artifacts, summarize, mark build result
3. **PowerShell scripts** under `scripts/ps/` (used by Jenkins stages):
   * `stop_pools.ps1`, `start_pools.ps1`
   * `deploy_zip.ps1` (backup to `BACKUP_ROOT` with timestamp; expand archive to `DEPLOY_DIR`)
   * `smoke.ps1` (loop over `SMOKE_URLS`, fail fast on non-200)
   * `winrm_session.ps1` (helper to create secure PSSession with credentials + UseSSL)
4. **Python utilities** under `scripts/`:
   * `appsettings_patch.py` — robust JSON transformer for environment-specific settings (idempotent).
   * `smoke_check.py` — optional Python smoke (curl/requests fallback), logs to `logs/smoke_*.log`.
5. **Frontend CI/CD page** under `frontend/`:
   * `components/ci/DeployWeSignPanel.tsx` — Form (Branch/Tag, Dry-run, Test Suite), Run button.
   * `components/ci/RunLogStream.tsx` — WebSocket live console with stage badges, collapsible sections.
   * `pages/ci/index.tsx` (or route module) — History table (runs, status, duration, links to artifacts and reports), **Rollback** button.
   * **Design** : sleek, modern, dark-mode compatible; keyboard accessible; responsive; clear error banners.
6. **Documentation** :

* `docs/CI_App_README.md` — setup, env vars, security checklist, network ports (445 SMB, 5986 WinRM), assumptions.
* `docs/Runbook.md` — run/rollback procedures, how to rotate credentials, how to add new environments.

---

## Orchestration flow (must implement exactly)

1. **Create run** → validate inputs → persist `Run` row (status=pending).
2. **Preflight** (stop if any check fails):
   * Can Jenkins reach `DevTest` (ICMP/TCP 445/5986)?
   * Do credentials work? (open WinRM PSSession)
   * Check free disk on `DevTest`; check IIS module available.
3. **Build** on Jenkins:
   * `dotnet restore/build/test` with TRX archived.
4. **Package** :

* Produce `artifact\WeSign.zip` → sign/checksum → output `ARTIFACT_NAME`.

1. **Config Transform** :

* Apply `appsettings.*.json` overrides for `ENV_NAME`; **never** inline secrets in code; read from secure source.

1. **Transfer** to `DevTest`:
   * Preferred: `Copy-Item -ToSession $s` to `DEPLOY_STAGING\\ARTIFACT_NAME`.
   * Alternative: `net use \\\\DevTest\\c$` + `robocopy` with Jenkins credentials.
2. **Deploy** (WinRM):
   * Stop IIS app pools listed in `IIS_APP_POOLS`.
   * Make timestamped backup to `BACKUP_ROOT\YYYYMMDD_HHMMSS`.
   * Expand archive to `DEPLOY_DIR` (idempotent).
   * (Optional) Run EF migrations with a DB service account.
   * Start app pools.
3. **Smoke** :

* GET each `SMOKE_URLS` (<=3 retries, backoff).
* On failure →  **auto-rollback** : restore last backup, start pools, re-smoke, mark run “rolled back”.

1. **Tests** (if `TEST_SUITE != none`):
   * API: `newman run ${POSTMAN_COLLECTION} -e ${POSTMAN_ENV} -r cli,htmlextra --reporter-htmlextra-export ${ARTIFACT_STORE}/newman.html`
   * E2E: `py -m pytest ${PYTEST_E2E_DIR} --maxfail=1 --disable-warnings -q --html=${ARTIFACT_STORE}/playwright.html --self-contained-html`
2. **Aggregate reports** :

* Collect: TRX, newman.html, playwright.html, smoke logs, deploy log.
* Emit `summary.json` with pass/fail counts, durations, and a **single “Run Score”** (weighted: 20% build, 20% smoke, 30% API, 30% E2E).

11. **Notify** :

* Print concise summary to console.
* Provide webhook stub (Teams/email) with links.

12. **Persist + expose** :

* Update DB with final status, metrics, artifact URLs.
* Frontend shows run details, links, and a **Rollback** button for N-1.

---

## API Contract (FastAPI)

* `POST /ci/runs`

<pre class="overflow-visible!" data-start="7883" data-end="8068"><div class="contain-inline-size rounded-2xl relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-json"><span><span>{</span><span>
  </span><span>"app"</span><span>:</span><span></span><span>"WeSign"</span><span>,</span><span>
  </span><span>"env"</span><span>:</span><span></span><span>"DevTest"</span><span>,</span><span>
  </span><span>"branch_or_tag"</span><span>:</span><span></span><span>"main"</span><span>,</span><span>
  </span><span>"dry_run"</span><span>:</span><span></span><span>false</span><span></span><span>,</span><span>
  </span><span>"test_suite"</span><span>:</span><span></span><span>"full"</span><span>,</span><span></span><span>// "api" | "e2e" | "full" | "none"</span><span>
  </span><span>"provider"</span><span>:</span><span></span><span>"jenkins"</span><span>
</span><span>}</span><span>
</span></span></code></div></div></pre>

→ `{"run_id":"<uuid>","status":"queued"}`

* `GET /ci/runs/{id}` → status, stages[], artifacts[], metrics
* `WS /ci/runs/{id}/logs` → newline text stream with stage markers:

<pre class="overflow-visible!" data-start="8244" data-end="8316"><div class="contain-inline-size rounded-2xl relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre!"><span><span>[</span><span>preflight</span><span>] ...
[</span><span>build</span><span>] ...
[</span><span>deploy</span><span>] ...
[</span><span>smoke</span><span>] ...
[</span><span>tests</span><span>] ...
</span></span></code></div></div></pre>

---

## Frontend UX requirements

* **Form** : Branch/Tag (default “main”), Dry-run toggle, Test Suite.
* **Run** button → opens **Live Logs** panel (WS).
* **Progress** : stage chips (pending/running/success/failure).
* **History** table with filters, duration, initiator, score.
* **Artifacts** : buttons to open newman/playwright/TRX/summary.
* **Rollback N-1** button (protected by role and confirmation).
* **Dark mode** by default; accessible (ARIA, focus states).

---

## Security & Compliance

* Jenkins Credentials for SMB/WinRM (`JENKINS_CREDENTIALS_ID`), never echo values.
* WinRM over **HTTPS** (5986) with org certificate where possible; allow HTTP only in lab.
* SMB (445) allowed only from Jenkins server to DevTest.
* Redact secrets from logs; validate permissions least-privilege.
* Checksums for artifacts; record in `summary.json`.

---

## Quality Gates (must fail the run if violated)

* Preflight failed, or **any** smoke URL non-200 after retries.
* API/E2E HTML reports missing or corrupted.
* Run Score < configurable threshold (e.g., 80).
* Missing backup before deploy.
* Any unredacted secret in logs.

---

## Acceptance tests (automate where possible)

* **Dry-run** path runs through Build/Package/Config without touching DevTest.
* Full run deploys, smoke passes, API/E2E execute, artifacts present, score computed.
* Induced smoke failure triggers **automatic rollback** and succeeds re-smoke.
* History shows runs with correct durations, links, and rollback markers.
* WS live logs stream in near-real-time.

---

## Implementation steps (Claude Code, do this now)

1. **Print a plan** (brief) then proceed to output  **full files** .
2. Generate backend: `backend/ci/...` (FastAPI, orchestrator, Jenkins client, models, aggregator, notify).
3. Generate Jenkinsfile (complete, Windows-friendly; references the PS scripts and Python utilities).
4. Generate PowerShell scripts under `scripts/ps/` and Python utilities under `scripts/`.
5. Generate frontend components/pages under `frontend/` as described (TypeScript/React; if project uses different stack, generate a minimal standalone CRA/Next page plus integration notes).
6. Provide `.env.example`, `requirements.txt` (backend), and `package.json` updates if needed.
7. Provide `docs/CI_App_README.md` and `docs/Runbook.md`.
8. Ensure all commands use **`py`** prefix and paths/quotes are Windows-safe.
9. At the end, print a **“Quick Start”** with exact commands to run backend, open the page, configure Jenkins credentials, and execute a first **Dry-run** followed by a **Full** run.

 **Remember** : deliver complete, runnable files; keep security hygiene; do not rely on a Jenkins Agent on DevTest; prefer WinRM+`Copy-Item -ToSession`; implement auto-rollback; aggregate reports; and present a beautiful, accessible CI page.
