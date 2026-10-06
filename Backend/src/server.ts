import { env } from './config/env'
import app from './app'
import { startHoldExpiryWorker } from './modules/inventory/inventory.service'

app.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT} in ${env.NODE_ENV} mode`)
})

// Give expired checkout holds back to the pool (FR-TKT-10)
startHoldExpiryWorker()
