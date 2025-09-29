#!/usr/bin/env python3
"""
Environment Validator for WeSign CI/CD Pipeline
===============================================

Network connectivity validation (ICMP, TCP), WinRM session testing,
disk space verification, service availability checks, and dependency validation.

Author: QA Intelligence System
Version: 2.0
Platform: Windows-compatible (py command ready)
"""

import argparse
import json
import logging
import os
import platform
import psutil
import re
import shutil
import socket
import subprocess
import sys
import time
import winreg
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any, Union
import urllib.parse

try:
    import requests
    import psutil
    import wmi
except ImportError:
    print("ERROR: Required libraries not installed. Run: pip install requests psutil WMI")
    sys.exit(1)

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('preflight_check.log', mode='a')
    ]
)
logger = logging.getLogger(__name__)


@dataclass
class ValidationResult:
    """Structured validation result."""
    check_name: str
    category: str
    status: str  # 'PASS', 'FAIL', 'WARN', 'SKIP'
    duration_ms: float
    message: str
    details: Optional[Dict[str, Any]] = None
    remediation: Optional[str] = None
    timestamp: Optional[str] = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now().isoformat()


@dataclass
class SystemInfo:
    """System information summary."""
    hostname: str
    os_name: str
    os_version: str
    architecture: str
    cpu_count: int
    total_memory_gb: float
    available_memory_gb: float
    disk_usage: Dict[str, Dict[str, float]]
    network_interfaces: List[Dict[str, Any]]
    python_version: str
    user_account: str


@dataclass
class NetworkEndpoint:
    """Network endpoint configuration for testing."""
    name: str
    host: str
    port: int
    protocol: str = 'tcp'
    timeout_seconds: int = 5
    expected_response: Optional[str] = None


@dataclass
class ServiceDependency:
    """Service dependency configuration."""
    name: str
    service_name: str
    display_name: Optional[str] = None
    required_status: str = 'running'
    startup_type: Optional[str] = None


@dataclass
class SoftwareDependency:
    """Software dependency configuration."""
    name: str
    executable: str
    version_arg: str = '--version'
    version_pattern: Optional[str] = None
    minimum_version: Optional[str] = None
    installation_url: Optional[str] = None


class SystemInfoCollector:
    """Collect comprehensive system information."""

    @staticmethod
    def collect_system_info() -> SystemInfo:
        """Collect comprehensive system information."""
        try:
            # Basic system info
            hostname = socket.gethostname()
            os_name = platform.system()
            os_version = platform.version()
            architecture = platform.architecture()[0]
            cpu_count = psutil.cpu_count()

            # Memory info
            memory = psutil.virtual_memory()
            total_memory_gb = memory.total / (1024 ** 3)
            available_memory_gb = memory.available / (1024 ** 3)

            # Disk usage
            disk_usage = {}
            for partition in psutil.disk_partitions():
                try:
                    usage = psutil.disk_usage(partition.mountpoint)
                    disk_usage[partition.device] = {
                        'total_gb': usage.total / (1024 ** 3),
                        'used_gb': usage.used / (1024 ** 3),
                        'free_gb': usage.free / (1024 ** 3),
                        'percent_used': (usage.used / usage.total) * 100
                    }
                except PermissionError:
                    # Skip inaccessible drives
                    continue

            # Network interfaces
            network_interfaces = []
            for interface_name, addresses in psutil.net_if_addrs().items():
                interface_info = {'name': interface_name, 'addresses': []}
                for addr in addresses:
                    interface_info['addresses'].append({
                        'family': str(addr.family),
                        'address': addr.address,
                        'netmask': addr.netmask,
                        'broadcast': addr.broadcast
                    })
                network_interfaces.append(interface_info)

            # Python and user info
            python_version = platform.python_version()
            user_account = os.getenv('USERNAME', os.getenv('USER', 'unknown'))

            return SystemInfo(
                hostname=hostname,
                os_name=os_name,
                os_version=os_version,
                architecture=architecture,
                cpu_count=cpu_count,
                total_memory_gb=total_memory_gb,
                available_memory_gb=available_memory_gb,
                disk_usage=disk_usage,
                network_interfaces=network_interfaces,
                python_version=python_version,
                user_account=user_account
            )

        except Exception as e:
            logger.error(f"Failed to collect system info: {e}")
            # Return minimal info
            return SystemInfo(
                hostname=socket.gethostname(),
                os_name=platform.system(),
                os_version=platform.version(),
                architecture=platform.architecture()[0],
                cpu_count=1,
                total_memory_gb=0.0,
                available_memory_gb=0.0,
                disk_usage={},
                network_interfaces=[],
                python_version=platform.python_version(),
                user_account=os.getenv('USERNAME', 'unknown')
            )


