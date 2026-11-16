
import { motion } from 'framer-motion'

import { benefits } from '../data/howItWorksData'
import { staggerVariants } from '../utils/howAnimations'
import SectionHeading from './SectionHeading'

function WorkflowBenefits({ entranceVariants }) {
  return (
    <section
      aria-labelledby="why-workflow-title"
      className="how-section how-benefits-section"
    >
      <SectionHeading
        centered
        description="A dependable process helps the campus community stay informed, organized, and accountable."
        eyebrow="Why this workflow matters"
        headingId="why-workflow-title"
        title="Clarity at every step."
      />

      <motion.div
        className="how-benefit-grid"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
        variants={staggerVariants}
      >
        {benefits.map(({ description, icon: Icon, title }) => (
          <motion.article
            className="how-benefit-card"
            key={title}
            variants={entranceVariants}
          >
            <span className="how-benefit-icon">
              <Icon aria-hidden="true" size={19} />
            </span>

            <h3>{title}</h3>

            <p>{description}</p>
          </motion.article>
        ))}
      </motion.div>
    </section>
  )
}

export default WorkflowBenefits
