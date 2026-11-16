
import { useReducedMotion } from 'framer-motion'

import HowHero from './how-it-works/components/HowHero'
import RoleWorkflows from './how-it-works/components/RoleWorkflows'
import IssueLifecycle from './how-it-works/components/IssueLifecycle'
import RoleAccess from './how-it-works/components/RoleAccess'
import WorkflowBenefits from './how-it-works/components/WorkflowBenefits'
import HowCTA from './how-it-works/components/HowCTA'

import { getEntranceVariants } from './how-it-works/utils/howAnimations'

function HowItWorksPage() {
  const prefersReducedMotion = useReducedMotion()

  const entranceVariants = getEntranceVariants(prefersReducedMotion)

  return (
    <main aria-label="How Issue Ache works" className="how-page">
      <HowHero prefersReducedMotion={prefersReducedMotion} />


      {/* <IssueLifecycle prefersReducedMotion={prefersReducedMotion} /> */}

      <RoleWorkflows prefersReducedMotion={prefersReducedMotion} />
      {/* <RoleAccess /> */}

      <WorkflowBenefits entranceVariants={entranceVariants} />

      <HowCTA entranceVariants={entranceVariants} />
    </main>
  )
}

export default HowItWorksPage
