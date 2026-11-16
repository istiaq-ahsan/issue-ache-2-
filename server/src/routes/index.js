const express = require('express')
const { API_ROUTES } = require('../constants/api')
const { sendSuccess } = require('../utils/api-response')
const createFeatureRouter = require('./feature-router')
const createAuthRouter = require('./auth-router')
const createInstitutionRouter = require('./institution-router')
const createDepartmentRouter = require('./department-router')
const createMemberRegistrationRouter = require('./member-registration-router')
const createAuthorityRegistrationRouter = require('./authority-registration-router')
const createMemberProfileRouter = require('./member-profile-router')
const createAuthorityDepartmentChangeRouter = require('./authority-department-change-router')
const createAuthorityDepartmentRouter = require('./authority-department-router')
const createAuthorityMemberRouter = require('./authority-member-router')
const createAuthorityDashboardRouter = require('./authority-dashboard-router')
const createIssueRouter = require('./issue-router')
const createNotificationRouter = require('./notification-router')
const createAuditLogRouter = require('./audit-log-router')
const createPlansRouter = require('./plans-router')
const createRegistrationRouter = require('./registration-router')
const createPaymentRouter = require('./payment-router')
const createSubscriptionRouter = require('./subscription-router')

function createApiRouter({
  authenticate,
  institutionRouterOptions,
  registrationOptions,
  paymentOptions,
  subscriptionRouterOptions,
} = {}) {
  const router = express.Router()
  router.use('/plans', createPlansRouter())
  router.use(
    '/registration',
    createRegistrationRouter(registrationOptions),
  )
  router.use(API_ROUTES.PAYMENTS, createPaymentRouter(paymentOptions))
  router.use(
    API_ROUTES.SUBSCRIPTIONS,
    createSubscriptionRouter(subscriptionRouterOptions),
  )
  router.use(API_ROUTES.AUTH, createAuthRouter({ authenticate }))
  router.use('/registrations', createMemberRegistrationRouter({
    includeInstitutionLookup: true,
    ...institutionRouterOptions?.registrationRouterOptions,
    controller:
      institutionRouterOptions?.registrationRouterOptions?.controller ||
      institutionRouterOptions?.registrationController,
  }))
  router.use('/students', createMemberRegistrationRouter({
    role: 'STUDENT',
    ...institutionRouterOptions?.registrationRouterOptions,
    controller:
      institutionRouterOptions?.registrationRouterOptions?.controller ||
      institutionRouterOptions?.studentRegistrationController ||
      institutionRouterOptions?.registrationController,
  }))
  router.use('/teachers', createMemberRegistrationRouter({
    role: 'TEACHER',
    ...institutionRouterOptions?.registrationRouterOptions,
    controller:
      institutionRouterOptions?.registrationRouterOptions?.controller ||
      institutionRouterOptions?.teacherRegistrationController ||
      institutionRouterOptions?.registrationController,
  }))
  router.use('/authority', createAuthorityRegistrationRouter({
    ...institutionRouterOptions?.authorityRegistrationRouterOptions,
    authenticate:
      institutionRouterOptions?.authorityRegistrationRouterOptions?.authenticate ||
      institutionRouterOptions?.authenticate,
    authorizeInstitution:
      institutionRouterOptions?.authorityRegistrationRouterOptions?.authorizeInstitution,
    authorizeAuthority:
      institutionRouterOptions?.authorityRegistrationRouterOptions?.authorizeAuthority,
    controller:
      institutionRouterOptions?.authorityRegistrationRouterOptions?.controller ||
      institutionRouterOptions?.registrationController,
  }))
  router.use('/authority', createAuthorityDepartmentChangeRouter({
    ...institutionRouterOptions?.authorityDepartmentChangeRouterOptions,
    authenticate:
      institutionRouterOptions?.authorityDepartmentChangeRouterOptions?.authenticate ||
      institutionRouterOptions?.authenticate,
    authorizeInstitution:
      institutionRouterOptions?.authorityDepartmentChangeRouterOptions?.authorizeInstitution,
    authorizeAuthority:
      institutionRouterOptions?.authorityDepartmentChangeRouterOptions?.authorizeAuthority,
    controller:
      institutionRouterOptions?.authorityDepartmentChangeRouterOptions?.controller ||
      institutionRouterOptions?.departmentChangeController,
  }))
  router.use('/authority', createAuthorityDashboardRouter({
    ...institutionRouterOptions?.authorityDashboardRouterOptions,
    authenticate:
      institutionRouterOptions?.authorityDashboardRouterOptions?.authenticate ||
      institutionRouterOptions?.authenticate,
    authorizeInstitution:
      institutionRouterOptions?.authorityDashboardRouterOptions?.authorizeInstitution,
    authorizeAuthority:
      institutionRouterOptions?.authorityDashboardRouterOptions?.authorizeAuthority,
    attachScope:
      institutionRouterOptions?.authorityDashboardRouterOptions?.attachScope,
    controller:
      institutionRouterOptions?.authorityDashboardRouterOptions?.controller,
  }))
  router.use('/authority', createAuthorityMemberRouter({
    role: 'STUDENT',
    ...institutionRouterOptions?.authorityStudentRouterOptions,
    authenticate:
      institutionRouterOptions?.authorityStudentRouterOptions?.authenticate ||
      institutionRouterOptions?.authenticate,
    authorizeInstitution:
      institutionRouterOptions?.authorityStudentRouterOptions?.authorizeInstitution,
    authorizeAuthority:
      institutionRouterOptions?.authorityStudentRouterOptions?.authorizeAuthority,
    attachScope:
      institutionRouterOptions?.authorityStudentRouterOptions?.attachScope,
    requireSubscription:
      institutionRouterOptions?.authorityStudentRouterOptions?.requireSubscription,
    controller:
      institutionRouterOptions?.authorityStudentRouterOptions?.controller,
  }))
  router.use('/authority', createAuthorityMemberRouter({
    role: 'TEACHER',
    ...institutionRouterOptions?.authorityTeacherRouterOptions,
    authenticate:
      institutionRouterOptions?.authorityTeacherRouterOptions?.authenticate ||
      institutionRouterOptions?.authenticate,
    authorizeInstitution:
      institutionRouterOptions?.authorityTeacherRouterOptions?.authorizeInstitution,
    authorizeAuthority:
      institutionRouterOptions?.authorityTeacherRouterOptions?.authorizeAuthority,
    attachScope:
      institutionRouterOptions?.authorityTeacherRouterOptions?.attachScope,
    requireSubscription:
      institutionRouterOptions?.authorityTeacherRouterOptions?.requireSubscription,
    controller:
      institutionRouterOptions?.authorityTeacherRouterOptions?.controller,
  }))
  router.use(API_ROUTES.AUTHORITIES, createAuthorityDepartmentRouter({
    ...institutionRouterOptions?.authorityDepartmentRouterOptions,
    authenticate:
      institutionRouterOptions?.authorityDepartmentRouterOptions?.authenticate ||
      institutionRouterOptions?.authenticate ||
      authenticate,
    controller:
      institutionRouterOptions?.authorityDepartmentRouterOptions?.controller ||
      institutionRouterOptions?.authorityController,
  }))
  router.use('/institutions', createMemberProfileRouter({
    ...institutionRouterOptions?.memberProfileRouterOptions,
    authenticate:
      institutionRouterOptions?.memberProfileRouterOptions?.authenticate ||
      institutionRouterOptions?.authenticate,
    authorizeInstitution:
      institutionRouterOptions?.memberProfileRouterOptions?.authorizeInstitution,
    authorizeMember:
      institutionRouterOptions?.memberProfileRouterOptions?.authorizeMember,
    profileController:
      institutionRouterOptions?.memberProfileRouterOptions?.profileController ||
      institutionRouterOptions?.profileController,
    departmentChangeController:
      institutionRouterOptions?.memberProfileRouterOptions?.departmentChangeController ||
      institutionRouterOptions?.departmentChangeController,
  }))
  router.use(API_ROUTES.ISSUES, createIssueRouter({
    ...institutionRouterOptions?.issueRouterOptions,
    authenticate:
      institutionRouterOptions?.issueRouterOptions?.authenticate ||
      institutionRouterOptions?.authenticate ||
      authenticate,
    authorizeInstitution:
      institutionRouterOptions?.issueRouterOptions?.authorizeInstitution,
    authorizeViewer:
      institutionRouterOptions?.issueRouterOptions?.authorizeViewer,
    authorizeReporter:
      institutionRouterOptions?.issueRouterOptions?.authorizeReporter,
    authorizeAuthority:
      institutionRouterOptions?.issueRouterOptions?.authorizeAuthority,
    controller:
      institutionRouterOptions?.issueRouterOptions?.controller ||
      institutionRouterOptions?.issueController,
  }))
  router.use(API_ROUTES.ISSUES, createFeatureRouter('Issue'))
  router.use(API_ROUTES.NOTIFICATIONS, createNotificationRouter({
    ...institutionRouterOptions?.notificationRouterOptions,
    authenticate:
      institutionRouterOptions?.notificationRouterOptions?.authenticate ||
      institutionRouterOptions?.authenticate ||
      authenticate,
    authorizeInstitution:
      institutionRouterOptions?.notificationRouterOptions?.authorizeInstitution,
    controller:
      institutionRouterOptions?.notificationRouterOptions?.controller ||
      institutionRouterOptions?.notificationController,
  }))
  router.use(API_ROUTES.AUDIT_LOGS, createAuditLogRouter({
    ...institutionRouterOptions?.auditLogRouterOptions,
    authenticate:
      institutionRouterOptions?.auditLogRouterOptions?.authenticate ||
      institutionRouterOptions?.authenticate ||
      authenticate,
    authorizeInstitution:
      institutionRouterOptions?.auditLogRouterOptions?.authorizeInstitution,
    authorizeViewer:
      institutionRouterOptions?.auditLogRouterOptions?.authorizeViewer,
    controller:
      institutionRouterOptions?.auditLogRouterOptions?.controller ||
      institutionRouterOptions?.auditLogController,
  }))
  router.use(
    API_ROUTES.INSTITUTIONS,
    createInstitutionRouter(institutionRouterOptions),
  )
  router.use(
    API_ROUTES.INSTITUTIONS,
    createDepartmentRouter({
      ...institutionRouterOptions?.departmentRouterOptions,
      authenticate:
        institutionRouterOptions?.departmentRouterOptions?.authenticate ||
        institutionRouterOptions?.authenticate,
      authorizeAdministrator:
        institutionRouterOptions?.departmentRouterOptions?.authorizeAdministrator ||
        institutionRouterOptions?.authorizeAdministrator,
      controller:
        institutionRouterOptions?.departmentRouterOptions?.controller ||
        institutionRouterOptions?.departmentController,
    }),
  )

  const featureRoutes = [
    ['/departments', 'Department'],
    [API_ROUTES.AUTHORITIES, 'Authority'],
    [API_ROUTES.STUDENTS, 'Student'],
    [API_ROUTES.TEACHERS, 'Teacher'],
    [API_ROUTES.MEMBERSHIPS, 'Membership'],
    [API_ROUTES.DEPARTMENT_CHANGE_REQUESTS, 'Department change request'],
    [API_ROUTES.ANALYTICS, 'Analytics'],
  ]

  for (const [path, featureName] of featureRoutes) {
    router.use(path, createFeatureRouter(featureName))
  }

  router.get('/health', (req, res) => {
    return sendSuccess(res, { status: 'ok' })
  })

  return router
}

module.exports = createApiRouter