class NetworkValidator:
    """Network connectivity validation."""

    @staticmethod
    def test_icmp_connectivity(endpoint: NetworkEndpoint) -> ValidationResult:
        """Test ICMP ping connectivity."""
        start_time = time.time()

        try:
            # Use Windows ping command
            cmd = ['ping', '-n', '1', '-w', str(endpoint.timeout_seconds * 1000), endpoint.host]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=endpoint.timeout_seconds + 2)

            duration_ms = (time.time() - start_time) * 1000

            if result.returncode == 0:
                # Extract response time
                output = result.stdout
                time_match = re.search(r'time[<>=]+(\d+)ms', output)
                response_time = time_match.group(1) if time_match else 'unknown'

                return ValidationResult(
                    check_name=f"icmp_ping_{endpoint.name}",
                    category='network',
                    status='PASS',
                    duration_ms=duration_ms,
                    message=f"Ping to {endpoint.host} successful (response time: {response_time}ms)",
                    details={
                        'host': endpoint.host,
                        'response_time_ms': response_time,
                        'protocol': 'ICMP'
                    }
                )
            else:
                return ValidationResult(
                    check_name=f"icmp_ping_{endpoint.name}",
                    category='network',
                    status='FAIL',
                    duration_ms=duration_ms,
                    message=f"Ping to {endpoint.host} failed",
                    details={'host': endpoint.host, 'stderr': result.stderr},
                    remediation=f"Check network connectivity and firewall rules for {endpoint.host}"
                )

        except subprocess.TimeoutExpired:
            duration_ms = (time.time() - start_time) * 1000
            return ValidationResult(
                check_name=f"icmp_ping_{endpoint.name}",
                category='network',
                status='FAIL',
                duration_ms=duration_ms,
                message=f"Ping to {endpoint.host} timed out after {endpoint.timeout_seconds}s",
                details={'host': endpoint.host, 'timeout_seconds': endpoint.timeout_seconds},
                remediation=f"Check if {endpoint.host} is reachable and not blocking ICMP"
            )

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            return ValidationResult(
                check_name=f"icmp_ping_{endpoint.name}",
                category='network',
                status='FAIL',
                duration_ms=duration_ms,
                message=f"Ping test failed: {str(e)}",
                details={'error_type': type(e).__name__, 'host': endpoint.host}
            )

    @staticmethod
    def test_tcp_connectivity(endpoint: NetworkEndpoint) -> ValidationResult:
        """Test TCP port connectivity."""
        start_time = time.time()

        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(endpoint.timeout_seconds)
            result = sock.connect_ex((endpoint.host, endpoint.port))
            sock.close()

            duration_ms = (time.time() - start_time) * 1000

            if result == 0:
                return ValidationResult(
                    check_name=f"tcp_connection_{endpoint.name}",
                    category='network',
                    status='PASS',
                    duration_ms=duration_ms,
                    message=f"TCP connection to {endpoint.host}:{endpoint.port} successful",
                    details={'endpoint': f"{endpoint.host}:{endpoint.port}", 'protocol': 'TCP'}
                )
            else:
                return ValidationResult(
                    check_name=f"tcp_connection_{endpoint.name}",
                    category='network',
                    status='FAIL',
                    duration_ms=duration_ms,
                    message=f"TCP connection to {endpoint.host}:{endpoint.port} failed (error code: {result})",
                    details={'endpoint': f"{endpoint.host}:{endpoint.port}", 'error_code': result},
                    remediation=f"Check if service is running on {endpoint.host}:{endpoint.port} and firewall allows connections"
                )

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            return ValidationResult(
                check_name=f"tcp_connection_{endpoint.name}",
                category='network',
                status='FAIL',
                duration_ms=duration_ms,
                message=f"TCP connection test failed: {str(e)}",
                details={'error_type': type(e).__name__, 'endpoint': f"{endpoint.host}:{endpoint.port}"},
                remediation="Check network connectivity and DNS resolution"
            )

    @staticmethod
    def test_http_connectivity(endpoint: NetworkEndpoint) -> ValidationResult:
        """Test HTTP/HTTPS connectivity."""
        start_time = time.time()

        try:
            # Construct URL
            protocol = 'https' if endpoint.port == 443 else 'http'
            port_suffix = f":{endpoint.port}" if (endpoint.port != 80 and endpoint.port != 443) else ""
            url = f"{protocol}://{endpoint.host}{port_suffix}/"

            response = requests.get(url, timeout=endpoint.timeout_seconds, verify=False)
            duration_ms = (time.time() - start_time) * 1000

            status = 'PASS' if response.status_code < 400 else 'WARN'
            message = f"HTTP connection to {url} returned status {response.status_code}"

            return ValidationResult(
                check_name=f"http_connection_{endpoint.name}",
                category='network',
                status=status,
                duration_ms=duration_ms,
                message=message,
                details={
                    'url': url,
                    'status_code': response.status_code,
                    'response_size': len(response.content),
                    'content_type': response.headers.get('content-type', ''),
                    'server': response.headers.get('server', '')
                }
            )

        except requests.exceptions.RequestException as e:
            duration_ms = (time.time() - start_time) * 1000
            return ValidationResult(
                check_name=f"http_connection_{endpoint.name}",
                category='network',
                status='FAIL',
                duration_ms=duration_ms,
                message=f"HTTP connection failed: {str(e)}",
                details={'error_type': type(e).__name__},
                remediation="Check if web server is running and accessible"
            )


