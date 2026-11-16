
import { motion } from 'framer-motion'
import SectionHeading from './SectionHeading'
import { problems } from '../data/aboutData'
import { staggerVariants } from '../utils/aboutAnimations'

function AboutProblems({ entranceVariants }) {
  return (
    <section
      aria-labelledby="about-problem-title"
      className="about-section about-problem-section"
    >
      <SectionHeading
        description="Campus concerns deserve a process that is easy to understand and easier to follow."
        eyebrow="The challenge"
        headingId="about-problem-title"
        title="Small communication gaps can become big frustrations."
      />

      <motion.div
        className="about-problem-grid"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
        variants={staggerVariants}
      >
        {problems.map(({ description, icon: Icon, title }) => (
          <motion.article
            className="about-problem-card"
            key={title}
            variants={entranceVariants}
          >
            <span className="about-problem-icon">
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

export default AboutProblems
