#!/usr/bin/env python3
"""
Report Aggregator for WeSign CI/CD Pipeline
===========================================

Collect and merge TRX, Newman HTML, Playwright HTML reports into unified JSON summary.
Generate weighted "Run Score" and integrate with QA Intelligence backend.

Author: QA Intelligence System
Version: 2.0
Platform: Windows-compatible (py command ready)
"""

import argparse
import hashlib
import json
import logging
import os
import re
import shutil
import sys
import xml.etree.ElementTree as ET
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any, Union
import zipfile

try:
    from bs4 import BeautifulSoup
    import requests
except ImportError:
    print("ERROR: Required libraries not installed. Run: pip install beautifulsoup4 requests lxml")
    sys.exit(1)

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('report_aggregator.log', mode='a')
    ]
)
logger = logging.getLogger(__name__)


@dataclass
class TestMetrics:
    """Structured test metrics for scoring calculation."""
    total_tests: int = 0
    passed_tests: int = 0
    failed_tests: int = 0
    skipped_tests: int = 0
    duration_seconds: float = 0.0
    success_rate: float = 0.0
    average_response_time_ms: float = 0.0


@dataclass
class ArtifactInfo:
    """Information about test artifacts."""
    name: str
    path: Path
    size_bytes: int
    checksum: str
    type: str  # 'trx', 'newman-html', 'playwright-html', 'screenshot', 'video', 'har'
    created_at: datetime
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class ReportSummary:
    """Comprehensive report summary with scoring."""
    run_id: str
    environment: str
    start_time: datetime
    end_time: datetime
    total_duration_seconds: float

    # Component scores (0-100)
    build_score: float
    smoke_score: float
    api_score: float
    e2e_score: float

    # Weighted overall score
    overall_score: float

    # Detailed metrics
    metrics: Dict[str, TestMetrics]
    artifacts: List[ArtifactInfo]

    # Integration info
    qa_intelligence_reported: bool = False
    jenkins_build_number: Optional[str] = None
    git_commit_hash: Optional[str] = None


class TRXParser:
    """Parser for Visual Studio TRX test results."""

    @staticmethod
    def parse_trx_file(file_path: Path) -> TestMetrics:
        """Parse TRX file and extract test metrics."""
        logger.info(f"Parsing TRX file: {file_path}")

        try:
            tree = ET.parse(file_path)
            root = tree.getroot()

            # Handle XML namespace
            namespace = {'mstest': 'http://microsoft.com/schemas/VisualStudio/TeamTest/2010'}

            # Find test results summary
            counters = root.find('.//mstest:Counters', namespace)
            if counters is None:
                # Try without namespace for older TRX files
                counters = root.find('.//Counters')

            if counters is not None:
                total = int(counters.get('total', 0))
                executed = int(counters.get('executed', 0))
                passed = int(counters.get('passed', 0))
                failed = int(counters.get('failed', 0))
                error = int(counters.get('error', 0))
                timeout = int(counters.get('timeout', 0))
                aborted = int(counters.get('aborted', 0))
                inconclusive = int(counters.get('inconclusive', 0))

                # Calculate skipped and failed totals
                total_failed = failed + error + timeout + aborted
                skipped = total - executed

                success_rate = (passed / total * 100) if total > 0 else 0

                # Extract execution times
                times = root.find('.//mstest:Times', namespace)
                if times is None:
                    times = root.find('.//Times')

                duration_seconds = 0.0
                if times is not None:
                    start_time = times.get('start', '')
                    finish_time = times.get('finish', '')

                    if start_time and finish_time:
                        try:
                            start = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
                            finish = datetime.fromisoformat(finish_time.replace('Z', '+00:00'))
                            duration_seconds = (finish - start).total_seconds()
                        except ValueError:
                            logger.warning("Failed to parse TRX execution times")

                return TestMetrics(
                    total_tests=total,
                    passed_tests=passed,
                    failed_tests=total_failed,
                    skipped_tests=skipped,
                    duration_seconds=duration_seconds,
                    success_rate=success_rate
                )
            else:
                logger.warning("No counters found in TRX file")
                return TestMetrics()

        except ET.ParseError as e:
            logger.error(f"Failed to parse TRX file: {e}")
            return TestMetrics()
        except Exception as e:
            logger.error(f"Error processing TRX file: {e}")
            return TestMetrics()


