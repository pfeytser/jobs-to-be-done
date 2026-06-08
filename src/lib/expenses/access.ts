// Expense Reports is a private, single-owner workspace. Only this email may see
// the menu item, the pages, and the API. Everyone else is treated as if it does
// not exist.
export const EXPENSE_OWNER_EMAIL = 'pfeytser@industriousoffice.com'

export function isExpenseOwner(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase() === EXPENSE_OWNER_EMAIL.toLowerCase()
}
