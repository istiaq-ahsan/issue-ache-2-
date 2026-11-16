const API_PREFIX = '/api'

const API_ROUTES = Object.freeze({
  AUTH: '/auth',
  INSTITUTIONS: '/institutions',
  DEPARTMENTS: '/departments',
  AUTHORITIES: '/authorities',
  STUDENTS: '/students',
  TEACHERS: '/teachers',
  MEMBERSHIPS: '/memberships',
  DEPARTMENT_CHANGE_REQUESTS: '/department-change-requests',
  SUBSCRIPTIONS: '/subscriptions',
  PAYMENTS: '/payments',
  ISSUES: '/issues',
  NOTIFICATIONS: '/notifications',
  ANALYTICS: '/analytics',
  AUDIT_LOGS: '/audit-logs',
})

module.exports = { API_PREFIX, API_ROUTES }
