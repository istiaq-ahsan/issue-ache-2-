import { motion } from 'framer-motion'
import {
  ArrowDownRight,
  ArrowRight,
  Check,
  ClipboardCheck,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import AboutHero from './about/components/AboutHero'

const highlights = [
  { icon: MessageSquareText, title: 'Raise an issue', description: 'Give campus concerns a clear place to start.' },
  { icon: ClipboardCheck, title: 'Keep work moving', description: 'Help authorities review and follow up.' },
  { icon: ShieldCheck, title: 'Stay in the loop', description: 'Get updates through every important step.' },
]

function HomePage() {
  return (
    <main className="public-home">
      <section aria-labelledby="home-title" className="home-hero">
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          initial={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="home-copy"
        >
          {/* <div className="home-kicker"><Sparkles aria-hidden="true" size={15} /> CAMPUS, IN BETTER SHAPE</div> */}
          <h1 id="home-title">A better campus starts with <span>being heard.</span></h1>
          <p>
            Issue Ache brings students, teachers, and institutional teams together to report,
            review, and resolve the issues that matter on campus.
          </p>
          <div className="home-actions">
            <Link className="home-primary-action" to="/institution/register">
              Set up your institution <ArrowRight aria-hidden="true" size={17} />
            </Link>
            <Link className="home-secondary-action" to="/login">
              Sign in to your workspace
            </Link>
          </div>
          <div className="home-trust-note"><Check aria-hidden="true" size={15} /> A dedicated workspace for every institution</div>
        </motion.div>

        <motion.div
          animate={{ opacity: 1, scale: 1 }}
          initial={{ opacity: 0, scale: 0.97 }}
          transition={{ delay: 0.1, duration: 0.45, ease: 'easeOut' }}
          aria-hidden="true"
          className="home-visual"
        >
          <div className="visual-orbit orbit-one" />
          <div className="visual-orbit orbit-two" />
          <div className="visual-card visual-card-main">
            <div className="visual-card-top"><span className="visual-dot" /><span>ISSUE ACHE WORKSPACE</span><ArrowDownRight size={17} /></div>
            <div className="visual-heading">Small concerns.<br /><strong>Meaningful progress.</strong></div>
            <div className="visual-path">
              <div className="visual-step is-complete"><span><Check size={14} /></span><div><b>Reported</b><small>Every concern has a starting point</small></div></div>
              <div className="visual-path-line" />
              <div className="visual-step is-active"><span><span className="visual-step-pulse" /></span><div><b>In review</b><small>Teams can take action with clarity</small></div></div>
              <div className="visual-path-line" />
              <div className="visual-step"><span><Check size={14} /></span><div><b>Resolved</b><small>Progress stays visible along the way</small></div></div>
            </div>
          </div>
          {/* <div className="visual-float visual-float-top"><ShieldCheck size={17} /><span>Institution-scoped access</span></div> */}
          {/* <div className="visual-float visual-float-bottom"><MessageSquareText size={17} /><span>One place to follow up</span></div> */}
        </motion.div>
      </section>

      <section aria-label="Issue Ache features" className="home-highlights">
        {highlights.map(({ description, icon: Icon, title }) => (
          <article className="highlight-card" key={title}>
            <span className="highlight-icon"><Icon aria-hidden="true" size={19} /></span>
            <div><h2>{title}</h2><p>{description}</p></div>
          </article>
        ))}
      </section>

      <AboutHero></AboutHero>

      <footer className="home-footer">
        <span>Issue Ache<span className="brand-period">!</span></span>
        <span>Made for healthier campus communities.</span>
        <div>
          <Link to="/student/register">Student registration</Link>
          <Link to="/teacher/register">Teacher registration</Link>
        </div>
      </footer>
    </main>
  )
}

export default HomePage