class NewmanHTMLParser:
    """Parser for Newman HTML reports."""

    @staticmethod
    def parse_newman_html(file_path: Path) -> TestMetrics:
        """Parse Newman HTML report and extract metrics."""
        logger.info(f"Parsing Newman HTML report: {file_path}")

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            soup = BeautifulSoup(content, 'html.parser')

            # Extract summary statistics
            metrics = TestMetrics()

            # Look for test counts in various possible locations
            summary_sections = [
                soup.find('div', class_='summary'),
                soup.find('div', id='summary'),
                soup.find('.test-summary'),
                soup.find('.stats')
            ]

            for section in summary_sections:
                if section:
                    # Try to extract numbers from text
                    text = section.get_text()

                    # Look for patterns like "5 passed", "2 failed", "10 total"
                    passed_match = re.search(r'(\d+)\s*passed', text, re.IGNORECASE)
                    failed_match = re.search(r'(\d+)\s*failed', text, re.IGNORECASE)
                    total_match = re.search(r'(\d+)\s*total', text, re.IGNORECASE)
                    skipped_match = re.search(r'(\d+)\s*skipped', text, re.IGNORECASE)

                    if passed_match:
                        metrics.passed_tests = int(passed_match.group(1))
                    if failed_match:
                        metrics.failed_tests = int(failed_match.group(1))
                    if total_match:
                        metrics.total_tests = int(total_match.group(1))
                    if skipped_match:
                        metrics.skipped_tests = int(skipped_match.group(1))

                    break

            # If total not found, calculate from passed + failed + skipped
            if metrics.total_tests == 0:
                metrics.total_tests = metrics.passed_tests + metrics.failed_tests + metrics.skipped_tests

            # Calculate success rate
            if metrics.total_tests > 0:
                metrics.success_rate = metrics.passed_tests / metrics.total_tests * 100

            # Try to extract response times
            response_times = []
            time_elements = soup.find_all(string=re.compile(r'\d+ms|\d+\.\d+ms'))
            for element in time_elements:
                time_match = re.search(r'(\d+(?:\.\d+)?)ms', element)
                if time_match:
                    response_times.append(float(time_match.group(1)))

            if response_times:
                metrics.average_response_time_ms = sum(response_times) / len(response_times)

            # Try to extract execution time
            duration_text = soup.find(string=re.compile(r'execution time|duration|elapsed'))
            if duration_text:
                duration_match = re.search(r'(\d+(?:\.\d+)?)\s*(s|seconds|ms|milliseconds)', duration_text)
                if duration_match:
                    time_value = float(duration_match.group(1))
                    unit = duration_match.group(2).lower()
                    if unit.startswith('ms') or unit.startswith('milliseconds'):
                        metrics.duration_seconds = time_value / 1000
                    else:
                        metrics.duration_seconds = time_value

            logger.info(f"Newman metrics: {metrics.total_tests} total, {metrics.passed_tests} passed, {metrics.failed_tests} failed")
            return metrics

        except Exception as e:
            logger.error(f"Error parsing Newman HTML report: {e}")
            return TestMetrics()


