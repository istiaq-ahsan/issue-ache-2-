const ApiError = require('./api-error')

async function notifyInstitutionAdministrator(
  transaction,
  {
    institutionId,
    type,
    title,
    message,
    relatedEntityType,
    relatedEntityId,
  },
) {
  const institution = await transaction.institution.findUnique({
    where: { id: institutionId },
    select: { adminUserId: true },
  })
  if (!institution) {
    throw new ApiError(
      404,
      'INSTITUTION_NOT_FOUND',
      'The institution notification recipient could not be resolved',
    )
  }

  return transaction.notification.create({
    data: {
      institutionId,
      recipientId: institution.adminUserId,
      type,
      title,
      message,
      relatedEntityType,
      relatedEntityId,
    },
  })
}

module.exports = { notifyInstitutionAdministrator }