class WinRMValidator:
    """Windows Remote Management session testing."""

    @staticmethod
    def test_winrm_session(host: str, username: str, password: str, timeout_seconds: int = 30) -> ValidationResult:
        """Test WinRM session connectivity."""
        start_time = time.time()

        try:
            # Use winrs command to test WinRM
            cmd = [
                'winrs',
                '-r',
                host,
                '-u',
                username,
                '-p',
                password,
                '-t',
                str(timeout_seconds),
                'echo WinRM test successful'
            ]

            result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout_seconds + 5)
            duration_ms = (time.time() - start_time) * 1000

            if result.returncode == 0 and 'WinRM test successful' in result.stdout:
                return ValidationResult(
                    check_name=f"winrm_session_{host.replace('.', '_')}",
                    category='remote',
                    status='PASS',
                    duration_ms=duration_ms,
                    message=f"WinRM session to {host} successful",
                    details={'host': host, 'username': username}
                )
            else:
                return ValidationResult(
                    check_name=f"winrm_session_{host.replace('.', '_')}",
                    category='remote',
                    status='FAIL',
                    duration_ms=duration_ms,
                    message=f"WinRM session to {host} failed",
                    details={'host': host, 'stderr': result.stderr, 'stdout': result.stdout},
                    remediation="Check WinRM service is enabled, credentials are correct, and firewall allows WinRM"
                )

        except subprocess.TimeoutExpired:
            duration_ms = (time.time() - start_time) * 1000
            return ValidationResult(
                check_name=f"winrm_session_{host.replace('.', '_')}",
                category='remote',
                status='FAIL',
                duration_ms=duration_ms,
                message=f"WinRM session to {host} timed out",
                details={'host': host, 'timeout_seconds': timeout_seconds},
                remediation="Check network connectivity and WinRM service configuration"
            )

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            return ValidationResult(
                check_name=f"winrm_session_{host.replace('.', '_')}",
                category='remote',
                status='FAIL',
                duration_ms=duration_ms,
                message=f"WinRM test failed: {str(e)}",
                details={'error_type': type(e).__name__, 'host': host}
            )