class PlaywrightHTMLParser:
    """Parser for Playwright HTML reports."""

    @staticmethod
    def parse_playwright_html(file_path: Path) -> TestMetrics:
        """Parse Playwright HTML report and extract metrics."""
        logger.info(f"Parsing Playwright HTML report: {file_path}")

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            soup = BeautifulSoup(content, 'html.parser')
            metrics = TestMetrics()

            # Look for Playwright-specific elements
            # Check for JSON data embedded in script tags
            script_tags = soup.find_all('script')
            for script in script_tags:
                if script.string and 'window.playwrightReportBase64' in script.string:
                    try:
                        # Extract base64 data and decode
                        import base64
                        match = re.search(r'window\.playwrightReportBase64\s*=\s*["\']([^"\']+)["\']', script.string)
                        if match:
                            report_data = json.loads(base64.b64decode(match.group(1)).decode('utf-8'))

                            # Extract stats from report data
                            if 'stats' in report_data:
                                stats = report_data['stats']
                                metrics.total_tests = stats.get('total', 0)
                                metrics.passed_tests = stats.get('expected', 0)
                                metrics.failed_tests = stats.get('unexpected', 0)
                                metrics.skipped_tests = stats.get('skipped', 0)

                                if metrics.total_tests > 0:
                                    metrics.success_rate = metrics.passed_tests / metrics.total_tests * 100

                            # Extract duration
                            if 'duration' in report_data:
                                metrics.duration_seconds = report_data['duration'] / 1000  # Convert ms to seconds

                            return metrics
                    except Exception as e:
                        logger.warning(f"Failed to parse embedded Playwright data: {e}")
                        continue

            # Fallback: Parse HTML structure
            # Look for test result summaries in HTML
            summary_elements = [
                soup.find(class_='suites-header'),
                soup.find(id='summary'),
                soup.find('.test-results-summary')
            ]

            for element in summary_elements:
                if element:
                    text = element.get_text()

                    # Look for patterns like "5 passed, 2 failed out of 7 total"
                    passed_match = re.search(r'(\d+)\s*passed', text, re.IGNORECASE)
                    failed_match = re.search(r'(\d+)\s*failed', text, re.IGNORECASE)
                    total_match = re.search(r'(\d+)\s*total', text, re.IGNORECASE)
                    skipped_match = re.search(r'(\d+)\s*skipped', text, re.IGNORECASE)

                    if passed_match:
                        metrics.passed_tests = int(passed_match.group(1))
                    if failed_match:
                        metrics.failed_tests = int(failed_match.group(1))
                    if total_match:
                        metrics.total_tests = int(total_match.group(1))
                    if skipped_match:
                        metrics.skipped_tests = int(skipped_match.group(1))

                    if metrics.total_tests > 0:
                        break

            # Calculate missing values
            if metrics.total_tests == 0:
                metrics.total_tests = metrics.passed_tests + metrics.failed_tests + metrics.skipped_tests

            if metrics.total_tests > 0:
                metrics.success_rate = metrics.passed_tests / metrics.total_tests * 100

            # Try to extract execution time from page text
            duration_elements = soup.find_all(string=re.compile(r'(\d+(?:\.\d+)?)\s*(s|ms|seconds|milliseconds)', re.IGNORECASE))
            for element in duration_elements:
                duration_match = re.search(r'(\d+(?:\.\d+)?)\s*(s|ms|seconds|milliseconds)', element, re.IGNORECASE)
                if duration_match:
                    time_value = float(duration_match.group(1))
                    unit = duration_match.group(2).lower()
                    if unit.startswith('ms') or 'millisecond' in unit:
                        metrics.duration_seconds = time_value / 1000
                    else:
                        metrics.duration_seconds = time_value
                    break

            logger.info(f"Playwright metrics: {metrics.total_tests} total, {metrics.passed_tests} passed, {metrics.failed_tests} failed")
            return metrics

        except Exception as e:
            logger.error(f"Error parsing Playwright HTML report: {e}")
            return TestMetrics()


