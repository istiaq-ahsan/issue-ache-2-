
import { motion } from 'framer-motion'
import { ArrowRight, ArrowUpRight, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'

function HowCTA({ entranceVariants }) {
  return (
    <motion.section
      aria-labelledby="how-cta-title"
      className="how-final-cta"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
      variants={entranceVariants}
    >
      <div aria-hidden="true" className="how-cta-rings" />

      <div className="how-cta-copy">
        <span className="how-cta-eyebrow">
          <UsersRound aria-hidden="true" size={15} />
          A more connected campus starts here
        </span>

        <h2 id="how-cta-title">
          Your campus. Better connected.
        </h2>

        <p>
          Bring your campus community together with a more structured and
          transparent way to manage everyday institutional activities.
        </p>
      </div>

      <div className="how-cta-actions">
        <Link
          className="how-cta-primary"
          to="/institution/register"
        >
          Register your institution
          <ArrowRight aria-hidden="true" size={16} />
        </Link>

        <Link className="how-cta-secondary" to="/login">
          Sign in
          <ArrowUpRight aria-hidden="true" size={15} />
        </Link>
      </div>
    </motion.section>
  )
}

export default HowCTA