class DiskSpaceValidator:
    """Disk space verification."""

    @staticmethod
    def check_disk_space(drives: Optional[List[str]] = None,
                        minimum_free_gb: float = 5.0,
                        minimum_free_percent: float = 10.0) -> List[ValidationResult]:
        """Check disk space on specified drives."""
        results = []

        if drives is None:
            # Check all available drives
            drives = [partition.device for partition in psutil.disk_partitions()]

        for drive in drives:
            try:
                start_time = time.time()
                usage = psutil.disk_usage(drive)
                duration_ms = (time.time() - start_time) * 1000

                free_gb = usage.free / (1024 ** 3)
                free_percent = (usage.free / usage.total) * 100
                used_percent = (usage.used / usage.total) * 100

                status = 'PASS'
                message = f"Disk space check passed for {drive}: {free_gb:.1f}GB ({free_percent:.1f}%) free"
                remediation = None

                if free_gb < minimum_free_gb or free_percent < minimum_free_percent:
                    status = 'WARN' if free_percent > 5.0 else 'FAIL'
                    message = f"Low disk space on {drive}: {free_gb:.1f}GB ({free_percent:.1f}%) free"
                    remediation = f"Free up disk space on {drive}. Consider removing temporary files or old logs."

                results.append(ValidationResult(
                    check_name=f"disk_space_{drive.replace(':', '').replace('\\', '')}",
                    category='storage',
                    status=status,
                    duration_ms=duration_ms,
                    message=message,
                    details={
                        'drive': drive,
                        'total_gb': usage.total / (1024 ** 3),
                        'used_gb': usage.used / (1024 ** 3),
                        'free_gb': free_gb,
                        'used_percent': used_percent,
                        'free_percent': free_percent,
                        'minimum_free_gb': minimum_free_gb,
                        'minimum_free_percent': minimum_free_percent
                    },
                    remediation=remediation
                ))

            except Exception as e:
                results.append(ValidationResult(
                    check_name=f"disk_space_{drive.replace(':', '').replace('\\', '')}",
                    category='storage',
                    status='FAIL',
                    duration_ms=0,
                    message=f"Failed to check disk space for {drive}: {str(e)}",
                    details={'drive': drive, 'error_type': type(e).__name__}
                ))

        return results


class ServiceValidator:
    """Windows service availability validation."""

    @staticmethod
    def check_service_status(dependency: ServiceDependency) -> ValidationResult:
        """Check Windows service status."""
        start_time = time.time()

        try:
            # Use WMI to check service status
            wmi_conn = wmi.WMI()
            services = wmi_conn.Win32_Service(Name=dependency.service_name)

            duration_ms = (time.time() - start_time) * 1000

            if not services:
                return ValidationResult(
                    check_name=f"service_{dependency.name}",
                    category='service',
                    status='FAIL',
                    duration_ms=duration_ms,
                    message=f"Service '{dependency.service_name}' not found",
                    details={'service_name': dependency.service_name},
                    remediation=f"Install or verify service name: {dependency.service_name}"
                )

            service = services[0]
            state = service.State.lower()
            status = service.Status
            startup_type = service.StartMode

            expected_state = dependency.required_status.lower()
            service_status = 'PASS' if state == expected_state else 'FAIL'

            message = f"Service '{dependency.service_name}' is {state} (expected: {expected_state})"
            remediation = None

            if service_status == 'FAIL':
                if state == 'stopped' and expected_state == 'running':
                    remediation = f"Start the service: sc start {dependency.service_name}"
                elif state == 'running' and expected_state == 'stopped':
                    remediation = f"Stop the service: sc stop {dependency.service_name}"

            return ValidationResult(
                check_name=f"service_{dependency.name}",
                category='service',
                status=service_status,
                duration_ms=duration_ms,
                message=message,
                details={
                    'service_name': dependency.service_name,
                    'display_name': service.DisplayName,
                    'state': state,
                    'status': status,
                    'startup_type': startup_type,
                    'expected_state': expected_state
                },
                remediation=remediation
            )

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            return ValidationResult(
                check_name=f"service_{dependency.name}",
                category='service',
                status='FAIL',
                duration_ms=duration_ms,
                message=f"Failed to check service status: {str(e)}",
                details={'service_name': dependency.service_name, 'error_type': type(e).__name__},
                remediation="Check if WMI service is available and permissions are sufficient"
            )


