
import { motion } from 'framer-motion'

import { issueStages } from '../data/howItWorksData'
import SectionHeading from './SectionHeading'

function IssueLifecycle({ prefersReducedMotion }) {
  return (
    <section
      aria-labelledby="issue-lifecycle-title"
      className="how-section how-lifecycle-section"
    >
      <SectionHeading
        centered
        description="A clear status sequence makes issue progress easier to understand."
        eyebrow="Issue tracking lifecycle"
        headingId="issue-lifecycle-title"
        title="Every issue has a visible path forward."
      />

      <div
        className="how-lifecycle"
        aria-label="Issue lifecycle from open to closed"
      >
        <motion.div
          aria-hidden="true"
          className="how-lifecycle-progress"
          initial={
            prefersReducedMotion ? { scaleX: 1 } : { scaleX: 0 }
          }
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true, amount: 0.55 }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { duration: 1.15, ease: 'easeInOut' }
          }
        />

        {issueStages.map(
          ({ description, icon: Icon, status, title, tone }, index) => (
            <motion.article
              className={`how-stage stage-${tone}`}
              initial={
                prefersReducedMotion ? false : { opacity: 0, y: 16 }
              }
              key={status}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : {
                      delay: index * 0.12,
                      duration: 0.38,
                      ease: 'easeOut',
                    }
              }
            >
              <span className="how-stage-icon">
                <Icon aria-hidden="true" size={19} />
              </span>

              <span className="how-stage-number">
                0{index + 1}
              </span>

              <span className="how-stage-status">{status}</span>

              <h3>{title}</h3>

              <p>{description}</p>
            </motion.article>
          ),
        )}
      </div>
    </section>
  )
}

export default IssueLifecycle
