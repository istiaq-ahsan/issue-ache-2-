
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import SectionHeading from './SectionHeading'
import { benefits } from '../data/aboutData'
import { staggerVariants } from '../utils/aboutAnimations'

function AboutBenefits({ entranceVariants }) {
  return (
    <section
      aria-labelledby="about-benefits-title"
      className="about-section about-benefits-section"
    >
      <SectionHeading
        centered
        description="A more organized campus experience begins when everyone has a clear way to participate."
        eyebrow="Who benefits"
        headingId="about-benefits-title"
        title="Made for the whole campus community."
      />

      <motion.div
        className="about-benefits-grid"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.18 }}
        variants={staggerVariants}
      >
        {benefits.map(({ description, detail, icon: Icon, title }) => (
          <motion.article
            className="about-benefit-card"
            key={title}
            variants={entranceVariants}
          >
            <span className="about-benefit-icon">
              <Icon aria-hidden="true" size={20} />
            </span>

            <h3>{title}</h3>

            <p>{description}</p>

            <span className="about-benefit-detail">
              <Check aria-hidden="true" size={14} />
              {detail}
            </span>
          </motion.article>
        ))}
      </motion.div>
    </section>
  )
}

export default AboutBenefits