class SoftwareValidator:
    """Software dependency validation."""

    @staticmethod
    def check_software_availability(dependency: SoftwareDependency) -> ValidationResult:
        """Check if software is available and meets version requirements."""
        start_time = time.time()

        try:
            # Check if executable exists in PATH
            if not shutil.which(dependency.executable):
                duration_ms = (time.time() - start_time) * 1000
                return ValidationResult(
                    check_name=f"software_{dependency.name}",
                    category='software',
                    status='FAIL',
                    duration_ms=duration_ms,
                    message=f"Software '{dependency.executable}' not found in PATH",
                    details={'executable': dependency.executable},
                    remediation=f"Install {dependency.name} or add to PATH. {dependency.installation_url or ''}"
                )

            # Get version information
            cmd = [dependency.executable, dependency.version_arg]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)

            duration_ms = (time.time() - start_time) * 1000

            if result.returncode != 0:
                return ValidationResult(
                    check_name=f"software_{dependency.name}",
                    category='software',
                    status='WARN',
                    duration_ms=duration_ms,
                    message=f"Could not determine version of {dependency.name}",
                    details={'executable': dependency.executable, 'stderr': result.stderr}
                )

            # Extract version using pattern or default
            version_output = result.stdout + result.stderr
            version = None

            if dependency.version_pattern:
                version_match = re.search(dependency.version_pattern, version_output)
                if version_match:
                    version = version_match.group(1)
            else:
                # Try common version patterns
                common_patterns = [
                    r'v?(\d+\.\d+\.\d+)',
                    r'version\s+(\d+\.\d+\.\d+)',
                    r'(\d+\.\d+)',
                ]
                for pattern in common_patterns:
                    version_match = re.search(pattern, version_output, re.IGNORECASE)
                    if version_match:
                        version = version_match.group(1)
                        break

            # Version comparison
            status = 'PASS'
            message = f"{dependency.name} is available"
            if version:
                message += f" (version: {version})"

                if dependency.minimum_version:
                    if SoftwareValidator._compare_versions(version, dependency.minimum_version) < 0:
                        status = 'WARN'
                        message += f" - version {dependency.minimum_version}+ recommended"

            return ValidationResult(
                check_name=f"software_{dependency.name}",
                category='software',
                status=status,
                duration_ms=duration_ms,
                message=message,
                details={
                    'executable': dependency.executable,
                    'version': version,
                    'minimum_version': dependency.minimum_version,
                    'version_output': version_output[:500]  # Truncate long output
                }
            )

        except subprocess.TimeoutExpired:
            duration_ms = (time.time() - start_time) * 1000
            return ValidationResult(
                check_name=f"software_{dependency.name}",
                category='software',
                status='WARN',
                duration_ms=duration_ms,
                message=f"Version check for {dependency.name} timed out",
                details={'executable': dependency.executable}
            )

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            return ValidationResult(
                check_name=f"software_{dependency.name}",
                category='software',
                status='FAIL',
                duration_ms=duration_ms,
                message=f"Failed to check {dependency.name}: {str(e)}",
                details={'executable': dependency.executable, 'error_type': type(e).__name__}
            )

    @staticmethod
    def _compare_versions(version1: str, version2: str) -> int:
        """Compare two version strings. Returns -1, 0, or 1."""
        try:
            def version_tuple(v):
                return tuple(map(int, v.split('.')))

            v1 = version_tuple(version1)
            v2 = version_tuple(version2)

            return (v1 > v2) - (v1 < v2)
        except ValueError:
            # Fallback to string comparison if numeric conversion fails
            return (version1 > version2) - (version1 < version2)


