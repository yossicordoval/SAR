const checks = {
  '0A-4': ['Two systems fly at the same speed for the same interval. One doubles PRF. What differs in raw data before processing?',
    ['It has roughly twice as many pulse rows with closer along-track spacing.','It has twice the chirp bandwidth in each row.','Each row moves to twice the slant range.'],0,
    'PRF counts observations per second. The single-pulse echo physics and flight distance are shared.'],
  '0A-5': ['Two platforms collect for the same duration at the same PRF. One doubles its speed. Which pair of changes should you predict?',
    ['Twice the distance and twice as many pulses.','Twice the path length and twice the distance between pulses.','Half the distance per pulse and the same aperture length.'],1,
    'The duration and PRF determine the number of observations. Speed scales both the path length and the spatial spacing.'],
  '0A-6': ['An isolated peak gets stronger without moving and without a change in its width. Which change fits best?',
    ['A shift in target position.','A wider transmitted band.','An increase in the scatterer’s return strength.'],2,
    'Changing the scatterer amplitude can raise the peak while leaving slant range and the chirp unchanged.'],
  '0A-7': ['The received background rises mainly over terrain patches, then shows structure after focusing. Which explanation best fits?',
    ['Distributed ground scatterers contribute coherent returns.','Independent receiver fluctuations always follow surface boundaries.','PRF physically roughens the ground.'],0,
    'Real echoes follow the illuminated terrain and can focus into structure. Additive electronic noise is generated at the receiver.'],
  '0A-8': ['A small peak emerges at the same delay after reducing receiver fluctuations. What can you conclude?',
    ['The reflector moved to that delay.','A return could have been present before and masked by noise.','The transmitted pulse narrowed because carrier increased.'],1,
    'Changing noise can improve evidence of a return without moving the scatterer or changing the waveform.'],
  '0A-9': ['A moving reflector still appears compact but offset from a registered map. Is the result compatible with motion?',
    ['No, every moving return is visibly smeared.','No, position is immune to phase mismatch.','Yes, motion can shift a peak as well as spread it.'],2,
    'Which effect dominates depends on direction, speed, viewing geometry, and duration.'],
  '0A-10': ['Two targets have equal speed. One moves across the line of sight and the other directly toward the radar. Subtracting platform motion, which has larger Doppler magnitude?',
    ['The one moving toward the radar.','They must have equal Doppler.','The one moving across the sight line.'],0,
    'The motion component along the sight line matters. Speed alone does not determine the shift.'],
  '0A-11': ['A target’s compressed peak moves right, but the known bandwidth stays the same. What additional evidence would support a position change?',
    ['More pixels without a delay change.','The raw trace also moves to longer delay at the same platform positions.','Only the color scale changes.'],1,
    'A changed range produces changed delays across the pass. Display changes cannot alter those delays.'],
  '0A-12': ['Higher numerical quality yields a smoother image. Which physical quantity should still match between runs?',
    ['Number of image pixels.','Numerical grid spacing.','Round-trip delay of the same reflector at the same pulse.'],2,
    'Finer numerical sampling can change the displayed reconstruction without changing the geometric propagation time.'],
  '0B-4': ['Two processors get samples +1 and −1. One stores only magnitude. Which can recover their coherent cancellation?',
    ['Only the processor with both I and Q.','Both, because the magnitudes are equal.','Only the magnitude processor.'],0,
    'The magnitude-only record contains 1 and 1 and loses the opposite directions. I and Q preserve the direction of each sample.'],
  '4': ['At closest approach, Doppler is instantaneously zero but the received phase is not zero. Which explanation fits?',
    ['The phase wheel stopped turning for an instant. Its angle can be anywhere.','Zero Doppler forces the phase angle to zero.','The carrier ceased oscillating.'],0,
    'Doppler is a rate of change. Zero instantaneous slope does not set the value of the phase itself.'],
}
export function reasoningCheck(lesson) {
  const check = checks[lesson.id]
  if (!check) return lesson
  const [prompt,options,correct,feedback] = check
  return { ...lesson, check:{prompt,options,correct,feedback} }
}
