const PLAN_CATALOG = Object.freeze({
  BASIC: Object.freeze({
    code: 'BASIC',
    name: 'Basic',
    currency: 'BDT',
    trialDays: 14,
    prices: Object.freeze({ MONTHLY: 1499, YEARLY: 14990 }),
    limits: Object.freeze({ maxAuthorities: 2, maxMembers: 1000 }),
  }),
  PRO: Object.freeze({
    code: 'PRO',
    name: 'Pro',
    currency: 'BDT',
    trialDays: 0,
    prices: Object.freeze({ MONTHLY: 3999, YEARLY: 39990 }),
    limits: Object.freeze({ maxAuthorities: 5, maxMembers: 10000 }),
  }),
})

function getPlan(planCode) {
  return PLAN_CATALOG[planCode] || null
}

function listPlans() {
  return Object.values(PLAN_CATALOG).map((plan) => ({
    code: plan.code,
    name: plan.name,
    currency: plan.currency,
    trialDays: plan.trialDays,
    prices: { ...plan.prices },
    limits: { ...plan.limits },
  }))
}

module.exports = { PLAN_CATALOG, getPlan, listPlans }
