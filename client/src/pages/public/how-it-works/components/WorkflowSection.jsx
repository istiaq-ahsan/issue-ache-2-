
import { AnimatePresence, motion } from 'framer-motion'
import { Check, LockKeyhole, ArrowRight } from 'lucide-react'

import { workflowSteps } from '../data/howItWorksData'

function WorkflowSection({
  activeWorkflowStep,
  setActiveWorkflowStep,
  prefersReducedMotion,
}) {
  const currentStep = workflowSteps[activeWorkflowStep]
  const CurrentStepIcon = currentStep.icon

  function handleWorkflowKeyDown(event, currentIndex) {
    let nextIndex = currentIndex

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % workflowSteps.length
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex =
        (currentIndex - 1 + workflowSteps.length) % workflowSteps.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = workflowSteps.length - 1
    } else {
      return
    }

    event.preventDefault()
    setActiveWorkflowStep(nextIndex)
    document.getElementById(`how-step-${nextIndex}`)?.focus()
  }

  const progress =
    (activeWorkflowStep / (workflowSteps.length - 1)) * 100

  return (
    <>
      <div
        className="how-journey"
        aria-label="Interactive eight-step Issue Ache workflow"
      >
        <div className="how-journey-rail" aria-hidden="true">
          <span
            className="how-journey-progress"
            style={{
              '--journey-progress': `${progress}%`,
              width: `${progress}%`,
              transitionDuration: prefersReducedMotion ? '0ms' : undefined,
            }}
          />
        </div>

        <ol className="how-journey-steps" aria-label="Workflow steps">
          {workflowSteps.map(({ icon: Icon, shortTitle, title }, index) => {
            const isActive = activeWorkflowStep === index
            const isComplete = index < activeWorkflowStep

            return (
              <li className="how-journey-item" key={title}>
                <button
                  aria-current={isActive ? 'step' : undefined}
                  aria-label={`Step ${index + 1}: ${title}`}
                  className={`how-journey-step${isActive ? ' is-active' : ''}${isComplete ? ' is-complete' : ''}`}
                  id={`how-step-${index}`}
                  onClick={() => setActiveWorkflowStep(index)}
                  onKeyDown={(event) =>
                    handleWorkflowKeyDown(event, index)
                  }
                  type="button"
                >
                  <span className="how-journey-node">
                    <Icon aria-hidden="true" size={18} />
                  </span>

                  <span className="how-journey-index">
                    0{index + 1}
                  </span>

                  <span className="how-journey-label">
                    {shortTitle}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </div>

      <div className="how-process-detail">
        <AnimatePresence mode="wait" initial={false}>
          <motion.article
            aria-live="polite"
            className="how-process-detail-content"
            key={activeWorkflowStep}
            initial={
              prefersReducedMotion ? false : { opacity: 0, y: 8 }
            }
            animate={{ opacity: 1, y: 0 }}
            exit={
              prefersReducedMotion
                ? undefined
                : { opacity: 0, y: -6 }
            }
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { duration: 0.2, ease: 'easeOut' }
            }
          >
            <span className={`how-process-detail-icon tone-${currentStep.tone}`}>
              <CurrentStepIcon aria-hidden="true" size={21} />
            </span>

            <div className="how-process-detail-copy">
              <span className="how-process-detail-kicker">
                STEP {String(activeWorkflowStep + 1).padStart(2, '0')}
                <i />
                {currentStep.phase}
              </span>

              <h2>{currentStep.title}</h2>

              <p>{currentStep.description}</p>

              <ul>
                {currentStep.details.map((detail) => (
                  <li key={detail}>
                    <Check aria-hidden="true" size={14} />
                    {detail}
                  </li>
                ))}
              </ul>

              {currentStep.statuses && (
                <div
                  className="how-process-statuses"
                  aria-label="Issue statuses"
                >
                  {currentStep.statuses.map((status) => (
                    <span
                      key={status}
                      className={`status-${status.toLowerCase()}`}
                    >
                      {status}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="how-process-detail-index">
              {String(activeWorkflowStep + 1).padStart(2, '0')}
              <span>/ 08</span>
            </div>
          </motion.article>
        </AnimatePresence>
      </div>

      <div className="how-process-footer">
        <span>
          <LockKeyhole aria-hidden="true" size={14} />
          Institution-scoped, role-based access
        </span>

        <a href="#role-workflows-title">
          Explore the role journeys
          <ArrowRight aria-hidden="true" size={14} />
        </a>
      </div>
    </>
  )
}

export default WorkflowSection
