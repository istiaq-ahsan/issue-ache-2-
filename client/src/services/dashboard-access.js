import { getLoginCandidates, getLoginDestination } from './login-access.js'

const accountTypes = [
  { type: 'authority', label: 'Authority' },
  { type: 'institution', label: 'Institution' },
  { type: 'student', label: 'Student' },
  { type: 'teacher', label: 'Teacher' },
]

export function getDashboardOptions(profile) {
  if (!profile) return []

  const options = []
  const seenPaths = new Set()

  for (const { label, type } of accountTypes) {
    const candidates = getLoginCandidates(type, profile)

    for (const candidate of candidates) {
      const institutionId = type === 'institution'
        ? null
        : candidate.institutionId
      const path = type === 'institution'
        ? '/institution/dashboard'
        : getLoginDestination(type, institutionId)

      if (seenPaths.has(path)) continue
      seenPaths.add(path)

      options.push({
        label: type === 'institution'
          ? `${label} dashboard`
          : `${label} — ${candidate.institution?.name || 'Institution'}`,
        path,
      })
    }
  }

  return options
}
