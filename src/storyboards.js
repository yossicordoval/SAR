const bandwidthSteps = [
  ['One chirped pulse', 'A chirp is one pulse whose frequency changes during transmission. B is the span from its lowest to its highest frequency.'],
  ['Same carrier, different sweep width', 'The sweeps share a center frequency and duration. Widening the sweep leaves the pulse count and scene unchanged.'],
  ['One chirp illuminates two reflectors', 'Reflector A is nearer in slant range. The transmitted wave reaches A before B.'],
  ['Two delayed copies return', 'A arrives at τA and B at τB. The difference Δτ tells us their slant-range separation.'],
  ['Long echoes overlap', 'The receiver measures the sum of two full-duration chirps. Each copy still lasts as long as the transmitted pulse.'],
  ['Keep a reference copy', 'The receiver knows the waveform it sent. It keeps a copy, called a template, for comparing each possible delay.'],
  ['Slide the reference waveform', 'Samples partly cancel at the wrong delay. At the right delay their phases agree, so the sum grows. The trace below builds a match score for each tested delay.'],
  ['Narrow-band result', 'A small timing error still gives a strong match. Two broad compressed responses overlap and can appear as one peak.'],
  ['Wide-band result', 'A small timing error changes the match more quickly. Narrower responses can separate the same two reflectors.'],
  ['Connect to the Range Profile', 'A and B stayed in place. Compare the actual compressed echoes. The ideal slant-range resolution is about c/(2B).'],
]
const reviewSteps = [2, 3, 4, 7, 8, 9]
const dopplerSteps = [
  ['Approach the stationary reflector', 'The platform moves toward closest approach. Slant range decreases while the reflector remains stationary.'],
  ['Watch the returning cycles', 'A shorter round trip changes which part of the carrier cycle arrives at the receiver.'],
  ['Read the phase wheel', 'One full turn of the vector is one cycle, or 2π radians.'],
  ['Plot phase against slow time', 'Unwrapped phase keeps its accumulated rotations. The slope is largest where the path length changes fastest.'],
  ['Read Doppler from the slope', 'Divide the phase slope in radians per second by 2π to get cycles per second, or hertz.'],
  ['Compare approach and departure', 'Approach gives positive Doppler here. The shift crosses zero at closest approach and turns negative during departure.'],
  ['Move the reflector', 'The moving reflector follows a different range history, so its received phase diverges from the stationary prediction.'],
  ['Apply stationary phase correction', 'When the predicted phase is right, the corrected vectors align. Model mismatch can weaken, shift, or spread the reconstructed return.'],
]
const iqSteps = [
  ['Read I and Q', 'I is the horizontal coordinate and Q is the vertical coordinate. The arrow’s length is amplitude and its angle is phase.'],
  ['Compare equal magnitudes', 'A and B have the same amplitude. A points at 0° and B at 180°. Magnitude alone cannot distinguish them.'],
  ['Add opposite vectors', 'The equal and opposite I/Q vectors cancel. Adding their magnitudes would give the wrong answer.'],
  ['Collect vectors across the aperture', 'Successive echoes from the same target have different phases because the radar-to-target path changes.'],
  ['Undo predicted propagation phase', 'The processor rotates each complex sample by the predicted correction. At the right ground position the corrected arrows point together and the coherent sum grows.'],
]
const boards = { bandwidth: bandwidthSteps, 'bandwidth-review': reviewSteps.map(i => bandwidthSteps[i]), doppler: dopplerSteps, iq: iqSteps }
export const storyboard = kind => boards[kind]
export const bandwidthStage = (kind, step) => kind === 'bandwidth-review' ? reviewSteps[step] : step

export function conceptSeek(index, count, fraction = 0.001) {
  return (Math.min(count - 1, Math.max(0, index)) + fraction) / count
}