class EnvironmentValidator:
    """Main environment validation orchestrator."""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """Initialize environment validator."""
        self.config = config or self._get_default_config()
        self.results: List[ValidationResult] = []
        self.system_info: Optional[SystemInfo] = None

    def _get_default_config(self) -> Dict[str, Any]:
        """Get default validation configuration for WeSign environment."""
        return {
            'network_endpoints': [
                {
                    'name': 'wesign_devtest',
                    'host': 'devtest.comda.co.il',
                    'port': 443,
                    'protocol': 'https'
                },
                {
                    'name': 'local_backend',
                    'host': 'localhost',
                    'port': 8082,
                    'protocol': 'tcp'
                },
                {
                    'name': 'local_frontend',
                    'host': 'localhost',
                    'port': 3001,
                    'protocol': 'tcp'
                }
            ],
            'services': [
                {
                    'name': 'iis',
                    'service_name': 'W3SVC',
                    'display_name': 'World Wide Web Publishing Service',
                    'required_status': 'running'
                },
                {
                    'name': 'winrm',
                    'service_name': 'WinRM',
                    'display_name': 'Windows Remote Management',
                    'required_status': 'running'
                }
            ],
            'software_dependencies': [
                {
                    'name': 'node',
                    'executable': 'node',
                    'version_arg': '--version',
                    'version_pattern': r'v(\d+\.\d+\.\d+)',
                    'minimum_version': '18.0.0',
                    'installation_url': 'https://nodejs.org/'
                },
                {
                    'name': 'npm',
                    'executable': 'npm',
                    'version_arg': '--version',
                    'minimum_version': '8.0.0'
                },
                {
                    'name': 'python',
                    'executable': 'python',
                    'version_arg': '--version',
                    'version_pattern': r'Python (\d+\.\d+\.\d+)',
                    'minimum_version': '3.8.0'
                },
                {
                    'name': 'git',
                    'executable': 'git',
                    'version_arg': '--version',
                    'version_pattern': r'git version (\d+\.\d+\.\d+)',
                    'minimum_version': '2.30.0'
                },
                {
                    'name': 'dotnet',
                    'executable': 'dotnet',
                    'version_arg': '--version',
                    'minimum_version': '6.0.0'
                }
            ],
            'disk_requirements': {
                'minimum_free_gb': 10.0,
                'minimum_free_percent': 15.0,
                'drives': ['C:\\']
            },
            'winrm_tests': [],  # Add WinRM test configurations as needed
            'performance_thresholds': {
                'max_network_latency_ms': 1000,
                'max_disk_check_ms': 5000
            }
        }

    def collect_system_info(self) -> SystemInfo:
        """Collect system information."""
        logger.info("Collecting system information...")
        self.system_info = SystemInfoCollector.collect_system_info()
        return self.system_info

    def validate_network_connectivity(self) -> List[ValidationResult]:
        """Validate network connectivity to required endpoints."""
        logger.info("Validating network connectivity...")
        results = []

        for endpoint_config in self.config.get('network_endpoints', []):
            endpoint = NetworkEndpoint(**endpoint_config)

            # Test based on protocol
            if endpoint.protocol.lower() in ['tcp', 'http', 'https']:
                result = NetworkValidator.test_tcp_connectivity(endpoint)
                results.append(result)

                # Additional HTTP test for web endpoints
                if endpoint.protocol.lower() in ['http', 'https']:
                    http_result = NetworkValidator.test_http_connectivity(endpoint)
                    results.append(http_result)

            elif endpoint.protocol.lower() == 'icmp':
                result = NetworkValidator.test_icmp_connectivity(endpoint)
                results.append(result)

        self.results.extend(results)
        return results

    def validate_disk_space(self) -> List[ValidationResult]:
        """Validate disk space requirements."""
        logger.info("Validating disk space...")

        disk_config = self.config.get('disk_requirements', {})
        results = DiskSpaceValidator.check_disk_space(
            drives=disk_config.get('drives'),
            minimum_free_gb=disk_config.get('minimum_free_gb', 5.0),
            minimum_free_percent=disk_config.get('minimum_free_percent', 10.0)
        )

        self.results.extend(results)
        return results

    def validate_services(self) -> List[ValidationResult]:
        """Validate Windows service dependencies."""
        logger.info("Validating Windows services...")
        results = []

        for service_config in self.config.get('services', []):
            dependency = ServiceDependency(**service_config)
            result = ServiceValidator.check_service_status(dependency)
            results.append(result)

        self.results.extend(results)
        return results

    def validate_software_dependencies(self) -> List[ValidationResult]:
        """Validate software dependencies."""
        logger.info("Validating software dependencies...")
        results = []

        for software_config in self.config.get('software_dependencies', []):
            dependency = SoftwareDependency(**software_config)
            result = SoftwareValidator.check_software_availability(dependency)
            results.append(result)

        self.results.extend(results)
        return results

    def validate_winrm_sessions(self) -> List[ValidationResult]:
        """Validate WinRM session connectivity."""
        logger.info("Validating WinRM sessions...")
        results = []

        for winrm_config in self.config.get('winrm_tests', []):
            result = WinRMValidator.test_winrm_session(
                host=winrm_config['host'],
                username=winrm_config['username'],
                password=winrm_config['password'],
                timeout_seconds=winrm_config.get('timeout_seconds', 30)
            )
            results.append(result)

        self.results.extend(results)
        return results

    def run_all_validations(self) -> Dict[str, Any]:
        """Run all environment validations."""
        logger.info("Starting comprehensive environment validation...")
        start_time = datetime.now()

        # Collect system info
        system_info = self.collect_system_info()

        # Run all validation categories
        network_results = self.validate_network_connectivity()
        disk_results = self.validate_disk_space()
        service_results = self.validate_services()
        software_results = self.validate_software_dependencies()
        winrm_results = self.validate_winrm_sessions()

        end_time = datetime.now()
        total_duration = (end_time - start_time).total_seconds()

        # Calculate summary statistics
        total_checks = len(self.results)
        passed_checks = sum(1 for r in self.results if r.status == 'PASS')
        failed_checks = sum(1 for r in self.results if r.status == 'FAIL')
        warning_checks = sum(1 for r in self.results if r.status == 'WARN')
        skipped_checks = sum(1 for r in self.results if r.status == 'SKIP')

        success_rate = (passed_checks / total_checks * 100) if total_checks > 0 else 0
        overall_status = 'PASS' if failed_checks == 0 else ('WARN' if warning_checks > 0 else 'FAIL')

        # Generate comprehensive report
        report = {
            'summary': {
                'total_checks': total_checks,
                'passed': passed_checks,
                'failed': failed_checks,
                'warnings': warning_checks,
                'skipped': skipped_checks,
                'success_rate_percent': round(success_rate, 2),
                'overall_status': overall_status
            },
            'execution_info': {
                'start_time': start_time.isoformat(),
                'end_time': end_time.isoformat(),
                'duration_seconds': total_duration,
                'environment': os.getenv('WESIGN_ENVIRONMENT', 'unknown')
            },
            'system_info': asdict(system_info),
            'validation_results': {
                'network': [asdict(r) for r in network_results],
                'disk': [asdict(r) for r in disk_results],
                'services': [asdict(r) for r in service_results],
                'software': [asdict(r) for r in software_results],
                'winrm': [asdict(r) for r in winrm_results]
            },
            'configuration': self.config
        }

        logger.info(f"Environment validation completed in {total_duration:.2f} seconds")
        logger.info(f"Results: {passed_checks} passed, {failed_checks} failed, {warning_checks} warnings, {skipped_checks} skipped")

        return report


