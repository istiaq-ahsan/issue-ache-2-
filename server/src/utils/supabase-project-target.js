function getSupabaseProjectTarget(databaseUrl) {
  const url = new URL(databaseUrl)
  const directHostMatch = url.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i)
  const poolerUserMatch = decodeURIComponent(url.username)
    .match(/^postgres\.([a-z0-9]+)$/i)

  return {
    host: url.host,
    projectRef: directHostMatch?.[1] || poolerUserMatch?.[1] || null,
  }
}

function assertNonProductionDatabaseTargets({
  databaseUrl,
  directUrl,
  productionProjectRef,
  log = console.log,
}) {
  if (!directUrl) throw new Error('DIRECT_URL is required for database operations')
  if (!databaseUrl) throw new Error('DATABASE_URL is required for database operations')

  const directTarget = getSupabaseProjectTarget(directUrl)
  const databaseTarget = getSupabaseProjectTarget(databaseUrl)
  log(`DIRECT_URL target: host=${directTarget.host}, projectRef=${directTarget.projectRef || 'unrecognized'}`)
  log(`DATABASE_URL target: host=${databaseTarget.host}, projectRef=${databaseTarget.projectRef || 'unrecognized'}`)

  if (
    typeof productionProjectRef !== 'string' ||
    productionProjectRef.trim() === '' ||
    productionProjectRef !== productionProjectRef.trim() ||
    /<|>|paste.*prod|your.*production|placeholder/i.test(productionProjectRef)
  ) {
    throw new Error('PRODUCTION_PROJECT_REF must be set to the actual production project ref')
  }
  const normalizedProductionProjectRef = productionProjectRef.toLowerCase()
  if (!directTarget.projectRef || !databaseTarget.projectRef) {
    throw new Error('Could not determine a Supabase project ref from both database URLs')
  }
  if (
    directTarget.projectRef.toLowerCase() === normalizedProductionProjectRef ||
    databaseTarget.projectRef.toLowerCase() === normalizedProductionProjectRef
  ) {
    throw new Error('Database target matches PRODUCTION_PROJECT_REF; refusing all database access')
  }
  if (directTarget.projectRef.toLowerCase() !== databaseTarget.projectRef.toLowerCase()) {
    throw new Error('DATABASE_URL and DIRECT_URL target different Supabase projects')
  }

  return { directTarget, databaseTarget }
}

module.exports = {
  assertNonProductionDatabaseTargets,
  getSupabaseProjectTarget,
}
