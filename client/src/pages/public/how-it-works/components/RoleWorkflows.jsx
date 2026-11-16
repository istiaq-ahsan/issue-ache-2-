
import { AnimatePresence, motion } from 'framer-motion'
import { useRef, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { roleDetails } from '../data/howItWorksData'
import SectionHeading from './SectionHeading'

function RoleWorkflows({ prefersReducedMotion }) {
  const [activeRole, setActiveRole] = useState('student')
  const tabRefs = useRef({})

  const currentRole = roleDetails[activeRole]
  const CurrentRoleIcon = currentRole.icon

  function handleTabKeyDown(event, currentIndex) {
    const roles = Object.keys(roleDetails)
    let nextIndex = currentIndex

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % roles.length
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + roles.length) % roles.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = roles.length - 1
    } else {
      return
    }

    event.preventDefault()

    const nextRole = roles[nextIndex]

    setActiveRole(nextRole)
    tabRefs.current[nextRole]?.focus()
  }

  return (
    <section
      aria-labelledby="role-workflows-title"
      className="how-section how-roles-section"
    >
      <SectionHeading
        description="Each role has a different view and set of responsibilities within the same institutional workflow."
        eyebrow="Designed around your role"
        headingId="role-workflows-title"
        title="The right workflow for everyone."
      />

      <div className="how-role-panel">
        <div
          aria-label="Choose a role"
          className="how-role-tabs"
          role="tablist"
        >
          {Object.entries(roleDetails).map(([role, details], index) => {
            const RoleIcon = details.icon
            const isSelected = activeRole === role

            return (
              <button
                aria-controls="how-role-panel"
                aria-selected={isSelected}
                className={`how-role-tab${isSelected ? ' is-active' : ''}`}
                id={`how-role-tab-${role}`}
                key={role}
                onClick={() => setActiveRole(role)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
                ref={(element) => {
                  tabRefs.current[role] = element
                }}
                role="tab"
                tabIndex={isSelected ? 0 : -1}
                type="button"
              >
                <RoleIcon aria-hidden="true" size={17} />
                {details.label}
              </button>
            )
          })}
        </div>

        <div
          aria-labelledby={`how-role-tab-${activeRole}`}
          className="how-role-content"
          id="how-role-panel"
          role="tabpanel"
          tabIndex={0}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              animate="visible"
              className="how-role-content-inner"
              initial={prefersReducedMotion ? false : 'hidden'}
              key={activeRole}
              variants={
                prefersReducedMotion
                  ? {
                      hidden: { opacity: 1 },
                      visible: { opacity: 1 },
                    }
                  : {
                      hidden: { opacity: 0, x: 12 },
                      visible: {
                        opacity: 1,
                        x: 0,
                        transition: {
                          duration: 0.22,
                          ease: 'easeOut',
                        },
                      },
                    }
              }
            >
              <div className={`how-role-summary role-${activeRole}`}>
                <span className="how-role-summary-icon">
                  <CurrentRoleIcon aria-hidden="true" size={21} />
                </span>

                <span className="how-card-kicker">
                  {currentRole.label.toUpperCase()} JOURNEY
                </span>

                <h3>{currentRole.intro}</h3>

                <Link className="how-role-cta" to={currentRole.href}>
                  {currentRole.cta}
                  <ArrowUpRight aria-hidden="true" size={15} />
                </Link>
              </div>

              <ol className="how-role-steps">
                {currentRole.steps.map((step, index) => (
                  <li key={step}>
                    <span className="how-role-step-number">
                      {String(index + 1).padStart(2, '0')}
                    </span>

                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}

export default RoleWorkflows
