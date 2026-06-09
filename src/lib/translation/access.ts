// Translation Review tool access model.
// The owner (PM) creates/renames/deletes projects and loads sources. Any logged-in
// user may view a project and edit translation values + export. Only the owner sees
// the setup/source controls and may call the owner-gated APIs.
export const TRANSLATION_OWNER_EMAIL = 'pfeytser@industriousoffice.com'

export function isTranslationOwner(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase() === TRANSLATION_OWNER_EMAIL.toLowerCase()
}
