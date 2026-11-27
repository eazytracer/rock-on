/** The link a friend code shares: opens Add a friend with the code filled in. */
export const friendCodeLink = (code: string) =>
  `${window.location.origin}/friends?code=${code}`

/** Copy text; false when the clipboard isn't available. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
