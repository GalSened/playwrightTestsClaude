import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  vus: 2,
  duration: '10s',
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.1'],
  },
};

export default function() {
  // Test a simple HTTP endpoint
  let response = http.get('http://localhost:8082/health');

  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
    'has status field': (r) => r.json().status !== undefined,
  });

  sleep(1);
}