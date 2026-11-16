
import { Check, Fingerprint, LockKeyhole } from 'lucide-react'

import { accessLevels } from '../data/howItWorksData'
import SectionHeading from './SectionHeading'

function RoleAccess() {
  return (
    <section
      aria-labelledby="role-access-title"
      className="how-section how-access-section"
    >
      <div className="how-access-heading">
        <SectionHeading
          description="Issue visibility follows role and institution membership—not a public, one-size-fits-all feed."
          eyebrow="Transparent role-based access"
          headingId="role-access-title"
          title="The right issues, for the right people."
        />

        <span aria-hidden="true" className="how-access-lock">
          <Fingerprint size={23} />
        </span>
      </div>

      <div className="how-access-grid">
        {accessLevels.map(
          ({ audience, description, icon: Icon, role, tone }) => (
            <article
              className={`how-access-card access-${tone}`}
              key={role}
            >
              <span className="how-access-icon">
                <Icon aria-hidden="true" size={19} />
              </span>

              <span className="how-card-kicker">
                {role.toUpperCase()}
              </span>

              <h3>{audience}</h3>

              <p>{description}</p>

              <span className="how-access-audience">
                <Check aria-hidden="true" size={14} />
                {audience}
              </span>
            </article>
          ),
        )}
      </div>

      <div className="how-tenant-note">
        <LockKeyhole aria-hidden="true" size={19} />

        <p>
          <strong>
            Institutional information stays institution-scoped.
          </strong>

          <span>
            Each institution’s data is isolated from other institutions.
          </span>
        </p>
      </div>
    </section>
  )
}

export default RoleAccess
