
import { motion } from 'framer-motion'
import { Workflow } from 'lucide-react'
import SectionHeading from './SectionHeading'
import { solutions } from '../data/aboutData'
import { staggerVariants } from '../utils/aboutAnimations'

function AboutSolutions({ entranceVariants }) {
  return (
    <section
      aria-labelledby="about-solution-title"
      className="about-section about-solution-section"
    >
      <div className="about-solution-heading">
        <SectionHeading
          description="Issue Ache! brings the important parts of campus issue management into one structured experience."
          eyebrow="Our solution"
          headingId="about-solution-title"
          title="A shared system for turning reports into progress."
        />

        <span className="about-solution-mark" aria-hidden="true">
          <Workflow size={25} />
        </span>
      </div>

      <motion.div
        className="about-solution-grid"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
        variants={staggerVariants}
      >
        {solutions.map(({ description, icon: Icon, title }, index) => (
          <motion.article
            className="about-solution-item"
            key={title}
            variants={entranceVariants}
          >
            <span className="about-solution-icon">
              <Icon aria-hidden="true" size={18} />
            </span>

            <div>
              <span className="about-solution-index">
                0{index + 1}
              </span>

              <h3>{title}</h3>

              <p>{description}</p>
            </div>
          </motion.article>
        ))}
      </motion.div>
    </section>
  )
}

export default AboutSolutions
