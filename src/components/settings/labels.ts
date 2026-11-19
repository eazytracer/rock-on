/** Copy shared by the Settings list and its sections. */
import type { ClickSound } from '../../services/api/preferences'

export const CLICK_LABELS: Record<ClickSound, { title: string; sub: string }> =
  {
    beep: { title: 'Beep', sub: 'The classic electronic click' },
    woodblock: { title: 'Woodblock', sub: 'Warm and woody' },
    hihat: { title: 'Hi-hat', sub: 'A short closed hat' },
  }

const PROVIDER_LABEL: Record<string, string> = {
  email: 'Password',
  google: 'Google',
  apple: 'Apple',
  github: 'GitHub',
}

/** Sign-in providers as the Account rows show them: "Google, Password". */
export const methodsText = (providers: string[] | undefined) =>
  (providers ?? []).map(p => PROVIDER_LABEL[p] ?? p).join(', ')