def main():
    """Main entry point for environment validator."""
    parser = argparse.ArgumentParser(
        description='WeSign Environment Validator - Pre-deployment environment verification',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  py preflight_check.py --config validation.json --output results.json
  py preflight_check.py --network-only --verbose
  py preflight_check.py --services-only --disk-only --software-only
        """
    )

    parser.add_argument(
        '--config',
        type=str,
        help='Path to validation configuration file (JSON)'
    )

    parser.add_argument(
        '--output',
        type=str,
        help='Output file for validation results (JSON format)'
    )

    parser.add_argument(
        '--network-only',
        action='store_true',
        help='Run only network connectivity tests'
    )

    parser.add_argument(
        '--disk-only',
        action='store_true',
        help='Run only disk space validation'
    )

    parser.add_argument(
        '--services-only',
        action='store_true',
        help='Run only service availability checks'
    )

    parser.add_argument(
        '--software-only',
        action='store_true',
        help='Run only software dependency validation'
    )

    parser.add_argument(
        '--winrm-only',
        action='store_true',
        help='Run only WinRM session tests'
    )

    parser.add_argument(
        '--system-info',
        action='store_true',
        help='Collect and display system information only'
    )

    parser.add_argument(
        '--environment',
        type=str,
        help='Set target environment (overrides WESIGN_ENVIRONMENT)'
    )

    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Enable verbose logging'
    )

    parser.add_argument(
        '--fail-fast',
        action='store_true',
        help='Stop on first validation failure'
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
        config = None
        if args.config:
            with open(args.config, 'r', encoding='utf-8') as f:
                config = json.load(f)

        # Initialize validator
        validator = EnvironmentValidator(config=config)

        # System info only mode
        if args.system_info:
            system_info = validator.collect_system_info()
            print(f"\nSystem Information:")
            print(f"Hostname: {system_info.hostname}")
            print(f"OS: {system_info.os_name} {system_info.os_version}")
            print(f"Architecture: {system_info.architecture}")
            print(f"CPU Cores: {system_info.cpu_count}")
            print(f"Memory: {system_info.total_memory_gb:.1f}GB total, {system_info.available_memory_gb:.1f}GB available")
            print(f"Python: {system_info.python_version}")
            print(f"User: {system_info.user_account}")

            if args.output:
                with open(args.output, 'w', encoding='utf-8') as f:
                    json.dump(asdict(system_info), f, indent=2, ensure_ascii=False)

            return 0

        # Run specific validation categories or all validations
        if any([args.network_only, args.disk_only, args.services_only, args.software_only, args.winrm_only]):
            validator.collect_system_info()

            if args.network_only:
                validator.validate_network_connectivity()
            if args.disk_only:
                validator.validate_disk_space()
            if args.services_only:
                validator.validate_services()
            if args.software_only:
                validator.validate_software_dependencies()
            if args.winrm_only:
                validator.validate_winrm_sessions()

            # Create partial report
            results = {
                'results': [asdict(r) for r in validator.results],
                'system_info': asdict(validator.system_info)
            }
        else:
            # Run all validations
            results = validator.run_all_validations()

        # Handle fail-fast mode
        if args.fail_fast and results.get('summary', {}).get('failed', 0) > 0:
            logger.error("Fail-fast mode: stopping due to validation failures")
            return 1

        # Output results
        if args.output:
            with open(args.output, 'w', encoding='utf-8') as f:
                json.dump(results, f, indent=2, ensure_ascii=False)
            logger.info(f"Results saved to: {args.output}")

        # Print summary
        if 'summary' in results:
            summary = results['summary']
            print(f"\nEnvironment Validation Summary:")
            print(f"Total Checks: {summary['total_checks']}")
            print(f"Passed: {summary['passed']}")
            print(f"Failed: {summary['failed']}")
            print(f"Warnings: {summary['warnings']}")
            print(f"Skipped: {summary['skipped']}")
            print(f"Success Rate: {summary['success_rate_percent']}%")
            print(f"Overall Status: {summary['overall_status']}")

        # Return appropriate exit code
        return 0 if results.get('summary', {}).get('overall_status') in ['PASS', 'WARN'] else 1

    except Exception as e:
        logger.error(f"Environment validation failed: {str(e)}", exc_info=True)
        return 1


if __name__ == '__main__':
    exit_code = main()
    sys.exit(exit_code)