class ArtifactManager:
    """Manages test artifacts and generates checksums."""

    @staticmethod
    def scan_artifacts(directory: Path, patterns: List[str]) -> List[ArtifactInfo]:
        """Scan directory for artifacts matching patterns."""
        artifacts = []

        for pattern in patterns:
            for file_path in directory.rglob(pattern):
                if file_path.is_file():
                    artifact = ArtifactManager._create_artifact_info(file_path)
                    if artifact:
                        artifacts.append(artifact)

        return artifacts

    @staticmethod
    def _create_artifact_info(file_path: Path) -> Optional[ArtifactInfo]:
        """Create artifact info with checksum and metadata."""
        try:
            stat = file_path.stat()

            # Calculate file checksum
            checksum = ArtifactManager._calculate_checksum(file_path)

            # Determine artifact type
            artifact_type = ArtifactManager._determine_artifact_type(file_path)

            # Extract metadata based on type
            metadata = ArtifactManager._extract_metadata(file_path, artifact_type)

            return ArtifactInfo(
                name=file_path.name,
                path=file_path,
                size_bytes=stat.st_size,
                checksum=checksum,
                type=artifact_type,
                created_at=datetime.fromtimestamp(stat.st_mtime),
                metadata=metadata
            )

        except Exception as e:
            logger.warning(f"Failed to create artifact info for {file_path}: {e}")
            return None

    @staticmethod
    def _calculate_checksum(file_path: Path) -> str:
        """Calculate SHA-256 checksum of file."""
        sha256_hash = hashlib.sha256()
        try:
            with open(file_path, 'rb') as f:
                for chunk in iter(lambda: f.read(4096), b""):
                    sha256_hash.update(chunk)
            return sha256_hash.hexdigest()
        except Exception as e:
            logger.warning(f"Failed to calculate checksum for {file_path}: {e}")
            return "unknown"

    @staticmethod
    def _determine_artifact_type(file_path: Path) -> str:
        """Determine artifact type based on file extension and content."""
        suffix = file_path.suffix.lower()
        name = file_path.name.lower()

        if suffix == '.trx':
            return 'trx'
        elif suffix == '.html' and 'newman' in name:
            return 'newman-html'
        elif suffix == '.html' and 'playwright' in name:
            return 'playwright-html'
        elif suffix in ['.png', '.jpg', '.jpeg']:
            return 'screenshot'
        elif suffix in ['.mp4', '.webm', '.avi']:
            return 'video'
        elif suffix == '.har':
            return 'har'
        elif suffix in ['.json', '.xml']:
            return 'report'
        elif suffix == '.log':
            return 'log'
        else:
            return 'other'

    @staticmethod
    def _extract_metadata(file_path: Path, artifact_type: str) -> Dict[str, Any]:
        """Extract metadata specific to artifact type."""
        metadata = {}

        try:
            if artifact_type == 'screenshot':
                # Try to extract image dimensions
                try:
                    from PIL import Image
                    with Image.open(file_path) as img:
                        metadata['dimensions'] = f"{img.width}x{img.height}"
                        metadata['format'] = img.format
                except ImportError:
                    pass
                except Exception:
                    pass

            elif artifact_type in ['newman-html', 'playwright-html', 'trx']:
                # Add parsing timestamp
                metadata['parsed_at'] = datetime.now().isoformat()

            elif artifact_type == 'video':
                # Could add video duration, codec info etc.
                metadata['type'] = 'test-recording'

            elif artifact_type == 'har':
                # Try to extract entry count from HAR file
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        har_data = json.load(f)
                        entries = har_data.get('log', {}).get('entries', [])
                        metadata['entry_count'] = len(entries)
                        metadata['version'] = har_data.get('log', {}).get('version', 'unknown')
                except Exception:
                    pass

        except Exception as e:
            logger.debug(f"Failed to extract metadata for {file_path}: {e}")

        return metadata


class QAIntelligenceReporter:
    """Integration with QA Intelligence backend API."""

    def __init__(self, base_url: str, api_key: Optional[str] = None):
        """Initialize QA Intelligence reporter."""
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key or os.getenv('QA_INTELLIGENCE_API_KEY')
        self.session = requests.Session()

        if self.api_key:
            self.session.headers.update({'Authorization': f'Bearer {self.api_key}'})

        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'WeSign-ReportAggregator/2.0'
        })

    def report_results(self, summary: ReportSummary) -> bool:
        """Report test results to QA Intelligence backend."""
        try:
            endpoint = f"{self.base_url}/api/v1/test-results"

            payload = {
                'run_id': summary.run_id,
                'environment': summary.environment,
                'timestamp': summary.end_time.isoformat(),
                'duration_seconds': summary.total_duration_seconds,
                'scores': {
                    'build': summary.build_score,
                    'smoke': summary.smoke_score,
                    'api': summary.api_score,
                    'e2e': summary.e2e_score,
                    'overall': summary.overall_score
                },
                'metrics': {name: asdict(metrics) for name, metrics in summary.metrics.items()},
                'artifact_count': len(summary.artifacts),
                'jenkins_build_number': summary.jenkins_build_number,
                'git_commit_hash': summary.git_commit_hash
            }

            response = self.session.post(endpoint, json=payload, timeout=30)
            response.raise_for_status()

            logger.info(f"Successfully reported results to QA Intelligence: {response.status_code}")
            return True

        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to report to QA Intelligence: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error reporting to QA Intelligence: {e}")
            return False


