// Errors the admin data modules throw when a business rule blocks an action. Pages turn
// the code into a translated message (Components/Admin/errorStrings.ts) instead of
// showing a generic "something went wrong".

export type AdminErrorCode =
  | 'venue-locked'
  | 'venue-missing'
  | 'venue-in-use'
  | 'draft-only-delete'
  | 'draft-only-publish'
  | 'published-only-cancel'
  | 'tickets-locked'
  | 'category-has-sales'
  | 'wave-has-sales'
  | 'wave-price-locked'
  | 'wave-below-sold'
  | 'self-block'
  | 'self-role'
  | 'paid-only-refund'
  | 'request-decided'

export class AdminApiError extends Error {
  code: AdminErrorCode

  constructor(code: AdminErrorCode) {
    super(code)
    this.name = 'AdminApiError'
    this.code = code
  }
}
