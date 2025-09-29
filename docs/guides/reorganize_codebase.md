# QA Intelligence Codebase Reorganization Plan

## Current Problems
1. **Root directory cluttered** with 200+ files including debug scripts, screenshots, reports
2. **Multiple scattered app directories**: `playwright-smart`, `backend`, `frontend`, `e2e`
3. **Inconsistent naming**: `qa-intelligence-tests`, `QoDo_tests`, `playwright-system-tests`
4. **Mixed content**: Source code mixed with test artifacts, debug files, and temporary data

## Proposed Clean Structure

```
qaip-workspace/                     # Renamed from playwrightTestsClaude
├── apps/                           # Main applications
│   ├── dashboard/                  # Frontend (formerly playwright-smart)
│   │   ├── src/
│   │   ├── public/
│   │   ├── package.json
│   │   └── README.md
│   └── api/                        # Backend API
│       ├── src/
│       ├── docker/
│       ├── package.json
│       └── README.md
├── tests/                          # All test suites
│   ├── e2e/                        # End-to-end tests
│   │   ├── wesign/                 # WeSign test suites
│   │   ├── auth/                   # Authentication tests
│   │   ├── dashboard/              # Dashboard tests
│   │   └── reports/                # Reports tests
│   ├── integration/                # Integration tests
│   └── unit/                       # Unit tests
├── tools/                          # Development tools
│   ├── scripts/                    # Utility scripts
│   ├── deployment/                 # Deployment configs
│   ├── docker/                     # Docker configurations
│   └── monitoring/                 # Monitoring setup
├── docs/                           # Documentation
│   ├── api/                        # API documentation
│   ├── guides/                     # User guides
│   ├── architecture/               # Architecture docs
│   └── reports/                    # Test reports
├── config/                         # Shared configurations
│   ├── test-data/                  # Test data files
│   ├── environments/               # Environment configs
│   └── shared/                     # Shared configs
├── archive/                        # Archived files (already created)
│   ├── debug-scripts/
│   ├── old-reports/
│   ├── screenshots/
│   └── migration-backups/
├── .github/                        # GitHub workflows
├── package.json                    # Root package.json for workspace
├── README.md                       # Main project README
├── CLAUDE.md                       # Claude configuration
└── docker-compose.yml             # Docker compose for full stack
```

## Migration Steps

### Phase 1: Create New Structure ✅
- [x] Create `archive/` directories
- [x] Create new directory structure

### Phase 2: Move Core Applications
- [ ] Move `playwright-smart/` → `apps/dashboard/`
- [ ] Move `backend/` → `apps/api/`
- [ ] Update all import paths and references
- [ ] Update package.json scripts

### Phase 3: Consolidate Tests
- [ ] Move `tests/` → `tests/e2e/playwright/`
- [ ] Move `qa-intelligence-tests/` → `tests/integration/`
- [ ] Move `QoDo_tests/` → `tests/unit/`
- [ ] Remove duplicate test directories

### Phase 4: Organize Tools
- [ ] Move deployment scripts → `tools/deployment/`
- [ ] Move `docker-compose.*` → `tools/docker/`
- [ ] Move utility scripts → `tools/scripts/`
- [ ] Move monitoring configs → `tools/monitoring/`

### Phase 5: Documentation
- [ ] Move relevant `.md` files → `docs/guides/`
- [ ] Create proper README files for each app
- [ ] Update all documentation links

### Phase 6: Clean Root Directory
- [ ] Move remaining config files to `config/`
- [ ] Update workspace package.json
- [ ] Remove duplicate/obsolete files

## Benefits of New Structure

1. **Clear Separation**: Apps, tests, tools, and docs clearly separated
2. **Scalable**: Easy to add new apps or test suites
3. **Standard**: Follows modern monorepo conventions
4. **Clean Root**: Root directory only contains essential files
5. **Discoverable**: Easy for new developers to understand
6. **CI/CD Ready**: Structure supports automated workflows