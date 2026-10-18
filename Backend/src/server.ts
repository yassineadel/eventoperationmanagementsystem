import { env } from './config/env'
import app from './app'
import { startHoldExpiryWorker } from './modules/inventory/inventory.service'
import { startPaymentWorker } from './modules/payments/payments.service'

app.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT} in ${env.NODE_ENV} mode`)
})

// Give expired checkout holds back to the pool (FR-TKT-10)
startHoldExpiryWorker()

// Cancel abandoned orders and recover payments whose confirmation was lost (FR-CHK-09, FR-PAY-05)
startPaymentWorker()
