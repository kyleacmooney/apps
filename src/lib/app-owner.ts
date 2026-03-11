export const APP_OWNER_EMAIL = 'kyleacmooney@gmail.com'

export function isAppOwner(email: string | undefined | null): boolean {
  return !!email && email.toLowerCase() === APP_OWNER_EMAIL.toLowerCase()
}
