
import { motion } from 'framer-motion'
import SectionHeading from './SectionHeading'
import { principles } from '../data/aboutData'
import { staggerVariants } from '../utils/aboutAnimations'

function AboutPrinciples({ entranceVariants }) {
  return (
    <section
      aria-labelledby="about-principles-title"
      className="about-section about-principles-section"
    >
      <SectionHeading
        centered
        description="The principles behind every clearer process and more connected interaction."
        eyebrow="Our core principles"
        headingId="about-principles-title"
        title="The way forward, together."
      />

      <motion.div
        className="about-principles-grid"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={staggerVariants}
      >
        {principles.map(({ icon: Icon, label }) => (
          <motion.div
            className="about-principle"
            key={label}
            variants={entranceVariants}
          >
            <span>
              <Icon aria-hidden="true" size={19} />
            </span>

            <h3>{label}</h3>
          </motion.div>
        ))}
      </motion.div>
    </section>
  )
}

export default AboutPrinciples
