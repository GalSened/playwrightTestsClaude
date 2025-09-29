#!/usr/bin/env python3
"""
Jenkins Integration Client for WeSign CI/CD Pipeline
===================================================

Jenkins API wrapper for build management, artifact download and processing,
console log parsing, build status reporting and webhook integration.

Author: QA Intelligence System
Version: 2.0
Platform: Windows-compatible (py command ready)
"""

import argparse
import base64
import json
import logging
import os
import re
import sys
import time
import urllib.parse
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any, Union
import zipfile

try:
    import requests
    from requests.auth import HTTPBasicAuth
except ImportError:
    print("ERROR: requests library not installed. Run: pip install requests")
    sys.exit(1)

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('jenkins_helper.log', mode='a')
    ]
)
logger = logging.getLogger(__name__)


@dataclass
class BuildInfo:
    """Jenkins build information."""
    number: int
    url: str
    status: str  # 'SUCCESS', 'FAILURE', 'UNSTABLE', 'ABORTED', 'NOT_BUILT', 'BUILDING'
    result: Optional[str]
    timestamp: datetime
    duration_ms: int
    display_name: str
    description: Optional[str] = None
    node_name: Optional[str] = None
    cause: Optional[str] = None
    commit_hash: Optional[str] = None
    branch: Optional[str] = None


@dataclass
class ArtifactInfo:
    """Jenkins build artifact information."""
    display_path: str
    file_name: str
    relative_path: str
    size_bytes: int
    build_number: int
    download_url: str


@dataclass
class TestResults:
    """Jenkins test results summary."""
    total_count: int
    failed_count: int
    passed_count: int
    skipped_count: int
    success_rate: float
    duration_seconds: float


@dataclass
class ConsoleLogAnalysis:
    """Analysis of Jenkins console log."""
    total_lines: int
    error_count: int
    warning_count: int
    duration_analysis: Dict[str, float]
    key_events: List[Dict[str, Any]]
    performance_metrics: Dict[str, Any]


class JenkinsAPIError(Exception):
    """Custom exception for Jenkins API related errors."""
    pass


