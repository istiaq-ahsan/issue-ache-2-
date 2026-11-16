
function SectionHeading({
  eyebrow,
  title,
  description,
  centered = false,
  headingId,
}) {
  return (
    <div className={`how-section-heading${centered ? ' is-centered' : ''}`}>
      <span className="how-eyebrow">{eyebrow}</span>

      <h2 id={headingId}>{title}</h2>

      {description && <p>{description}</p>}
    </div>
  )
}

export default SectionHeading
