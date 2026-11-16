
import { motion } from 'framer-motion'
import { Target, Sparkles } from 'lucide-react'
import SectionHeading from './SectionHeading'
import { staggerVariants } from '../utils/aboutAnimations'

function AboutPurpose({ entranceVariants }) {
  return (
    <section
      aria-labelledby="about-mission-section-title"
      className="about-section about-mission-section"
    >
      <SectionHeading
        centered
        description="A practical platform today, shaped by a more connected campus tomorrow."
        eyebrow="Our purpose"
        headingId="about-mission-section-title"
        title="A clear mission. A connected vision."
      />

      <motion.div
        className="about-purpose-grid"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={staggerVariants}
      >
        <motion.article
          className="about-purpose-card about-mission-card"
          variants={entranceVariants}
        >
          <span className="about-purpose-icon">
            <Target aria-hidden="true" size={21} />
          </span>

          <span className="about-card-eyebrow">Our mission</span>

          <h3>Make campus communication work better.</h3>

          <p>
            Make campus communication and issue management more organized,
            transparent, and accessible for everyone involved.
          </p>
        </motion.article>

        <motion.article
          className="about-purpose-card about-vision-card"
          variants={entranceVariants}
        >
          <span className="about-purpose-icon">
            <Sparkles aria-hidden="true" size={21} />
          </span>

          <span className="about-card-eyebrow">Our vision</span>

          <h3>
            Connected campuses, where progress is easier to follow.
          </h3>

          <p>
            Build a connected campus environment where institutional
            problems can be reported, managed, and tracked efficiently.
          </p>
        </motion.article>
      </motion.div>
    </section>
  )
}

export default AboutPurpose
