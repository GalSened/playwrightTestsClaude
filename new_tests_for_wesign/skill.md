name: "playwright-pytest-tester"
description: |
  A skill for running automated tests using Playwright and Pytest, analyzing test code to understand features, verifying test steps including login and navigation, refactoring test code for correctness, and generating detailed Markdown reports.

functions:

- name: run_tests
  description: |
  Runs specific tests or all tests in the test directory. Accepts an optional list of test names.
  parameters:
  tests:
  type: array
  items:
  type: string
  description: "List of test file names or test functions to run. If omitted, runs all tests."
- name: analyze_test
  description: |
  Reads the test code, analyzes the description at the start of the test file, and returns key points and a summary.
- name: verify_test_steps
  description: |
  Verifies that all main steps (login, navigation, actions) are performed within the test by checking assertions and step executions.
- name: refactor_test_code
  description: |
  Performs refactoring on the test code by cleaning redundant code, standardizing format, and improving readability while preserving functionality.
- name: generate_report
  description: |
  Generates a Markdown report summarizing analysis and test run results, including recommendations for improvements if needed.
- name: navigate_scenario
  description: |
  Executes automatic navigation through the system based on scripted steps found within the test code.
