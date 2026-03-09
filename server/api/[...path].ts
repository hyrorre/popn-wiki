export default defineEventHandler(async () => {
  throw createError({ status: 404, message: 'Not Found.' })
})
