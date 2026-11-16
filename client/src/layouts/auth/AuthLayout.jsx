import { CheckCircle2, ShieldCheck } from 'lucide-react'
import BrandLockup from '../../components/navigation/BrandLockup.jsx'
import ThemeToggle from '../../components/ThemeToggle.jsx'

function AuthLayout({ children }) {
  return (
    <div className="auth-layout">
      <aside className="auth-aside">
        <div className="auth-aside-top">
          <BrandLockup className="brand-lockup-light" icon={ShieldCheck} />
          <ThemeToggle />
        </div>
        <div className="auth-pitch">
          <div className="auth-eyebrow"><span className="auth-eyebrow-dot" /> CAMPUS, IN BETTER SHAPE</div>
          <h2>Better campus days start with being heard.</h2>
          <p>One trusted workspace for the people who make your institution work.</p>
          <ul>
            <li><CheckCircle2 aria-hidden="true" size={18} /> Keep campus requests moving</li>
            <li><CheckCircle2 aria-hidden="true" size={18} /> Stay informed at every step</li>
            <li><CheckCircle2 aria-hidden="true" size={18} /> Make every department count</li>
          </ul>
        </div>
        <p className="auth-aside-footer">A clearer way to care for your campus.</p>
      </aside>
      <div className="auth-content">
        <div className="auth-mobile-header">
          <BrandLockup
            ariaLabel="Issue Ache home"
            icon={ShieldCheck}
            className="auth-mobile-brand"
          />
          <ThemeToggle />
        </div>
        {children}
      </div>
    </div>
  )
}

export default AuthLayout
