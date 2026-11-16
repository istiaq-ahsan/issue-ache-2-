
import { motion } from 'framer-motion'
import { useState } from 'react'
import { ArrowRight, Workflow } from 'lucide-react'
import { Link } from 'react-router-dom'

import { workflowSteps } from '../data/howItWorksData'
import { heroVariants } from '../utils/howAnimations'
import WorkflowSection from './WorkflowSection'

function HowHero({ prefersReducedMotion }) {
  const [activeWorkflowStep, setActiveWorkflowStep] = useState(0)

  return (
    <motion.section
      aria-labelledby="how-hero-title"
      className="how-process-hero how-process-hero--light"
      id="complete-workflow"
      initial={prefersReducedMotion ? false : 'hidden'}
      animate="visible"
      variants={heroVariants(prefersReducedMotion)}
    >
      <style>{`
        :root:not([data-theme="dark"]) .how-process-hero--light {
          color: #0f172a;
          background:
            radial-gradient(
              ellipse at 88% 0%,
              rgb(37 99 235 / 0.09),
              transparent 35rem
            ),
            linear-gradient(145deg, #ffffff 0%, #f8fafc 100%);
          border: 1px solid #e2e8f0;
          box-shadow: 0 8px 30px rgb(15 23 42 / 0.045);
        }

        :root:not([data-theme="dark"]) .how-process-hero--light .how-process-header {
          border-bottom-color: #e2e8f0;
        }

        :root:not([data-theme="dark"]) .how-process-hero--light .how-process-eyebrow {
          color: #2563eb;
        }

        :root:not([data-theme="dark"]) .how-process-hero--light .how-process-header h1 {
          color: #0f172a;
        }

        :root:not([data-theme="dark"]) .how-process-hero--light .how-process-header h1 em {
          color: #2563eb;
        }

        :root:not([data-theme="dark"]) .how-process-hero--light .how-process-header p {
          color: #64748b;
        }

        :root:not([data-theme="dark"]) .how-process-hero--light .how-process-count {
          color: #1e293b;
        }

        :root:not([data-theme="dark"]) .how-process-hero--light .how-process-count i {
          color: #94a3b8;
        }

        :root:not([data-theme="dark"]) .how-process-hero--light .how-process-header-aside > span:nth-child(2) {
          color: #64748b;
        }

        :root:not([data-theme="dark"]) .how-process-hero--light .how-process-header-aside a,
        :root:not([data-theme="dark"]) .how-process-hero--light .how-process-footer a {
          color: #2563eb;
        }

        :root:not([data-theme="dark"]) .how-process-hero--light .how-process-header-aside a:hover,
        :root:not([data-theme="dark"]) .how-process-hero--light .how-process-footer a:hover {
          color: #1d4ed8;
        }

        /* Workflow navigation */

        :root:not([data-theme="dark"]) .how-process-hero--light .how-journey-rail {
          background: #e2e8f0;
        }

        :root:not([data-theme="dark"]) .how-process-hero--light .how-journey-progress {
          background: linear-gradient(90deg, #2563eb, #06b6d4, #818cf8);
        }

        :root:not([data-theme="dark"]) .how-process-hero--light .how-journey-step {
          color: #64748b;
        }

        :root:not([data-theme="dark"]) .how-process-hero--light .how-journey-node {
          background: #ffffff;
          border-color: #cbd5e1;
          color: #64748b;
          box-shadow: 0 0 0 7px #f8fafc;
        }

        :root:not([data-theme="dark"]) .how-process-hero--light .how-journey-step:hover .how-journey-node {
          border-color: #60a5fa;
          background: #eff6ff;
          color: #2563eb;
        }

        :root:not([data-theme="dark"]) .how-process-hero--light .how-journey-step.is-active .how-journey-node {
          border-color: #2563eb;
          background: #2563eb;
          color: #ffffff;
          box-shadow:
            0 0 0 7px #f8fafc,
            0 0 0 9px rgb(37 99 235 / 0.18);
        }

        :root:not([data-theme="dark"]) .how-process-hero--light .how-journey-step.is-complete .how-journey-node {
          border-color: #93c5fd;
          background: #eff6ff;
          color: #2563eb;
        }

        :root:not([data-theme="dark"]) .how-process-hero--light .how-journey-index {
          color: #94a3b8;
        }

        :root:not([data-theme="dark"]) .how-process-hero--light .how-journey-label {
          color: #64748b;
        }

        :root:not([data-theme="dark"]) .how-process-hero--light .how-journey-step.is-active .how-journey-index,
        :root:not([data-theme="dark"]) .how-process-hero--light .how-journey-step.is-active .how-journey-label {
          color: #1d4ed8;
        }

        /* Selected workflow step */

        :root:not([data-theme="dark"]) .how-process-hero--light .how-process-detail {
          border-top-color: #e2e8f0;
        }

        :root:not([data-theme="dark"]) .how-process-hero--light .how-process-detail-icon {
          border-color: #bfdbfe;
          background: #eff6ff;
          color: #2563eb;
        }

        :root:not([data-theme="dark"]) .how-process-hero--light .how-process-detail-icon.tone-violet {
          border-color: #ddd6fe;
          background: #f5f3ff;
          color: #7c3aed;
        }

        :root:not([data-theme="dark"]) .how-process-hero--light .how-process-detail-icon.tone-cyan {
          border-color: #a5f3fc;
          background: #ecfeff;
          color: #0891b2;
        }

        :root:not([data-theme="dark"]) .how-process-hero--light .how-process-detail-icon.tone-green {
          border-color: #bbf7d0;
          background: #f0fdf4;
          color: #16a34a;
        }

        :root:not([data-theme="dark"]) .how-process-hero--light .how-process-detail-icon.tone-amber {
          border-color: #fde68a;
          background: #fffbeb;
          color: #d97706;
        }

        :root:not([data-theme="dark"]) .how-process-hero--light .how-process-detail-kicker {
          color: #2563eb;
        }

        :root:not([data-theme="dark"]) .how-process-hero--light .how-process-detail-copy h2 {
          color: #0f172a;
        }

        :root:not([data-theme="dark"]) .how-process-hero--light .how-process-detail-copy > p {
          color: #64748b;
        }

        :root:not([data-theme="dark"]) .how-process-hero--light .how-process-detail-copy li {
          color: #475569;
        }

        :root:not([data-theme="dark"]) .how-process-hero--light .how-process-detail-copy li svg {
          color: #16a34a;
        }

        :root:not([data-theme="dark"]) .how-process-hero--light .how-process-detail-index {
          color: #e2e8f0;
        }

        :root:not([data-theme="dark"]) .how-process-hero--light .how-process-detail-index span {
          color: #94a3b8;
        }

        /* Workflow status badges */

        :root:not([data-theme="dark"]) .how-process-hero--light .how-process-statuses .status-open,
        :root:not([data-theme="dark"]) .how-process-hero--light .how-process-statuses .status-in_progress {
          background: #eff6ff;
          color: #1d4ed8;
        }

        :root:not([data-theme="dark"]) .how-process-hero--light .how-process-statuses .status-resolved {
          background: #ccfbf1;
          color: #115e59;
        }

        :root:not([data-theme="dark"]) .how-process-hero--light .how-process-statuses .status-closed {
          background: #ede9fe;
          color: #6d28d9;
        }

        /* Footer */

        :root:not([data-theme="dark"]) .how-process-hero--light .how-process-footer {
          border-top-color: #e2e8f0;
        }

        :root:not([data-theme="dark"]) .how-process-hero--light .how-process-footer > span {
          color: #64748b;
        }

        :root:not([data-theme="dark"]) .how-process-hero--light .how-process-footer > span svg {
          color: #2563eb;
        }

        @media (max-width: 640px) {
          :root:not([data-theme="dark"]) .how-process-hero--light .how-process-detail-content {
            grid-template-columns: 42px minmax(0, 1fr);
          }

          :root:not([data-theme="dark"]) .how-process-hero--light .how-process-detail-index {
            display: none;
          }
        }
      `}</style>

      <div className="how-process-header">
        <div>
          <span className="how-process-eyebrow">
            <Workflow aria-hidden="true" size={14} />
            The system, step by step
          </span>

          <h1 id="how-hero-title">
            How Issue Ache! <em>works.</em>
          </h1>

          <p>
            From institution setup to a resolved issue, follow the path that
            connects your campus community.
          </p>
        </div>

        <div className="how-process-header-aside">
          <span className="how-process-count">
            {String(activeWorkflowStep + 1).padStart(2, '0')}
            <i>/</i>
            {String(workflowSteps.length).padStart(2, '0')}
          </span>

          <span>Explore each step</span>

          <Link to="/pricing">
            Start with your institution
            <ArrowRight aria-hidden="true" size={15} />
          </Link>
        </div>
      </div>

      <WorkflowSection
        activeWorkflowStep={activeWorkflowStep}
        setActiveWorkflowStep={setActiveWorkflowStep}
        prefersReducedMotion={prefersReducedMotion}
      />
    </motion.section>
  )
}

export default HowHero
