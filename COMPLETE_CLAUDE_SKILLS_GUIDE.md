# 🎯 Complete Claude Code Skills Guide - QA Intelligence Platform

**Full-Stack Enterprise Platform for AI-Powered Test Automation**

**Project:** QA Intelligence Platform with WeSign Integration
**Location:** `C:/Users/gals/Desktop/playwrightTestsClaude`
**Architecture:** Monorepo with Frontend (React), Backend (Express), AI Services, Testing Framework
**Last Updated:** 2025-10-17

---

## 📚 Table of Contents

1. [System Overview](#system-overview)
2. [How to Use Claude Code](#how-to-use-claude-code)
3. [Skill #1: Code Understanding & Navigation](#skill-1-understand-navigate)
4. [Skill #2: Refactoring & Code Improvement](#skill-2-refactor-improve)
5. [Skill #3: Bug Fixing & Debugging](#skill-3-debug-fix)
6. [Component-Specific Skills](#component-specific-skills)
7. [Full-Stack Workflows](#full-stack-workflows)
8. [AI & Advanced Features](#ai-advanced-features)
9. [Code Runner MCP - Execute & Validate](#code-runner-skills)
10. [Quick Reference](#quick-reference)

---

## 🏗️ System Overview

### Architecture Components

```
QA Intelligence Platform
├── 🎨 Frontend (React + TypeScript)
│   ├── apps/frontend/dashboard/          → Port 3001
│   ├── 17 Pages (Auth, Dashboard, AI, Analytics, etc.)
│   └── Components, Services, State Management
│
├── 🔧 Backend API (Node.js + Express)
│   ├── apps/api/src/                     → Port 8082
│   ├── 25+ API Routes
│   ├── AI Services (OpenAI, LangChain)
│   ├── Database (SQLite + PostgreSQL)
│   └── WebSocket Real-time Services
│
├── 🧠 AI Multi-Agent System
│   ├── Test Intelligence Agent
│   ├── Failure Analysis Agent
│   ├── JIRA Integration Agent
│   ├── Context Manager Agent
│   └── Workflow Persistence Agent
│
├── 🔄 Self-Healing Test System
│   ├── DOM Analysis Healing
│   ├── Selector Fallback Healing
│   ├── Pattern Recognition (ML)
│   └── Autonomous Test Repair
│
├── 📊 Analytics & Monitoring
│   ├── Real-time Analytics
│   ├── Predictive Analytics (ML)
│   ├── Performance Metrics
│   └── Resource Optimization
│
├── 🖊️ WeSign Integration (634+ Tests)
│   ├── Authentication (16 tests)
│   ├── Dashboard (25 tests)
│   ├── Document Management (55 tests)
│   ├── Digital Signing (245 tests)
│   ├── Contact Management (75 tests)
│   ├── Template Management (58 tests)
│   └── System Administration (52 tests)
│
├── 🧪 Testing Framework
│   ├── Unit Tests (Jest)
│   ├── Integration Tests (API)
│   ├── E2E Tests (Playwright)
│   └── Performance Tests
│
└── 🛠️ DevOps & Tools
    ├── CI/CD (Jenkins, GitHub Actions)
    ├── Docker & Kubernetes
    ├── Monitoring (Prometheus, Winston)
    └── Code Quality (ESLint, Prettier, TypeScript)
```

### Technology Stack

**Frontend:**
- React 18 + TypeScript 5.3
- Vite 4.5
- Tailwind CSS 3.3
- Zustand (State)
- Socket.io (Real-time)
- Recharts (Visualization)

**Backend:**
- Node.js 18+ + TypeScript
- Express.js 4.18
- SQLite 3 + PostgreSQL
- Bull/BullMQ (Queues)
- Winston (Logging)
- JWT (Auth)

**AI Stack:**
- OpenAI (GPT-4)
- LangChain
- Pinecone (Vector DB)
- TensorFlow.js
- Custom ML Models

**Testing:**
- Playwright
- Jest
- Pytest
- Newman/Postman

---

## 🚀 How to Use Claude Code

### Quick Start

```bash
# Navigate to project
cd C:/Users/gals/Desktop/playwrightTestsClaude

# Start Claude Code
claude

# Or direct command
claude "analyze the entire platform architecture"
```

### Usage Modes

1. **Interactive Mode** (Recommended)
   ```bash
   claude
   > "help me understand the AI service architecture"
   ```

2. **Direct Command Mode**
   ```bash
   claude "fix failing tests in authentication module"
   ```

3. **Extended Thinking Mode**
   ```bash
   claude --extended-thinking "refactor the entire analytics system"
   ```

4. **Plan Mode** (Safe Exploration)
   ```bash
   claude --plan "analyze before making changes to AI agents"
   ```

---

## 🔍 Skill #1: Code Understanding & Navigation {#skill-1-understand-navigate}

### Overview
Master understanding of this complex full-stack platform with AI services, multiple databases, real-time features, and extensive testing infrastructure.

---

### 1.1 System Architecture Commands

#### Understand Overall Architecture
```bash
# Get complete system overview
claude "analyze the complete QA Intelligence Platform architecture"

# Understand component interactions
claude "how do Frontend, Backend, and AI services interact?"

# Map data flows
claude "trace data flow from user action to database and back"

# Identify integration points
claude "show me all integration points between components"
```

#### Service Discovery
```bash
# List all microservices
claude "what services and sub-systems exist in this platform?"

# Understand API structure
claude "map out all API endpoints and their purposes"

# Find database schemas
claude "show me all database schemas and relationships"
```

---

### 1.2 Frontend Architecture

#### React Application Structure
```bash
# Understand pages
claude "list all 17 frontend pages and their routes"

# Analyze components
claude "show me the component hierarchy and reusable components"

# State management
claude "how is global state managed in the frontend?"

# Routing
claude "explain the routing structure and protected routes"
```

#### Specific Features
```bash
# Dashboard
claude "how does the main dashboard work and what data does it display?"

# AI Features
claude "explain the AI Assistant and AI Test Generator pages"

# Real-time Features
claude "how are real-time updates implemented with WebSocket?"

# Analytics
claude "explain the analytics and reporting system architecture"
```

---

### 1.3 Backend & API

#### API Routes
```bash
# List all endpoints
claude "list all API routes grouped by functionality"

# Understand specific route
claude "explain the /api/test-execution/run endpoint in detail"

# Find middleware
claude "what middleware is used and in what order?"

# Authentication
claude "how does authentication and authorization work?"
```

#### Services & Business Logic
```bash
# AI Services
claude "explain the AI service architecture and all AI agents"

# Analytics Service
claude "how does the analytics service process and aggregate data?"

# Healing Service
claude "explain the self-healing test system implementation"

# Test Execution
claude "trace the complete test execution workflow"
```

---

### 1.4 Database & Data Models

```bash
# Database architecture
claude "explain the database architecture (SQLite + PostgreSQL)"

# Schema exploration
claude "show me all database tables and their relationships"

# Data models
claude "list all TypeScript interfaces for data models"

# Migrations
claude "how are database migrations handled?"
```

---

### 1.5 AI & Machine Learning

```bash
# AI Agents
claude "explain all AI agents and their responsibilities"

# Multi-agent orchestration
claude "how do AI agents coordinate with each other?"

# ML Models
claude "what machine learning models are used and for what?"

# Vector DB
claude "how is Pinecone vector database used in the system?"
```

---

### 1.6 WeSign Integration

```bash
# Integration architecture
claude "how is WeSign integrated into the platform?"

# Test coverage
claude "show me the complete WeSign test structure (634+ tests)"

# API integration
claude "how does the platform communicate with WeSign API?"

# Test execution
claude "trace a complete WeSign test execution flow"
```

---

### 1.7 Testing Infrastructure

```bash
# Test organization
claude "explain the complete testing strategy (unit, integration, E2E)"

# Test frameworks
claude "what testing frameworks are used and where?"

# Test execution
claude "how are tests discovered, executed, and reported?"

# CI/CD
claude "explain the CI/CD pipeline for tests"
```

---

## 🔧 Skill #2: Refactoring & Code Improvement {#skill-2-refactor-improve}

### Overview
Improve code quality, performance, and maintainability across the entire platform.

---

### 2.1 Frontend Refactoring

#### React Components
```bash
# Remove duplication
claude "find and extract duplicate code in React components"

# Optimize performance
claude "identify and fix React performance issues (re-renders, etc.)"

# Improve hooks
claude "refactor custom hooks for better reusability"

# TypeScript types
claude "add comprehensive TypeScript types to all components"
```

#### State Management
```bash
# Zustand optimization
claude "optimize Zustand state management for better performance"

# Context optimization
claude "reduce unnecessary context re-renders"

# Form handling
claude "improve form state management and validation"
```

#### UI/UX Improvements
```bash
# Accessibility
claude "audit and fix accessibility issues in all pages"

# Responsive design
claude "improve responsive design for mobile and tablet"

# Dark mode
claude "implement consistent dark mode across all components"

# Loading states
claude "add proper loading and skeleton states throughout"
```

---

### 2.2 Backend Refactoring

#### API Routes
```bash
# Route organization
claude "reorganize API routes for better structure and maintainability"

# Error handling
claude "standardize error handling across all routes"

# Validation
claude "add comprehensive request validation using Zod"

# Documentation
claude "add OpenAPI/Swagger documentation to all endpoints"
```

#### Services
```bash
# Service layer
claude "refactor business logic into proper service layer pattern"

# Dependency injection
claude "implement dependency injection for better testability"

# Async optimization
claude "optimize async/await patterns for better performance"

# Caching
claude "add caching layer to frequently accessed data"
```

#### Database
```bash
# Query optimization
claude "optimize slow database queries"

# Connection pooling
claude "improve database connection pooling configuration"

# Indexing
claude "add database indexes for better query performance"

# Migrations
claude "organize and improve database migration structure"
```

---

### 2.3 AI System Refactoring

```bash
# Agent architecture
claude "refactor AI agents for better modularity and reusability"

# Prompt engineering
claude "improve AI prompts for better accuracy and consistency"

# Error recovery
claude "add robust error handling to AI service calls"

# Cost optimization
claude "optimize AI API calls to reduce costs"

# Caching
claude "implement intelligent caching for AI responses"
```

---

### 2.4 Testing Refactoring

```bash
# Test organization
claude "reorganize tests for better maintainability"

# Remove duplication
claude "extract common test utilities and fixtures"

# Page Objects
claude "improve Page Object Model patterns"

# Test data
claude "centralize and improve test data management"

# Assertions
claude "replace basic assertions with descriptive custom matchers"
```

---

### 2.5 Performance Optimization

```bash
# Frontend performance
claude "identify and fix frontend performance bottlenecks"

# API performance
claude "optimize API response times"

# Database performance
claude "optimize database queries and indexes"

# Bundle size
claude "reduce frontend bundle size"

# Lazy loading
claude "implement code splitting and lazy loading"
```

---

### 2.6 Code Quality

```bash
# TypeScript strictness
claude "enable strict TypeScript mode and fix all errors"

# Linting
claude "fix all ESLint warnings and errors"

# Code complexity
claude "identify and refactor complex functions (high cyclomatic complexity)"

# Dead code
claude "find and remove dead code and unused imports"

# Documentation
claude "add JSDoc comments to all public APIs"
```

---

## 🐛 Skill #3: Bug Fixing & Debugging {#skill-3-debug-fix}

### Overview
Diagnose and fix issues across the entire stack.

---

### 3.1 Frontend Debugging

#### React Issues
```bash
# Component errors
claude "fix React component rendering error: [error message]"

# State issues
claude "debug state update not triggering re-render"

# Hooks issues
claude "fix useEffect infinite loop"

# Event handling
claude "fix event handler not firing"
```

#### API Integration
```bash
# Network errors
claude "debug failed API calls returning 500 errors"

# CORS issues
claude "fix CORS errors in development"

# Authentication
claude "debug JWT token expiration issues"

# WebSocket
claude "fix WebSocket connection dropping"
```

---

### 3.2 Backend Debugging

#### API Errors
```bash
# 500 errors
claude "debug and fix internal server error in /api/test-execution"

# Database errors
claude "fix database connection timeout errors"

# Memory leaks
claude "investigate memory leak in test execution service"

# Performance
claude "debug why API endpoints are slow"
```

#### Service Issues
```bash
# AI service errors
claude "fix OpenAI API timeout errors"

# Queue issues
claude "debug why background jobs are not processing"

# File system
claude "fix file upload errors"

# WebSocket
claude "debug WebSocket server crashes"
```

---

### 3.3 Database Issues

```bash
# Connection issues
claude "fix database connection pool exhaustion"

# Query errors
claude "debug SQL syntax error in analytics query"

# Migration failures
claude "fix failed database migration"

# Data integrity
claude "investigate and fix data inconsistency issues"

# Performance
claude "debug slow queries causing timeouts"
```

---

### 3.4 AI System Debugging

```bash
# Agent errors
claude "debug AI agent not responding"

# Prompt issues
claude "fix AI generating incorrect test code"

# Rate limiting
claude "handle OpenAI rate limit errors gracefully"

# Vector DB
claude "debug Pinecone search returning no results"

# Context issues
claude "fix AI losing conversation context"
```

---

### 3.5 Test Failures

```bash
# Unit tests
claude "fix failing Jest unit tests in authentication service"

# Integration tests
claude "debug API integration test failures"

# E2E tests
claude "fix flaky Playwright test in login flow"

# WeSign tests
claude "debug WeSign document upload test timeout"

# CI failures
claude "fix tests passing locally but failing in CI"
```

---

### 3.6 Environment & Configuration

```bash
# Environment variables
claude "fix missing environment variable errors"

# Configuration
claude "debug configuration loading issues"

# Dependencies
claude "fix npm/package dependency conflicts"

# Build errors
claude "debug TypeScript compilation errors"

# Docker issues
claude "fix Docker container startup failures"
```

---

## 🎯 Component-Specific Skills {#component-specific-skills}

### Frontend Dashboard Skills

```bash
# Understand
claude "explain the Dashboard page architecture and data flow"

# Refactor
claude "refactor Dashboard to use server-side data fetching"

# Debug
claude "fix Dashboard widgets not updating in real-time"

# Add Feature
claude "add a new widget to the Dashboard for test coverage"
```

### AI Services Skills

```bash
# Understand
claude "explain how the AI Test Generator works end-to-end"

# Refactor
claude "improve AI agent prompt templates for better results"

# Debug
claude "fix AI service returning incorrect test suggestions"

# Add Feature
claude "add a new AI agent for performance test generation"
```

### WeSign Integration Skills

```bash
# Understand
claude "trace a complete WeSign document signing workflow"

# Refactor
claude "refactor WeSign API client for better error handling"

# Debug
claude "fix WeSign authentication failing intermittently"

# Add Feature
claude "add support for bulk document operations in WeSign"
```

### Analytics System Skills

```bash
# Understand
claude "explain the real-time analytics architecture"

# Refactor
claude "optimize analytics queries for better performance"

# Debug
claude "fix analytics dashboard showing stale data"

# Add Feature
claude "add predictive analytics for test failure trends"
```

### Testing Framework Skills

```bash
# Understand
claude "explain the complete test execution pipeline"

# Refactor
claude "improve test discovery and organization"

# Debug
claude "fix test runner not detecting new tests"

# Add Feature
claude "add parallel test execution support"
```

---

## 🌟 Full-Stack Workflows {#full-stack-workflows}

### Workflow 1: Add New Feature (Complete)

```bash
# Step 1: Understand existing patterns
claude "how are features typically implemented in this platform?"

# Step 2: Design
claude "design a new 'Test Scheduling' feature with frontend, backend, and database"

# Step 3: Database
claude "create database schema for test scheduling feature"

# Step 4: Backend API
claude "implement backend API endpoints for test scheduling"

# Step 5: Frontend
claude "create React components and pages for test scheduling UI"

# Step 6: Tests
claude "write comprehensive tests (unit, integration, E2E) for test scheduling"

# Step 7: Documentation
claude "update documentation for the new test scheduling feature"

# Step 8: CI/CD
claude "add test scheduling to CI/CD pipeline"
```

### Workflow 2: Fix Production Bug

```bash
# Step 1: Reproduce
claude "analyze production logs for error: [error message]"

# Step 2: Trace
claude "trace the bug from frontend through backend to database"

# Step 3: Root cause
claude "identify the root cause of the production bug"

# Step 4: Fix
claude "implement fix for the production bug with tests"

# Step 5: Verify
claude "verify fix works across all affected components"

# Step 6: Deploy
claude "create hotfix branch and deployment plan"
```

### Workflow 3: Performance Optimization

```bash
# Step 1: Identify bottlenecks
claude "run performance audit on the entire platform"

# Step 2: Frontend optimization
claude "optimize frontend bundle size and rendering performance"

# Step 3: Backend optimization
claude "optimize API response times and database queries"

# Step 4: Infrastructure
claude "optimize caching, connection pooling, and resource usage"

# Step 5: Verify
claude "measure performance improvements before/after"
```

### Workflow 4: Security Audit

```bash
# Step 1: Authentication
claude "audit authentication and authorization system"

# Step 2: API Security
claude "check for API vulnerabilities (injection, CORS, rate limiting)"

# Step 3: Dependencies
claude "audit dependencies for known vulnerabilities"

# Step 4: Data Security
claude "audit data encryption, PII handling, and secrets management"

# Step 5: Frontend Security
claude "check for XSS, CSRF, and other frontend vulnerabilities"
```

### Workflow 5: Refactor Major Component

```bash
# Step 1: Analyze current state
claude "analyze the AI service architecture for refactoring opportunities"

# Step 2: Create plan
claude "create detailed refactoring plan with migration strategy"

# Step 3: Write tests
claude "write comprehensive tests for existing behavior"

# Step 4: Refactor incrementally
claude "refactor AI services step-by-step with test coverage"

# Step 5: Verify
claude "ensure all tests pass and no regressions introduced"
```

---

## 🧠 AI & Advanced Features {#ai-advanced-features}

### AI Agent Development

```bash
# Create new agent
claude "create a new AI agent for code review with LangChain"

# Multi-agent coordination
claude "implement coordination between AI agents using workflow patterns"

# Prompt engineering
claude "optimize prompts for better AI test generation accuracy"

# Fine-tuning
claude "prepare training data for fine-tuning test generation model"
```

### Self-Healing System

```bash
# Understand
claude "explain the self-healing test system architecture"

# Improve healing strategies
claude "add new healing strategies for common failure patterns"

# ML model training
claude "improve ML model for failure pattern recognition"

# Auto-repair confidence
claude "adjust confidence thresholds for automatic test repair"
```

### Real-time Analytics

```bash
# WebSocket optimization
claude "optimize WebSocket connections for scalability"

# Streaming analytics
claude "implement streaming analytics for live test metrics"

# Dashboard updates
claude "improve real-time dashboard update efficiency"
```

### Predictive Analytics

```bash
# ML models
claude "train predictive model for test failure prediction"

# Feature engineering
claude "add features for better failure prediction accuracy"

# Integration
claude "integrate predictive analytics into test scheduler"
```

---

## 🚀 Code Runner MCP - Execute & Validate {#code-runner-skills}

### Overview

The **Code Runner MCP Server** enables Claude to execute code snippets in 30+ programming languages directly within your workflow. This is perfect for rapid prototyping, testing algorithms, generating test data, and validating code logic.

**Status**: ✅ Installed and Connected

---

### 4.1 Quick Code Execution

#### Test Algorithms & Logic

```bash
# Test Python algorithm
claude "run this Python code to validate the fibonacci function"

# Test JavaScript logic
claude "execute this JS code to test the array sorting algorithm"

# Test multiple languages
claude "implement and test the same algorithm in Python, JavaScript, and Java"
```

#### Real-World Examples

**Python - Test Data Generation:**
```bash
claude "write and run Python code to generate 10 test users with random data"
```

**JavaScript - Validate Logic:**
```bash
claude "run JavaScript to calculate test execution metrics from this data: [data]"
```

**Java - Quick Test:**
```bash
claude "execute Java code to validate email regex pattern"
```

---

### 4.2 Test Data Generation

#### Generate Mock Data

```bash
# User data
claude "generate 50 test users with Israeli phone numbers and WeSign-compatible fields"

# Document data
claude "create test document metadata in JSON format"

# Test scenarios
claude "generate test cases for login validation (valid, invalid, edge cases)"
```

#### Real Examples

**Generate WeSign Test Data:**
```bash
claude "write and run Python code to generate test data for:
- 10 companies with contact info
- 5 documents per company
- Random signatures and timestamps
Output as JSON"
```

**Generate API Test Payloads:**
```bash
claude "create JavaScript code that generates valid and invalid API request payloads for authentication"
```

---

### 4.3 Quick Calculations & Analysis

#### Test Metrics

```bash
# Performance analysis
claude "calculate average, min, max, and p95 for these test execution times: [times]"

# Success rate
claude "run code to calculate test pass rate, failure trends, and flakiness score"

# Resource usage
claude "analyze test resource consumption and identify optimization opportunities"
```

#### Real Examples

**Performance Analysis:**
```bash
claude "run Python code to analyze test execution data:
- Total time: 156.7s
- Tests: 61
- Calculate: avg time per test, outliers, efficiency score"
```

**Coverage Calculation:**
```bash
claude "execute code to calculate test coverage:
- Total features: 25
- Tested: 18
- Calculate percentage and identify gaps"
```

---

### 4.4 Validation & Testing

#### Validate Selectors

```bash
# CSS selectors
claude "run JavaScript to validate these CSS selectors are syntactically correct"

# Regex patterns
claude "test this regex pattern against sample data"

# Data formats
claude "validate JSON schema compliance"
```

#### Real Examples

**Selector Validation:**
```bash
claude "write and run code to validate these Playwright selectors:
- '#login-button'
- '[data-testid=\"upload\"]'
- '.document-list > li:nth-child(2)'
Check syntax and suggest improvements"
```

**API Response Validation:**
```bash
claude "run code to validate this API response matches expected schema"
```

---

### 4.5 Data Transformation

#### Convert Formats

```bash
# CSV to JSON
claude "convert this CSV test data to JSON format"

# XML to JSON
claude "parse and convert this XML API response to JSON"

# Data cleaning
claude "clean and normalize this test data"
```

#### Real Examples

**Test Data Conversion:**
```bash
claude "write Python code to convert this WeSign CSV export to JSON:
name,email,phone,status
Alice,alice@test.com,+972551234567,active
Bob,bob@test.com,+972552345678,pending"
```

**Log Parsing:**
```bash
claude "parse and extract errors from this test execution log"
```

---

### 4.6 Algorithm Testing

#### Compare Implementations

```bash
# Multi-language comparison
claude "implement binary search in Python, JavaScript, and Java - show execution and results"

# Performance comparison
claude "compare sorting algorithms (bubble, quick, merge) and show time complexity"

# Pattern testing
claude "test different regex patterns for email validation"
```

#### Real Examples

**Test Different Approaches:**
```bash
claude "implement WeSign document validation in 3 ways:
1. Imperative approach
2. Functional approach
3. Object-oriented approach
Run all and compare readability"
```

---

### 4.7 Quick Prototypes

#### Test Code Snippets

```bash
# Test before implementing
claude "run this code snippet to verify it works before adding to codebase"

# Validate API calls
claude "test this API request code to ensure correct structure"

# Check compatibility
claude "run code in different language versions to check compatibility"
```

#### Real Examples

**Prototype Feature:**
```bash
claude "write and run a quick prototype of the document signature validator before full implementation"
```

**Test Integration:**
```bash
claude "execute sample code to test WeSign API integration before implementing in production"
```

---

### 4.8 QA Intelligence Platform Use Cases

#### 1. Test Suite Metrics

```bash
claude "calculate comprehensive test suite metrics:
- Total tests: 61
- Passing: 9
- Failing: 32
- Skipped: 20
Calculate pass rate, reliability score, and health status"
```

#### 2. WeSign Test Data

```bash
claude "generate realistic WeSign test data:
- Hebrew and English names
- Israeli phone numbers
- Valid email addresses
- Document types (PDF, DOCX, XLSX)
- Signature coordinates
Output as JSON for test fixtures"
```

#### 3. Performance Benchmarking

```bash
claude "analyze these Playwright test timings and identify slowest tests:
[paste test results]
Calculate: avg time, outliers, bottlenecks"
```

#### 4. Selector Strategy Testing

```bash
claude "test selector fallback strategy:
Primary: #login-button
Fallback: button[type='submit']
Fallback: .login-btn
Validate all variations"
```

#### 5. API Response Validation

```bash
claude "validate this WeSign API response structure:
- Required fields present
- Data types correct
- Status codes valid
- Error handling proper"
```

#### 6. Test Data Generator

```bash
claude "create a test data generator for:
- User authentication (valid, invalid, edge cases)
- Document upload (various file types and sizes)
- Signature workflows (single, multiple signers)"
```

#### 7. Error Pattern Analysis

```bash
claude "analyze these error logs and identify patterns:
[paste logs]
Group by: error type, frequency, time of day"
```

#### 8. Database Query Builder

```bash
claude "generate SQL queries for test data:
- Create 100 test users
- Create 500 test documents
- Link documents to users
- Add signatures
Show queries and sample data"
```

---

### 4.9 Code Runner Commands Reference

#### Supported Languages (30+)

| Category | Languages |
|----------|-----------|
| **Scripting** | JavaScript, TypeScript, Python, Ruby, Perl, PHP, Lua |
| **Compiled** | Go, Rust, C, C++, Java, Kotlin, Swift, Scala |
| **Shell** | Bash, PowerShell, CMD, VBScript, AppleScript |
| **Functional** | Haskell, Clojure, Elixir, Lisp, Scheme, F#, OCaml |
| **Other** | Julia, Dart, Groovy, CoffeeScript, Crystal, Nim |

#### Quick Commands

```bash
# Execute code
claude "run this [language] code: [code]"

# Generate and execute
claude "write [language] code to [task] and execute it"

# Multi-language test
claude "implement [algorithm] in Python and JavaScript, run both"

# Performance test
claude "run this code and measure execution time"

# Validate output
claude "execute this code and verify output matches [expected]"
```

---

### 4.10 Best Practices

#### ✅ DO Use Code Runner For:

- **Rapid Prototyping**: Test ideas before full implementation
- **Algorithm Validation**: Verify logic correctness
- **Test Data Generation**: Create realistic mock data
- **Quick Calculations**: Analyze metrics and statistics
- **Format Conversion**: Transform data between formats
- **Regex Testing**: Validate patterns before use
- **API Testing**: Test request/response structures
- **Learning**: Experiment with new languages/concepts

#### ❌ DON'T Use Code Runner For:

- **Production Code**: Use proper deployment pipelines
- **Sensitive Data**: Don't process PII or secrets
- **Long-Running Tasks**: Has execution timeouts
- **File System Operations**: Limited file access
- **Network Operations**: Restricted network access
- **Database Modifications**: Use proper DB tools
- **Security Testing**: Use dedicated security tools

---

### 4.11 Integration with Other Skills

**Combine with Skill #1 (Understanding):**
```bash
# Understand by executing
claude "run this code from the codebase to understand what it does"
```

**Combine with Skill #2 (Refactoring):**
```bash
# Test before refactoring
claude "run both old and new implementations to verify same output"
```

**Combine with Skill #3 (Debugging):**
```bash
# Debug by executing
claude "run this code with different inputs to isolate the bug"
```

**With AI Services:**
```bash
# Test AI prompts
claude "execute code to test different AI prompt variations"
```

**With Testing:**
```bash
# Generate test data
claude "run code to generate test fixtures for Playwright tests"
```

---

### 4.12 Security & Safety

⚠️ **Important Security Notes:**

1. **Code Review**: Always review code before execution
2. **Trust Level**: Only run code you understand
3. **Permissions**: Code runs with your user permissions
4. **File Access**: Can read/write files on your system
5. **Network Access**: Can make network requests
6. **No Sandboxing**: Not isolated from your system

**Safe Usage:**
- ✅ Review all code before asking Claude to execute
- ✅ Use for testing and development only
- ✅ Keep interpreters up to date
- ❌ Don't run code from untrusted sources
- ❌ Don't process sensitive production data
- ❌ Don't run code requiring elevated privileges

---

### 4.13 Quick Examples for Daily Use

**Morning Standup:**
```bash
claude "analyze yesterday's test results and calculate success metrics"
```

**Before Implementing:**
```bash
claude "prototype this feature logic in Python to verify approach"
```

**During Testing:**
```bash
claude "generate 100 test users for load testing"
```

**Before Commit:**
```bash
claude "validate all regex patterns used in the code"
```

**Performance Check:**
```bash
claude "calculate and compare performance metrics for last 5 test runs"
```

---

## 📋 Quick Reference {#quick-reference}

### Common Commands by Task

| Task | Command |
|------|---------|
| **System Overview** | `claude "analyze the complete platform architecture"` |
| **Find Feature** | `claude "where is [feature] implemented?"` |
| **Trace Flow** | `claude "trace [user action] from frontend to database"` |
| **Fix Bug** | `claude "fix [error message or description]"` |
| **Refactor** | `claude "refactor [component] for better [quality]"` |
| **Add Feature** | `claude "implement [feature] across the stack"` |
| **Optimize** | `claude "optimize [component] for performance"` |
| **Test** | `claude "write tests for [feature]"` |
| **Debug** | `claude "debug why [expected behavior] doesn't work"` |
| **Document** | `claude "document [component/API/feature]"` |
| **Execute Code** | `claude "run this [language] code: [code]"` |
| **Generate Data** | `claude "generate test data for [scenario]"` |
| **Calculate** | `claude "calculate [metrics] from this data"` |

### Commands by Component

**Frontend:**
- `claude "analyze React component structure"`
- `claude "fix React performance issues"`
- `claude "add new page to dashboard"`

**Backend:**
- `claude "analyze API architecture"`
- `claude "optimize database queries"`
- `claude "add new API endpoint"`

**AI Services:**
- `claude "explain AI agent system"`
- `claude "improve AI prompts"`
- `claude "add new AI capability"`

**Testing:**
- `claude "fix failing tests"`
- `claude "add E2E test for feature"`
- `claude "improve test coverage"`

**DevOps:**
- `claude "fix CI/CD pipeline"`
- `claude "optimize Docker build"`
- `claude "improve monitoring"`

### Daily Workflow Commands

**Morning Standup:**
```bash
claude "what changed since yesterday? show recent commits and their impact"
```

**Before Making Changes:**
```bash
claude --plan "analyze impact of changing [component]"
```

**During Development:**
```bash
claude "implement [feature] following existing patterns"
```

**Before Commit:**
```bash
claude "review my changes and suggest improvements"
```

**Before PR:**
```bash
claude "create comprehensive tests for my changes"
```

---

## 🎓 Learning Paths

### Week 1: Platform Understanding
- Day 1-2: System architecture and components
- Day 3: Frontend structure and patterns
- Day 4: Backend API and services
- Day 5: Testing infrastructure

### Week 2: AI & Advanced Features
- Day 1-2: AI agent system
- Day 3: Self-healing mechanism
- Day 4: Analytics and real-time features
- Day 5: WeSign integration

### Week 3: Development Skills
- Day 1-2: Full-stack feature development
- Day 3-4: Testing and quality assurance
- Day 5: Deployment and DevOps

### Week 4: Mastery
- Advanced debugging techniques
- Performance optimization
- Security best practices
- Architecture decisions

---

## 🚨 Emergency Commands

### Production Down
```bash
claude "analyze production logs and identify critical issues"
claude "create emergency hotfix for [issue]"
```

### Performance Crisis
```bash
claude "identify performance bottlenecks causing slowdown"
claude "implement quick performance fixes"
```

### Security Incident
```bash
claude "audit system for security vulnerability [CVE]"
claude "implement security patch immediately"
```

### Data Loss Risk
```bash
claude "implement immediate database backup"
claude "create data recovery plan"
```

---

## 💡 Pro Tips

### Maximize Effectiveness

1. **Be Specific**: "Fix login timeout" vs "Fix authentication bug in frontend causing 401 errors after 15 minutes"

2. **Provide Context**: Share error logs, screenshots, or reproduction steps

3. **Use Extended Thinking**: For complex architectural decisions
   ```bash
   claude --extended-thinking "redesign the AI agent orchestration system"
   ```

4. **Work Incrementally**: Break large tasks into smaller steps

5. **Test After Changes**: Always verify changes don't break existing functionality

### Best Practices

✅ **DO:**
- Start with understanding before making changes
- Use plan mode for complex refactoring
- Write tests for all changes
- Document architectural decisions
- Follow existing patterns and conventions

❌ **DON'T:**
- Make changes without understanding impact
- Skip testing
- Ignore TypeScript errors
- Break existing functionality
- Forget to update documentation

---

## 📞 Getting Help

**Claude Code Help:**
```bash
claude --help
claude "how do I use extended thinking?"
```

**Project Documentation:**
- Main README: `./README.md`
- CLAUDE Integration: `./CLAUDE.md`
- Backend Docs: `./backend/TESTING.md`
- CI/CD Docs: `./CICD_*.md`

**External Resources:**
- Claude Code Docs: https://docs.claude.com/claude-code
- Playwright Docs: https://playwright.dev
- React Docs: https://react.dev
- Express Docs: https://expressjs.com

---

## 🎯 Success Metrics

Track your progress:

- ✅ Can navigate entire codebase confidently
- ✅ Can trace features across full stack
- ✅ Can fix bugs independently
- ✅ Can refactor code safely
- ✅ Can add features end-to-end
- ✅ Can optimize performance
- ✅ Can write comprehensive tests
- ✅ Can deploy changes safely

---

**Remember:** Claude Code is your AI pair programmer. Just describe what you want in natural language, and it will guide you through the entire development process!

**Start your journey:**
```bash
claude "I want to understand the QA Intelligence Platform - give me a guided tour"
```

---

*QA Intelligence Platform - Enterprise Multi-Agent Orchestration for AI-Powered Test Automation*
*Version 2.0.0 | Last Updated: 2025-10-17*
