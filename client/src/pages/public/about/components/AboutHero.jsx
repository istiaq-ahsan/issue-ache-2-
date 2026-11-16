import { motion } from 'framer-motion'
import { MapPin } from 'lucide-react'

function AboutHero({ entranceVariants, prefersReducedMotion }) {
  return (
    <motion.section
      aria-labelledby="about-title"
      className="about-editorial-hero"
      initial={prefersReducedMotion ? false : 'hidden'}
      animate="visible"
      variants={
        prefersReducedMotion
          ? { hidden: { opacity: 1 }, visible: { opacity: 1 } }
          : {
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { staggerChildren: 0.12 },
              },
            }
      }
    >
      {/* <motion.div
        className="about-editorial-heading"
        variants={entranceVariants}
      >
        <h1 id="about-title">
          Campus life is a story
          <br />
          <span className="text-blue-600">
            we can make better together.
          </span>
        </h1>
      </motion.div> */}

      <motion.div
        aria-label="Illustrated campus buildings connected by a shared path between students, teachers, and authorities"
        className="about-editorial-scene"
        role="img"
        variants={entranceVariants}
      >
        <div className="about-campus-art bg-none! bg-transparent!">
          <svg
            aria-hidden="true"
            viewBox="0 0 760 310"
            preserveAspectRatio="xMidYMid meet"
          >
            <path className="campus-art-horizon" d="M25 242H735" />

            <path
              className="campus-art-walk"
              d="M61 259C145 212 202 247 278 211S410 235 477 195 608 207 702 160"
            />

            <path
              className="campus-art-walk-edge"
              d="M61 269C145 222 202 257 278 221S410 245 477 205 608 217 702 170"
            />

            <path
              className="campus-art-building campus-art-building-left"
              d="M80 210V129L145 90 210 129V210Z"
            />

            <path className="campus-art-roof" d="M67 131 145 82 223 131" />

            <path
              className="campus-art-window"
              d="M106 149H125V173H106ZM165 149H184V173H165ZM136 183H154V210H136Z"
            />

            <path
              className="campus-art-building campus-art-building-middle"
              d="M290 210V116L371 76 452 116V210Z"
            />

            <path className="campus-art-roof" d="M277 118 371 68 465 118" />

            <path
              className="campus-art-window"
              d="M316 137H339V163H316ZM359 137H382V163H359ZM402 137H425V163H402ZM353 178H390V210H353Z"
            />

            <path
              className="campus-art-building campus-art-building-right"
              d="M532 210V142L594 106 656 142V210Z"
            />

            <path className="campus-art-roof" d="M520 144 594 98 668 144" />

            <path
              className="campus-art-window"
              d="M553 157H571V180H553ZM601 157H619V180H601ZM583 183H604V210H583Z"
            />

            <path
              className="campus-art-tree"
              d="M244 209V174M231 183C214 176 219 153 240 154 241 133 267 137 266 158 284 165 273 184 257 184"
            />

            <path
              className="campus-art-tree"
              d="M486 209V170M474 180C458 173 463 151 482 151 484 131 510 135 508 155 527 163 516 181 499 181"
            />

            <circle className="campus-art-marker" cx="113" cy="254" r="7" />
            <circle className="campus-art-marker" cx="373" cy="221" r="7" />
            <circle className="campus-art-marker" cx="637" cy="194" r="7" />

            <circle className="campus-art-sun" cx="688" cy="52" r="21" />

            <path className="campus-art-bird" d="M567 54q9-10 18 0 9-10 18 0" />
            <path className="campus-art-bird" d="M610 77q6-7 12 0 6-7 12 0" />
          </svg>

          <div className="about-campus-caption">
            <span>
              <MapPin aria-hidden="true" size={10} />
              A place built by many voices
            </span>

            <span>
              Students <i /> Teachers <i /> Authorities
            </span>
          </div>
        </div>

        <aside className="about-editorial-aside">
          <span className="about-editorial-aside-label">
            The idea we believe in
          </span>

          <blockquote>
            “A better campus begins when a concern has somewhere to go—and
            someone who can see it through.”
          </blockquote>

          <span className="about-editorial-aside-credit">
            <span /> A shared campus story
          </span>
        </aside>
      </motion.div>
    </motion.section>
  )
}

export default AboutHero