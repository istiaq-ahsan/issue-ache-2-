
import { motion } from 'framer-motion'
import { MessageSquareText } from 'lucide-react'

function AboutStory({ entranceVariants }) {
  return (
    <motion.section
      aria-labelledby="about-story-title"
      className="about-story about-section"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={entranceVariants}
    >
      <div className="about-story-aside">
        <span className="about-story-icon">
          <MessageSquareText aria-hidden="true" size={22} />
        </span>

        <span className="about-story-caption">
          A better way to be heard
        </span>

        <span aria-hidden="true" className="about-story-rule" />
      </div>

      <div className="about-story-copy">
        <span className="about-eyebrow">Our story</span>

        <h2 id="about-story-title">
          Good campus experiences start with better communication.
        </h2>

        <p>
          Campus life runs on thousands of everyday interactions. Yet when
          something needs attention, reporting it can feel difficult, updates
          can be hard to find, and students, teachers, and authorities may
          end up working from different pieces of the story.
        </p>

        <p>
          Issue Ache! was created to make that process clearer: a dedicated
          place to raise campus issues, review requests, and follow progress
          with more transparency and accountability.
        </p>
      </div>
    </motion.section>
  )
}

export default AboutStory
