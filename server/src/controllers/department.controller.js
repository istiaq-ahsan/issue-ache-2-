const asyncHandler = require('../utils/async-handler')
const { sendSuccess } = require('../utils/api-response')
const {
  createDepartment,
  deleteDepartment,
  getDepartmentDetails,
  listDepartments,
  updateDepartment,
} = require('../services/department.service')

function createDepartmentController({
  create = createDepartment,
  list = listDepartments,
  getDetails = getDepartmentDetails,
  update = updateDepartment,
  remove = deleteDepartment,
} = {}) {
  return {
    create: asyncHandler(async (req, res) => {
      const department = await create(
        req.auth.institutionId,
        req.validated.body.name,
        req.auth.user.id,
      )
      return sendSuccess(res, { department }, {
        statusCode: 201,
        message: 'Department created',
      })
    }),
    list: asyncHandler(async (req, res) => {
      const departments = await list(req.auth.institutionId)
      return sendSuccess(res, { departments })
    }),
    details: asyncHandler(async (req, res) => {
      const department = await getDetails(
        req.auth.institutionId,
        req.params.departmentId,
      )
      return sendSuccess(res, { department })
    }),
    update: asyncHandler(async (req, res) => {
      const department = await update(
        req.auth.institutionId,
        req.params.departmentId,
        req.validated.body.name,
        req.auth.user.id,
      )
      return sendSuccess(res, { department }, { message: 'Department updated' })
    }),
    remove: asyncHandler(async (req, res) => {
      const result = await remove(
        req.auth.institutionId,
        req.params.departmentId,
        req.auth.user.id,
      )
      return sendSuccess(res, result, { message: 'Department deleted' })
    }),
  }
}

module.exports = { createDepartmentController }
