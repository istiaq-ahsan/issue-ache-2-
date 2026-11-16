
import { motion } from 'framer-motion'
import { ArrowRight, Handshake } from 'lucide-react'
import { Link } from 'react-router-dom'

function AboutCTA({ entranceVariants }) {
  return (
    <motion.section
      aria-labelledby="about-cta-title"
      className="about-final-cta"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
      variants={entranceVariants}
    >
      <div className="about-cta-decoration" aria-hidden="true" />

      <div className="about-cta-copy">
        <span className="about-cta-eyebrow">
          <Handshake aria-hidden="true" size={15} />
          Better campus experiences, together
        </span>

        <h2 id="about-cta-title">
          Let’s build better campus experiences together.
        </h2>

        <p>
          Bring your campus community into a more organized and connected
          environment.
        </p>
      </div>

      <Link className="about-cta-action" to="/pricing">
        Get started <ArrowRight aria-hidden="true" size={17} />
      </Link>
    </motion.section>
  )
}

export default AboutCTA