class ReportAggregator:
    """Main report aggregation engine."""

    # Scoring weights for overall score calculation
    SCORE_WEIGHTS = {
        'build': 0.20,    # 20% - Build compilation and basic checks
        'smoke': 0.20,    # 20% - Smoke tests and connectivity
        'api': 0.30,      # 30% - API functionality tests
        'e2e': 0.30       # 30% - End-to-end user scenarios
    }

    def __init__(self, workspace_dir: Path, config: Optional[Dict[str, Any]] = None):
        """Initialize report aggregator."""
        self.workspace_dir = Path(workspace_dir)
        self.config = config or {}
        self.artifacts: List[ArtifactInfo] = []
        self.metrics: Dict[str, TestMetrics] = {}

        # QA Intelligence integration
        qa_config = self.config.get('qa_intelligence', {})
        if qa_config.get('enabled', True):
            self.qa_reporter = QAIntelligenceReporter(
                base_url=qa_config.get('base_url', 'http://localhost:8082'),
                api_key=qa_config.get('api_key')
            )
        else:
            self.qa_reporter = None

    def collect_artifacts(self, patterns: Optional[List[str]] = None) -> List[ArtifactInfo]:
        """Collect all test artifacts from workspace."""
        if patterns is None:
            patterns = [
                '*.trx',
                '*newman*.html',
                '*playwright*.html',
                'playwright-report/**/*.html',
                '*.har',
                'screenshots/*.png',
                'videos/*.mp4',
                'test-results/**/*'
            ]

        logger.info(f"Collecting artifacts from {self.workspace_dir} with patterns: {patterns}")

        self.artifacts = ArtifactManager.scan_artifacts(self.workspace_dir, patterns)

        logger.info(f"Found {len(self.artifacts)} artifacts")
        for artifact in self.artifacts:
            logger.debug(f"  {artifact.type}: {artifact.name} ({artifact.size_bytes} bytes)")

        return self.artifacts

    def parse_reports(self) -> Dict[str, TestMetrics]:
        """Parse all collected report artifacts."""
        logger.info("Parsing collected reports...")

        for artifact in self.artifacts:
            try:
                if artifact.type == 'trx':
                    metrics = TRXParser.parse_trx_file(artifact.path)
                    self.metrics[f"trx_{artifact.name}"] = metrics

                elif artifact.type == 'newman-html':
                    metrics = NewmanHTMLParser.parse_newman_html(artifact.path)
                    self.metrics[f"newman_{artifact.name}"] = metrics

                elif artifact.type == 'playwright-html':
                    metrics = PlaywrightHTMLParser.parse_playwright_html(artifact.path)
                    self.metrics[f"playwright_{artifact.name}"] = metrics

            except Exception as e:
                logger.error(f"Failed to parse {artifact.path}: {e}")

        logger.info(f"Parsed {len(self.metrics)} reports")
        return self.metrics

    def calculate_scores(self) -> Dict[str, float]:
        """Calculate component and overall scores."""
        scores = {
            'build': 0.0,
            'smoke': 0.0,
            'api': 0.0,
            'e2e': 0.0,
            'overall': 0.0
        }

        # Build score - based on compilation success and basic validation
        build_metrics = [m for name, m in self.metrics.items() if 'build' in name.lower() or 'compile' in name.lower()]
        if build_metrics:
            scores['build'] = sum(m.success_rate for m in build_metrics) / len(build_metrics)
        elif any('trx' in name for name in self.metrics.keys()):
            # If we have TRX files, assume build succeeded
            scores['build'] = 100.0

        # Smoke score - based on connectivity and basic health checks
        smoke_metrics = [m for name, m in self.metrics.items() if 'smoke' in name.lower()]
        if smoke_metrics:
            scores['smoke'] = sum(m.success_rate for m in smoke_metrics) / len(smoke_metrics)

        # API score - based on Newman/API test results
        api_metrics = [m for name, m in self.metrics.items() if 'newman' in name.lower() or 'api' in name.lower()]
        if api_metrics:
            scores['api'] = sum(m.success_rate for m in api_metrics) / len(api_metrics)

        # E2E score - based on Playwright/UI test results
        e2e_metrics = [m for name, m in self.metrics.items() if 'playwright' in name.lower() or 'e2e' in name.lower()]
        if e2e_metrics:
            scores['e2e'] = sum(m.success_rate for m in e2e_metrics) / len(e2e_metrics)

        # Calculate overall weighted score
        overall_score = 0.0
        total_weight = 0.0

        for component, weight in self.SCORE_WEIGHTS.items():
            if scores[component] > 0:  # Only include components that have data
                overall_score += scores[component] * weight
                total_weight += weight

        if total_weight > 0:
            scores['overall'] = overall_score / total_weight

        # Apply penalties for missing components
        missing_components = sum(1 for score in [scores['build'], scores['smoke'], scores['api'], scores['e2e']] if score == 0)
        if missing_components > 0:
            penalty = missing_components * 10  # 10-point penalty per missing component
            scores['overall'] = max(0, scores['overall'] - penalty)

        logger.info(f"Calculated scores: {scores}")
        return scores

    def generate_summary(self, run_id: Optional[str] = None) -> ReportSummary:
        """Generate comprehensive report summary."""
        if run_id is None:
            run_id = f"run_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        # Calculate scores
        scores = self.calculate_scores()

        # Determine time range
        if self.artifacts:
            start_time = min(a.created_at for a in self.artifacts)
            end_time = max(a.created_at for a in self.artifacts)
        else:
            start_time = end_time = datetime.now()

        total_duration = (end_time - start_time).total_seconds()

        # Create summary
        summary = ReportSummary(
            run_id=run_id,
            environment=os.getenv('WESIGN_ENVIRONMENT', 'unknown'),
            start_time=start_time,
            end_time=end_time,
            total_duration_seconds=total_duration,
            build_score=scores['build'],
            smoke_score=scores['smoke'],
            api_score=scores['api'],
            e2e_score=scores['e2e'],
            overall_score=scores['overall'],
            metrics=self.metrics,
            artifacts=self.artifacts,
            jenkins_build_number=os.getenv('BUILD_NUMBER'),
            git_commit_hash=os.getenv('GIT_COMMIT')
        )

        logger.info(f"Generated summary for run {run_id} with overall score: {summary.overall_score:.1f}")
        return summary

    def export_summary(self, summary: ReportSummary, output_path: Path) -> bool:
        """Export summary to JSON file."""
        try:
            # Convert summary to serializable format
            export_data = {
                'run_id': summary.run_id,
                'environment': summary.environment,
                'start_time': summary.start_time.isoformat(),
                'end_time': summary.end_time.isoformat(),
                'total_duration_seconds': summary.total_duration_seconds,
                'scores': {
                    'build': summary.build_score,
                    'smoke': summary.smoke_score,
                    'api': summary.api_score,
                    'e2e': summary.e2e_score,
                    'overall': summary.overall_score,
                    'weights': self.SCORE_WEIGHTS
                },
                'metrics': {name: asdict(metrics) for name, metrics in summary.metrics.items()},
                'artifacts': [
                    {
                        **asdict(artifact),
                        'path': str(artifact.path),
                        'created_at': artifact.created_at.isoformat()
                    }
                    for artifact in summary.artifacts
                ],
                'integration': {
                    'qa_intelligence_reported': summary.qa_intelligence_reported,
                    'jenkins_build_number': summary.jenkins_build_number,
                    'git_commit_hash': summary.git_commit_hash
                },
                'generated_at': datetime.now().isoformat(),
                'version': '2.0'
            }

            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(export_data, f, indent=2, ensure_ascii=False)

            logger.info(f"Exported summary to {output_path}")
            return True

        except Exception as e:
            logger.error(f"Failed to export summary: {e}")
            return False

    def report_to_qa_intelligence(self, summary: ReportSummary) -> bool:
        """Report results to QA Intelligence backend."""
        if not self.qa_reporter:
            logger.info("QA Intelligence reporting disabled")
            return True

        success = self.qa_reporter.report_results(summary)
        summary.qa_intelligence_reported = success
        return success

    def archive_artifacts(self, summary: ReportSummary, archive_path: Path) -> bool:
        """Archive all artifacts into a ZIP file."""
        try:
            with zipfile.ZipFile(archive_path, 'w', zipfile.ZIP_DEFLATED) as archive:
                # Add summary JSON
                summary_json = json.dumps({
                    'run_id': summary.run_id,
                    'overall_score': summary.overall_score,
                    'generated_at': datetime.now().isoformat()
                }, indent=2)
                archive.writestr('summary.json', summary_json)

                # Add artifacts
                for artifact in summary.artifacts:
                    if artifact.path.exists():
                        # Use relative path in archive
                        relative_path = artifact.path.relative_to(self.workspace_dir)
                        archive.write(artifact.path, relative_path)

            logger.info(f"Archived {len(summary.artifacts)} artifacts to {archive_path}")
            return True

        except Exception as e:
            logger.error(f"Failed to create artifact archive: {e}")
            return False


