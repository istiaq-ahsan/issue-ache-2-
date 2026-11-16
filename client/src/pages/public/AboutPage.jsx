
import { useReducedMotion } from 'framer-motion'

import AboutHero from './about/components/AboutHero'
import AboutStory from './about/components/AboutStory'
import AboutPurpose from './about/components/AboutPurpose'
import AboutProblems from './about/components/AboutProblems'
import AboutSolutions from './about/components/AboutSolutions'
import AboutBenefits from './about/components/AboutBenefits'
import AboutPrinciples from './about/components/AboutPrinciples'
import AboutCTA from './about/components/AboutCTA'

import { getEntranceVariants } from './about/utils/aboutAnimations'

function AboutPage() {
  const prefersReducedMotion = useReducedMotion()

  const entranceVariants = getEntranceVariants(prefersReducedMotion)

  return (
    <main aria-label="About Issue Ache" className="about-page">
      {/* <AboutHero
        entranceVariants={entranceVariants}
        prefersReducedMotion={prefersReducedMotion}
      /> */}

      <AboutStory entranceVariants={entranceVariants} />

      <AboutPurpose entranceVariants={entranceVariants} />

      {/* <AboutProblems entranceVariants={entranceVariants} /> */}

      <AboutSolutions entranceVariants={entranceVariants} />

      <AboutBenefits entranceVariants={entranceVariants} />

      <AboutPrinciples entranceVariants={entranceVariants} />

      <AboutCTA entranceVariants={entranceVariants} />
    </main>
  )
}

export default AboutPage
