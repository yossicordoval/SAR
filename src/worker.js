import { components, createAcquisition, pulseTime } from './physics.js'
import { createFocuser, migration } from './processing.js'

let state, focus

self.onmessage = ({ data: msg }) => {
  if (msg.config) {
    state = createAcquisition(msg.config)
    focus = createFocuser(state)
    const raw = state.i.map((re, j) => Math.hypot(re, state.q[j]))
    const compressed = state.rangeI.map((re, j) => Math.hypot(re, state.rangeQ[j]))
    const { count, bins, width, height, minRange, dr, tracks } = state
    self.postMessage({ type: 'acquisition', revision: msg.revision, count, bins, width, height, minRange, dr,
      tracks, raw, compressed }, [raw.buffer, compressed.buffer])
  }
  const { count, bins, i, q } = state
  const pulse = Math.max(0, Math.min(count - 1, msg.pulse))
  const first = msg.instant ? pulse : 0
  const profiles = components(state, pulse, msg.selected)
  const image = msg.stage === 'focused' ? focus(pulse, msg.instant) : null
  const corrected = msg.stage === 'migration' ? migration(state, first, pulse, msg.selected) : null
  self.postMessage({ type: 'frame', revision: msg.revision, request: msg.request, pulse, first, time: pulseTime(state.config, pulse),
    profiles, image, corrected, selected: msg.selected, stage: msg.stage,
    iqI: i.slice(pulse * bins, (pulse + 1) * bins), iqQ: q.slice(pulse * bins, (pulse + 1) * bins) })
}