def main():
    """Main entry point for the report aggregator."""
    parser = argparse.ArgumentParser(
        description='WeSign Report Aggregator - Unified test result processing',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  py report_aggregator.py --workspace ./test-results --output summary.json
  py report_aggregator.py --workspace ./build --run-id "CI-2024-001" --archive results.zip
  py report_aggregator.py --config aggregator.json --qa-intelligence --verbose
        """
    )

    parser.add_argument(
        '--workspace',
        type=str,
        default='.',
        help='Workspace directory containing test artifacts'
    )

    parser.add_argument(
        '--output',
        type=str,
        help='Output file for aggregated summary (JSON)'
    )

    parser.add_argument(
        '--run-id',
        type=str,
        help='Unique identifier for this test run'
    )

    parser.add_argument(
        '--config',
        type=str,
        help='Configuration file (JSON)'
    )

    parser.add_argument(
        '--patterns',
        nargs='+',
        help='Artifact file patterns to collect'
    )

    parser.add_argument(
        '--archive',
        type=str,
        help='Create ZIP archive of all artifacts'
    )

    parser.add_argument(
        '--qa-intelligence',
        action='store_true',
        help='Report results to QA Intelligence backend'
    )

    parser.add_argument(
        '--environment',
        type=str,
        help='Set test environment (overrides WESIGN_ENVIRONMENT)'
    )

    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Enable verbose logging'
    )

    args = parser.parse_args()

    # Configure logging
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # Set environment if specified
    if args.environment:
        os.environ['WESIGN_ENVIRONMENT'] = args.environment

    try:
        # Load configuration
        config = {}
        if args.config:
            with open(args.config, 'r', encoding='utf-8') as f:
                config = json.load(f)

        # Initialize aggregator
        aggregator = ReportAggregator(
            workspace_dir=Path(args.workspace),
            config=config
        )

        # Collect artifacts
        artifacts = aggregator.collect_artifacts(args.patterns)
        if not artifacts:
            logger.warning("No artifacts found to process")
            return 0

        # Parse reports
        metrics = aggregator.parse_reports()
        if not metrics:
            logger.warning("No parseable reports found")

        # Generate summary
        summary = aggregator.generate_summary(args.run_id)

        # Export summary
        if args.output:
            success = aggregator.export_summary(summary, Path(args.output))
            if not success:
                logger.error("Failed to export summary")
                return 1

        # Create archive
        if args.archive:
            success = aggregator.archive_artifacts(summary, Path(args.archive))
            if not success:
                logger.error("Failed to create artifact archive")
                return 1

        # Report to QA Intelligence
        if args.qa_intelligence:
            success = aggregator.report_to_qa_intelligence(summary)
            if not success:
                logger.warning("Failed to report to QA Intelligence (continuing)")

        # Print summary
        print(f"\nReport Aggregation Summary:")
        print(f"Run ID: {summary.run_id}")
        print(f"Environment: {summary.environment}")
        print(f"Duration: {summary.total_duration_seconds:.1f} seconds")
        print(f"Artifacts: {len(summary.artifacts)}")
        print(f"Reports Parsed: {len(summary.metrics)}")
        print(f"\nScores:")
        print(f"  Build:   {summary.build_score:.1f}/100")
        print(f"  Smoke:   {summary.smoke_score:.1f}/100")
        print(f"  API:     {summary.api_score:.1f}/100")
        print(f"  E2E:     {summary.e2e_score:.1f}/100")
        print(f"  Overall: {summary.overall_score:.1f}/100")

        # Return appropriate exit code based on overall score
        if summary.overall_score >= 80:
            logger.info("Report aggregation completed successfully with good scores")
            return 0
        elif summary.overall_score >= 60:
            logger.warning("Report aggregation completed with moderate scores")
            return 0
        else:
            logger.error("Report aggregation completed with poor scores")
            return 1

    except Exception as e:
        logger.error(f"Report aggregation failed: {str(e)}", exc_info=True)
        return 1


if __name__ == '__main__':
    exit_code = main()
    sys.exit(exit_code)