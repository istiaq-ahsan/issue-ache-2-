import { Link } from 'react-router-dom'

function BrandLockup({
  ariaLabel,
  className = '',
  icon: Icon,
  iconSize = 20,
  iconWeight,
  linkComponent: LinkComponent = Link,
}) {
  const lockupClassName = ['brand-lockup', className].filter(Boolean).join(' ')

  return (
    <LinkComponent aria-label={ariaLabel} className={lockupClassName} to="/">
      <span className="brand-mark">
        <Icon
          aria-hidden="true"
          size={iconSize}
          {...(iconWeight ? { weight: iconWeight } : {})}
        />
      </span>
      <span>Issue Ache<span className="brand-period text-lg font-bold"> !</span></span>
    </LinkComponent>
  )
}

export default BrandLockup