class JenkinsClient:
    """Jenkins API client with comprehensive functionality."""

    def __init__(self, base_url: str, username: str, api_token: str, verify_ssl: bool = True):
        """Initialize Jenkins client."""
        self.base_url = base_url.rstrip('/')
        self.username = username
        self.api_token = api_token
        self.verify_ssl = verify_ssl

        # Setup HTTP session
        self.session = requests.Session()
        self.session.auth = HTTPBasicAuth(username, api_token)
        self.session.verify = verify_ssl
        self.session.headers.update({
            'User-Agent': 'WeSign-JenkinsHelper/2.0',
            'Accept': 'application/json'
        })

        # Validate connection
        self._validate_connection()

    def _validate_connection(self) -> None:
        """Validate Jenkins connection and credentials."""
        try:
            response = self.session.get(f"{self.base_url}/api/json", timeout=10)
            if response.status_code == 401:
                raise JenkinsAPIError("Invalid credentials")
            elif response.status_code == 403:
                raise JenkinsAPIError("Insufficient permissions")
            elif not response.ok:
                raise JenkinsAPIError(f"Jenkins API error: {response.status_code}")

            data = response.json()
            logger.info(f"Connected to Jenkins: {data.get('description', 'Unknown')} v{data.get('version', 'Unknown')}")

        except requests.exceptions.RequestException as e:
            raise JenkinsAPIError(f"Failed to connect to Jenkins: {str(e)}")

    def get_job_info(self, job_name: str) -> Dict[str, Any]:
        """Get comprehensive job information."""
        try:
            encoded_job = urllib.parse.quote(job_name, safe='')
            response = self.session.get(f"{self.base_url}/job/{encoded_job}/api/json", timeout=30)
            response.raise_for_status()
            return response.json()

        except requests.exceptions.RequestException as e:
            raise JenkinsAPIError(f"Failed to get job info: {str(e)}")

    def get_build_info(self, job_name: str, build_number: Union[int, str]) -> BuildInfo:
        """Get detailed build information."""
        try:
            encoded_job = urllib.parse.quote(job_name, safe='')
            response = self.session.get(
                f"{self.base_url}/job/{encoded_job}/{build_number}/api/json",
                timeout=30
            )
            response.raise_for_status()
            data = response.json()

            # Parse build status and result
            building = data.get('building', False)
            result = data.get('result', 'BUILDING' if building else 'UNKNOWN')

            status = result if result else ('BUILDING' if building else 'UNKNOWN')

            # Parse timestamp
            timestamp = datetime.fromtimestamp(data.get('timestamp', 0) / 1000)

            # Extract cause information
            causes = data.get('actions', [])
            cause_info = None
            commit_hash = None
            branch = None

            for action in causes:
                if action and isinstance(action, dict):
                    # Look for cause information
                    if 'causes' in action:
                        cause_list = action.get('causes', [])
                        if cause_list and len(cause_list) > 0:
                            cause_info = cause_list[0].get('shortDescription', 'Unknown')

                    # Look for Git information
                    if 'lastBuiltRevision' in action:
                        revision = action.get('lastBuiltRevision', {})
                        if 'SHA1' in revision:
                            commit_hash = revision['SHA1'][:8]  # Short hash

                    if 'remoteUrls' in action and 'branch' in action:
                        branches = action.get('branch', [])
                        if branches and len(branches) > 0:
                            branch = branches[0].get('name', '').replace('origin/', '')

            return BuildInfo(
                number=int(data.get('number', 0)),
                url=data.get('url', ''),
                status=status,
                result=result,
                timestamp=timestamp,
                duration_ms=data.get('duration', 0),
                display_name=data.get('displayName', f"#{data.get('number', 0)}"),
                description=data.get('description'),
                node_name=data.get('builtOn'),
                cause=cause_info,
                commit_hash=commit_hash,
                branch=branch
            )

        except requests.exceptions.RequestException as e:
            raise JenkinsAPIError(f"Failed to get build info: {str(e)}")

    def get_build_artifacts(self, job_name: str, build_number: Union[int, str]) -> List[ArtifactInfo]:
        """Get list of build artifacts."""
        try:
            encoded_job = urllib.parse.quote(job_name, safe='')
            response = self.session.get(
                f"{self.base_url}/job/{encoded_job}/{build_number}/api/json",
                timeout=30
            )
            response.raise_for_status()
            data = response.json()

            artifacts = []
            for artifact_data in data.get('artifacts', []):
                artifact = ArtifactInfo(
                    display_path=artifact_data.get('displayPath', ''),
                    file_name=artifact_data.get('fileName', ''),
                    relative_path=artifact_data.get('relativePath', ''),
                    size_bytes=artifact_data.get('size', 0),
                    build_number=int(build_number),
                    download_url=f"{self.base_url}/job/{encoded_job}/{build_number}/artifact/{artifact_data.get('relativePath', '')}"
                )
                artifacts.append(artifact)

            logger.info(f"Found {len(artifacts)} artifacts for build {build_number}")
            return artifacts

        except requests.exceptions.RequestException as e:
            raise JenkinsAPIError(f"Failed to get build artifacts: {str(e)}")

    def download_artifact(self, artifact: ArtifactInfo, download_path: Path,
                         create_dirs: bool = True) -> bool:
        """Download a specific artifact."""
        try:
            if create_dirs:
                download_path.parent.mkdir(parents=True, exist_ok=True)

            logger.info(f"Downloading artifact: {artifact.file_name} to {download_path}")

            with self.session.get(artifact.download_url, stream=True, timeout=300) as response:
                response.raise_for_status()

                with open(download_path, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        f.write(chunk)

            # Verify download
            if download_path.exists() and download_path.stat().st_size > 0:
                logger.info(f"Successfully downloaded: {artifact.file_name} ({download_path.stat().st_size} bytes)")
                return True
            else:
                logger.error(f"Download verification failed: {artifact.file_name}")
                return False

        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to download artifact {artifact.file_name}: {str(e)}")
            return False
        except IOError as e:
            logger.error(f"File I/O error downloading {artifact.file_name}: {str(e)}")
            return False

    def download_all_artifacts(self, job_name: str, build_number: Union[int, str],
                              download_dir: Path) -> List[Path]:
        """Download all artifacts from a build."""
        artifacts = self.get_build_artifacts(job_name, build_number)
        downloaded_files = []

        download_dir.mkdir(parents=True, exist_ok=True)

        for artifact in artifacts:
            download_path = download_dir / artifact.file_name
            if self.download_artifact(artifact, download_path):
                downloaded_files.append(download_path)

        logger.info(f"Downloaded {len(downloaded_files)}/{len(artifacts)} artifacts to {download_dir}")
        return downloaded_files

    def get_console_log(self, job_name: str, build_number: Union[int, str]) -> str:
        """Get complete console log for a build."""
        try:
            encoded_job = urllib.parse.quote(job_name, safe='')
            response = self.session.get(
                f"{self.base_url}/job/{encoded_job}/{build_number}/consoleText",
                timeout=60
            )
            response.raise_for_status()
            return response.text

        except requests.exceptions.RequestException as e:
            raise JenkinsAPIError(f"Failed to get console log: {str(e)}")

    def analyze_console_log(self, console_log: str) -> ConsoleLogAnalysis:
        """Analyze console log for errors, warnings, and performance metrics."""
        lines = console_log.split('\n')
        total_lines = len(lines)

        # Count errors and warnings
        error_count = 0
        warning_count = 0
        key_events = []
        duration_analysis = {}

        # Patterns for different log types
        error_patterns = [
            r'(?i)\berror\b',
            r'(?i)\bfailed\b',
            r'(?i)\bexception\b',
            r'(?i)\bfatal\b',
            r'\[ERROR\]',
            r'ERROR:',
            r'✗',
            r'FAIL:'
        ]

        warning_patterns = [
            r'(?i)\bwarning\b',
            r'(?i)\bwarn\b',
            r'\[WARN\]',
            r'WARNING:',
            r'⚠',
            r'UNSTABLE'
        ]

        # Duration extraction patterns
        duration_patterns = {
            'total_build': r'Finished: \w+ in ([0-9.]+) (sec|min|hr)',
            'test_execution': r'Tests run: \d+.*Time elapsed: ([0-9.]+) sec',
            'compilation': r'Compilation time: ([0-9.]+) seconds?',
            'docker_build': r'Successfully built.*in ([0-9.]+)s'
        }

        # Performance metrics patterns
        performance_patterns = {
            'memory_usage': r'Memory usage: ([0-9.]+)MB',
            'cpu_usage': r'CPU usage: ([0-9.]+)%',
            'test_count': r'Tests run: (\d+)',
            'passed_tests': r'Tests run: \d+.*Failures: (\d+).*Errors: (\d+)'
        }

        for i, line in enumerate(lines):
            # Count errors
            for pattern in error_patterns:
                if re.search(pattern, line):
                    error_count += 1
                    key_events.append({
                        'line_number': i + 1,
                        'type': 'error',
                        'message': line.strip()[:200],  # Truncate long messages
                        'timestamp': self._extract_timestamp(line)
                    })
                    break

            # Count warnings
            for pattern in warning_patterns:
                if re.search(pattern, line):
                    warning_count += 1
                    key_events.append({
                        'line_number': i + 1,
                        'type': 'warning',
                        'message': line.strip()[:200],
                        'timestamp': self._extract_timestamp(line)
                    })
                    break

            # Extract duration information
            for metric_name, pattern in duration_patterns.items():
                match = re.search(pattern, line)
                if match:
                    duration_analysis[metric_name] = float(match.group(1))

            # Extract performance metrics
            for metric_name, pattern in performance_patterns.items():
                match = re.search(pattern, line)
                if match:
                    if metric_name not in duration_analysis:
                        duration_analysis[metric_name] = []
                    if metric_name == 'passed_tests':
                        failures = int(match.group(1))
                        errors = int(match.group(2))
                        duration_analysis[metric_name] = {'failures': failures, 'errors': errors}
                    else:
                        duration_analysis[metric_name] = float(match.group(1))

        # Calculate performance metrics
        performance_metrics = {
            'error_rate': (error_count / total_lines * 100) if total_lines > 0 else 0,
            'warning_rate': (warning_count / total_lines * 100) if total_lines > 0 else 0,
            'log_density': total_lines,
            'has_performance_data': bool(duration_analysis)
        }

        return ConsoleLogAnalysis(
            total_lines=total_lines,
            error_count=error_count,
            warning_count=warning_count,
            duration_analysis=duration_analysis,
            key_events=key_events[-50:],  # Keep last 50 events to avoid memory issues
            performance_metrics=performance_metrics
        )

    def _extract_timestamp(self, line: str) -> Optional[str]:
        """Extract timestamp from log line if present."""
        # Common timestamp patterns in Jenkins logs
        timestamp_patterns = [
            r'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})',
            r'(\d{2}:\d{2}:\d{2})',
            r'\[(\d{2}:\d{2}:\d{2})\]'
        ]

        for pattern in timestamp_patterns:
            match = re.search(pattern, line)
            if match:
                return match.group(1)

        return None

    def get_test_results(self, job_name: str, build_number: Union[int, str]) -> Optional[TestResults]:
        """Get test results summary from build."""
        try:
            encoded_job = urllib.parse.quote(job_name, safe='')
            response = self.session.get(
                f"{self.base_url}/job/{encoded_job}/{build_number}/testReport/api/json",
                timeout=30
            )

            if response.status_code == 404:
                logger.info("No test results available for this build")
                return None

            response.raise_for_status()
            data = response.json()

            return TestResults(
                total_count=data.get('totalCount', 0),
                failed_count=data.get('failCount', 0),
                passed_count=data.get('passCount', 0),
                skipped_count=data.get('skipCount', 0),
                success_rate=((data.get('passCount', 0) / data.get('totalCount', 1)) * 100) if data.get('totalCount', 0) > 0 else 0,
                duration_seconds=data.get('duration', 0.0)
            )

        except requests.exceptions.RequestException as e:
            logger.warning(f"Failed to get test results: {str(e)}")
            return None

    def trigger_build(self, job_name: str, parameters: Optional[Dict[str, str]] = None) -> Optional[int]:
        """Trigger a new build and return the build number."""
        try:
            encoded_job = urllib.parse.quote(job_name, safe='')

            if parameters:
                # Build with parameters
                response = self.session.post(
                    f"{self.base_url}/job/{encoded_job}/buildWithParameters",
                    data=parameters,
                    timeout=30
                )
            else:
                # Simple build
                response = self.session.post(
                    f"{self.base_url}/job/{encoded_job}/build",
                    timeout=30
                )

            if response.status_code == 201:
                # Extract build number from Location header
                location = response.headers.get('Location', '')
                if location:
                    # Location format: http://jenkins/queue/item/123/
                    match = re.search(r'/item/(\d+)/', location)
                    if match:
                        queue_id = int(match.group(1))
                        # Wait for build to start and get build number
                        return self._wait_for_build_start(queue_id)

            response.raise_for_status()
            logger.warning("Build triggered but no build number received")
            return None

        except requests.exceptions.RequestException as e:
            raise JenkinsAPIError(f"Failed to trigger build: {str(e)}")

    def _wait_for_build_start(self, queue_id: int, timeout_seconds: int = 300) -> Optional[int]:
        """Wait for a queued build to start and return build number."""
        start_time = time.time()

        while time.time() - start_time < timeout_seconds:
            try:
                response = self.session.get(f"{self.base_url}/queue/item/{queue_id}/api/json", timeout=10)

                if response.status_code == 404:
                    # Queue item might have been processed
                    logger.warning(f"Queue item {queue_id} not found")
                    return None

                response.raise_for_status()
                data = response.json()

                # Check if build has started
                if 'executable' in data:
                    executable = data.get('executable', {})
                    build_number = executable.get('number')
                    if build_number:
                        logger.info(f"Build started: #{build_number}")
                        return int(build_number)

                # Check if still in queue
                if data.get('blocked', False) or data.get('buildable', False):
                    logger.debug(f"Build still in queue (blocked: {data.get('blocked')}, buildable: {data.get('buildable')})")
                    time.sleep(5)
                    continue

                # Check for cancellation
                if data.get('cancelled', False):
                    logger.warning("Build was cancelled while in queue")
                    return None

                time.sleep(2)

            except requests.exceptions.RequestException as e:
                logger.warning(f"Error checking queue status: {str(e)}")
                time.sleep(5)

        logger.error(f"Timeout waiting for build to start (queue ID: {queue_id})")
        return None

    def wait_for_build_completion(self, job_name: str, build_number: int,
                                 timeout_seconds: int = 1800,
                                 check_interval: int = 30) -> BuildInfo:
        """Wait for build completion and return final build info."""
        start_time = time.time()

        while time.time() - start_time < timeout_seconds:
            try:
                build_info = self.get_build_info(job_name, build_number)

                if build_info.status != 'BUILDING':
                    logger.info(f"Build {build_number} completed with status: {build_info.status}")
                    return build_info

                logger.debug(f"Build {build_number} still running...")
                time.sleep(check_interval)

            except JenkinsAPIError as e:
                logger.warning(f"Error checking build status: {str(e)}")
                time.sleep(check_interval)

        raise JenkinsAPIError(f"Timeout waiting for build {build_number} to complete")

    def create_build_report(self, job_name: str, build_number: Union[int, str],
                           include_console_log: bool = True,
                           include_test_results: bool = True) -> Dict[str, Any]:
        """Create comprehensive build report."""
        try:
            # Get basic build info
            build_info = self.get_build_info(job_name, build_number)

            # Get artifacts
            artifacts = self.get_build_artifacts(job_name, build_number)

            # Get test results if available
            test_results = None
            if include_test_results:
                test_results = self.get_test_results(job_name, build_number)

            # Analyze console log if requested
            console_analysis = None
            if include_console_log:
                try:
                    console_log = self.get_console_log(job_name, build_number)
                    console_analysis = self.analyze_console_log(console_log)
                except JenkinsAPIError as e:
                    logger.warning(f"Failed to analyze console log: {str(e)}")

            # Compile comprehensive report
            report = {
                'build_info': asdict(build_info),
                'artifacts': [asdict(artifact) for artifact in artifacts],
                'test_results': asdict(test_results) if test_results else None,
                'console_analysis': asdict(console_analysis) if console_analysis else None,
                'generated_at': datetime.now().isoformat(),
                'job_name': job_name,
                'jenkins_url': self.base_url
            }

            logger.info(f"Generated build report for {job_name} #{build_number}")
            return report

        except JenkinsAPIError as e:
            logger.error(f"Failed to create build report: {str(e)}")
            raise

    def get_recent_builds(self, job_name: str, count: int = 10) -> List[BuildInfo]:
        """Get information for recent builds."""
        try:
            job_info = self.get_job_info(job_name)
            builds = job_info.get('builds', [])[:count]

            build_infos = []
            for build_data in builds:
                build_number = build_data.get('number')
                if build_number:
                    try:
                        build_info = self.get_build_info(job_name, build_number)
                        build_infos.append(build_info)
                    except JenkinsAPIError as e:
                        logger.warning(f"Failed to get info for build {build_number}: {str(e)}")

            logger.info(f"Retrieved info for {len(build_infos)} recent builds")
            return build_infos

        except JenkinsAPIError as e:
            raise JenkinsAPIError(f"Failed to get recent builds: {str(e)}")


class WebhookHandler:
    """Handle Jenkins webhook notifications."""

    @staticmethod
    def send_webhook(webhook_url: str, payload: Dict[str, Any],
                    headers: Optional[Dict[str, str]] = None) -> bool:
        """Send webhook notification."""
        try:
            default_headers = {'Content-Type': 'application/json'}
            if headers:
                default_headers.update(headers)

            response = requests.post(
                webhook_url,
                json=payload,
                headers=default_headers,
                timeout=30
            )
            response.raise_for_status()

            logger.info(f"Webhook sent successfully to {webhook_url}")
            return True

        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to send webhook: {str(e)}")
            return False

    @staticmethod
    def notify_build_status(webhook_url: str, build_info: BuildInfo,
                           job_name: str, additional_data: Optional[Dict[str, Any]] = None) -> bool:
        """Send build status notification via webhook."""
        payload = {
            'event_type': 'build_status',
            'job_name': job_name,
            'build_number': build_info.number,
            'status': build_info.status,
            'result': build_info.result,
            'duration_seconds': build_info.duration_ms / 1000,
            'timestamp': build_info.timestamp.isoformat(),
            'build_url': build_info.url,
            'commit_hash': build_info.commit_hash,
            'branch': build_info.branch
        }

        if additional_data:
            payload.update(additional_data)

        return WebhookHandler.send_webhook(webhook_url, payload)


def main():
    """Main entry point for Jenkins helper."""
    parser = argparse.ArgumentParser(
        description='Jenkins Helper - CI/CD build management and integration',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  py jenkins_helper.py --url http://jenkins:8080 --job "WeSign-Main" --build-number 42 --report
  py jenkins_helper.py --url http://jenkins:8080 --job "WeSign-Main" --download-artifacts ./artifacts
  py jenkins_helper.py --url http://jenkins:8080 --job "WeSign-Main" --trigger --wait --webhook http://qa.example.com/webhook
        """
    )

    parser.add_argument(
        '--url',
        type=str,
        required=True,
        help='Jenkins base URL'
    )

    parser.add_argument(
        '--username',
        type=str,
        help='Jenkins username (or use JENKINS_USERNAME env var)'
    )

    parser.add_argument(
        '--token',
        type=str,
        help='Jenkins API token (or use JENKINS_TOKEN env var)'
    )

    parser.add_argument(
        '--job',
        type=str,
        required=True,
        help='Jenkins job name'
    )

    parser.add_argument(
        '--build-number',
        type=str,
        help='Build number (use "lastBuild" for latest)'
    )

    parser.add_argument(
        '--report',
        action='store_true',
        help='Generate comprehensive build report'
    )

    parser.add_argument(
        '--download-artifacts',
        type=str,
        help='Download build artifacts to specified directory'
    )

    parser.add_argument(
        '--console-log',
        action='store_true',
        help='Analyze console log'
    )

    parser.add_argument(
        '--trigger',
        action='store_true',
        help='Trigger new build'
    )

    parser.add_argument(
        '--parameters',
        type=str,
        help='Build parameters as JSON string'
    )

    parser.add_argument(
        '--wait',
        action='store_true',
        help='Wait for build completion (use with --trigger)'
    )

    parser.add_argument(
        '--webhook',
        type=str,
        help='Webhook URL for status notifications'
    )

    parser.add_argument(
        '--output',
        type=str,
        help='Output file for reports and data (JSON format)'
    )

    parser.add_argument(
        '--recent-builds',
        type=int,
        help='Get info for N recent builds'
    )

    parser.add_argument(
        '--timeout',
        type=int,
        default=1800,
        help='Timeout for build operations in seconds'
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

    try:
        # Get credentials
        username = args.username or os.getenv('JENKINS_USERNAME')
        token = args.token or os.getenv('JENKINS_TOKEN')

        if not username or not token:
            logger.error("Jenkins credentials required. Use --username/--token or set JENKINS_USERNAME/JENKINS_TOKEN env vars")
            return 1

        # Initialize Jenkins client
        client = JenkinsClient(
            base_url=args.url,
            username=username,
            api_token=token,
            verify_ssl=not args.url.startswith('http://localhost')
        )

        # Handle different operations
        result_data = {}

        # Trigger build
        if args.trigger:
            logger.info(f"Triggering build for job: {args.job}")

            parameters = None
            if args.parameters:
                parameters = json.loads(args.parameters)

            build_number = client.trigger_build(args.job, parameters)
            if build_number:
                logger.info(f"Build triggered successfully: #{build_number}")
                result_data['triggered_build'] = build_number

                # Wait for completion if requested
                if args.wait:
                    logger.info("Waiting for build completion...")
                    build_info = client.wait_for_build_completion(
                        args.job,
                        build_number,
                        timeout_seconds=args.timeout
                    )
                    result_data['build_info'] = asdict(build_info)

                    # Send webhook notification
                    if args.webhook:
                        WebhookHandler.notify_build_status(
                            args.webhook,
                            build_info,
                            args.job,
                            {'triggered_by': 'jenkins_helper'}
                        )
            else:
                logger.error("Failed to trigger build")
                return 1

        # Use provided build number or get from trigger result
        build_number = args.build_number
        if not build_number and 'triggered_build' in result_data:
            build_number = result_data['triggered_build']
        elif not build_number:
            build_number = 'lastBuild'

        # Generate build report
        if args.report:
            logger.info(f"Generating build report for #{build_number}")
            report = client.create_build_report(
                args.job,
                build_number,
                include_console_log=True,
                include_test_results=True
            )
            result_data['build_report'] = report

        # Download artifacts
        if args.download_artifacts:
            logger.info(f"Downloading artifacts for build #{build_number}")
            download_dir = Path(args.download_artifacts)
            downloaded_files = client.download_all_artifacts(args.job, build_number, download_dir)
            result_data['downloaded_artifacts'] = [str(f) for f in downloaded_files]

        # Console log analysis
        if args.console_log:
            logger.info(f"Analyzing console log for build #{build_number}")
            console_log = client.get_console_log(args.job, build_number)
            analysis = client.analyze_console_log(console_log)
            result_data['console_analysis'] = asdict(analysis)

        # Recent builds
        if args.recent_builds:
            logger.info(f"Getting {args.recent_builds} recent builds")
            recent_builds = client.get_recent_builds(args.job, args.recent_builds)
            result_data['recent_builds'] = [asdict(build) for build in recent_builds]

        # Save output
        if args.output and result_data:
            with open(args.output, 'w', encoding='utf-8') as f:
                json.dump(result_data, f, indent=2, ensure_ascii=False)
            logger.info(f"Results saved to {args.output}")

        # Print summary
        if result_data:
            print(f"\nJenkins Helper Results:")
            if 'triggered_build' in result_data:
                print(f"Triggered Build: #{result_data['triggered_build']}")

            if 'build_info' in result_data:
                build_info = result_data['build_info']
                print(f"Build Status: {build_info['status']}")
                print(f"Duration: {build_info['duration_ms'] / 1000:.1f}s")

            if 'downloaded_artifacts' in result_data:
                print(f"Downloaded Artifacts: {len(result_data['downloaded_artifacts'])}")

            if 'console_analysis' in result_data:
                analysis = result_data['console_analysis']
                print(f"Console Log: {analysis['total_lines']} lines, {analysis['error_count']} errors, {analysis['warning_count']} warnings")

        return 0

    except JenkinsAPIError as e:
        logger.error(f"Jenkins API error: {str(e)}")
        return 1
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        return 1


if __name__ == '__main__':
    exit_code = main()
    sys.exit(exit_code)