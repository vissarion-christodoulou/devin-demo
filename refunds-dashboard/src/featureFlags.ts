export type FlagKey =
  | 'refundedValueByReason'
  | 'refundRateByProduct'
  | 'monthlyGrossVsRefunded'
  | 'refundedValueByRegion'
  | 'refundedValueByProduct'
  | 'refundRateByChannel'

export type FlagState = Record<FlagKey, boolean>

export const ALL_ENABLED: FlagState = {
  refundedValueByReason: true,
  refundRateByProduct: true,
  monthlyGrossVsRefunded: true,
  refundedValueByRegion: true,
  refundedValueByProduct: true,
  refundRateByChannel: true,
}

interface Flag {
  key: string
  enabled: boolean
}

/** Reads the flags served by feature-flags-admin, failing open if it is unreachable. */
export async function loadFlags(): Promise<FlagState> {
  const response = await fetch('/api/flags')
  if (!response.ok) throw new Error(`Failed to load feature flags: ${response.status}`)
  const flags = (await response.json()) as Flag[]
  const state = { ...ALL_ENABLED }
  for (const flag of flags) {
    if (flag.key in state) state[flag.key as FlagKey] = flag.enabled
  }
  return state
}
