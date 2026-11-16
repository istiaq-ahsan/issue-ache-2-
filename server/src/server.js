const app = require('./app')
const env = require('./config/env')

app.listen(env.PORT, () => {
  if (env.NODE_ENV !== 'production') {
    console.info(`Issue Ache! API listening on http://localhost:${env.PORT}`)
  }
})
