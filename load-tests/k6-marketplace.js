import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * Prueba de carga realista para el marketplace Yewi (staging).
 * Uso:
 *   k6 run -e BASE_URL=https://staging.yewi.app/api/v1 -e AUTH_TOKEN=<jwt> load-tests/k6-marketplace.js
 */
export const options = {
  scenarios: {
    browse_and_search: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 500,
      stages: [
        { duration: '1m', target: 55 },
        { duration: '3m', target: 110 },
        { duration: '1m', target: 0 },
      ],
      exec: 'browseAndSearch',
    },
    view_professionals: {
      executor: 'ramping-arrival-rate',
      startRate: 5,
      timeUnit: '1s',
      preAllocatedVUs: 20,
      maxVUs: 200,
      stages: [
        { duration: '1m', target: 20 },
        { duration: '3m', target: 40 },
        { duration: '1m', target: 0 },
      ],
      exec: 'viewProfessionals',
    },
    authenticated_activity: {
      executor: 'ramping-arrival-rate',
      startRate: 2,
      timeUnit: '1s',
      preAllocatedVUs: 10,
      maxVUs: 150,
      stages: [
        { duration: '1m', target: 10 },
        { duration: '3m', target: 25 },
        { duration: '1m', target: 0 },
      ],
      exec: 'authenticatedActivity',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<400', 'p(99)<1000'],
  },
};

const BASE = (__ENV.BASE_URL || 'http://localhost:3000/api/v1').replace(/\/+$/, '');
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';

export function browseAndSearch() {
  const resCategories = http.get(`${BASE}/categories`);
  check(resCategories, { 'categories 200': (r) => r.status === 200 });

  const resGigs = http.get(`${BASE}/gigs?limit=20`);
  check(resGigs, { 'gigs 200': (r) => r.status === 200 });

  sleep(Math.random() * 2 + 1);
}

export function viewProfessionals() {
  const resPros = http.get(`${BASE}/professionals?limit=20`);
  check(resPros, { 'professionals 200': (r) => r.status === 200 });

  sleep(Math.random() * 2 + 1);
}

export function authenticatedActivity() {
  if (!AUTH_TOKEN) {
    const resHealth = http.get(`${BASE}/health`);
    check(resHealth, { 'health ok/503': (r) => r.status === 200 || r.status === 503 });
    sleep(1);
    return;
  }

  const headers = { Authorization: `Bearer ${AUTH_TOKEN}` };
  const resNotif = http.get(`${BASE}/notifications/unread-count`, { headers });
  check(resNotif, { 'notifications unread 200': (r) => r.status === 200 });

  const resConv = http.get(`${BASE}/chat/conversations`, { headers });
  check(resConv, { 'conversations 200': (r) => r.status === 200 });

  sleep(Math.random() * 3 + 1);
}
