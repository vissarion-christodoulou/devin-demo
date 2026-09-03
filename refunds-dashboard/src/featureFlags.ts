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

function toState(flags: Flag[]): FlagState {
  const state = { ...ALL_ENABLED }
  for (const flag of flags) {
    if (flag.key in state) state[flag.key as FlagKey] = flag.enabled
  }
  return state
}

/**
 * Subscribes to the feature-flags-admin event stream, which pushes the whole flag list on
 * connect and after every toggle. Fails open when the service is unreachable.
 */
export function subscribeToFlags(onChange: (state: FlagState) => void): () => void {
  const source = new EventSource('/api/flags/stream')
  source.onmessage = (event) => onChange(toState(JSON.parse(event.data) as Flag[]))
  source.onerror = () => onChange(ALL_ENABLED)
  return () => source.close()
}
