import { curriculum } from './curriculum.js'

const terms = {
  'DEM': 'Digital elevation model. A grid that gives a ground height at each map location.',
  'chirp': 'One radar pulse whose frequency changes during transmission. This simulator sweeps it steadily from low to high.',
  'matched filter': 'A receiver operation that slides a copy of the transmitted pulse across the echoes and measures how well they line up.',
  'phase': 'Where a wave is in its cycle. A full rotation is 360 degrees or 2π radians.',
  'coherent': 'Keeping track of wave phase when adding signals, so they can reinforce or cancel.',
  'aperture': 'The stretch of a flight path over which the radar combines observations to form an image.',
  'ambiguity': 'Different physical situations that could produce the same measurements.',
  'aliasing': 'When spaced-out samples make a fast oscillation look like a slower one.',
  'range cell': 'One small interval of slant range on the sampled echo axis.',
  'migration': 'An echo moving between range cells across pulses as the radar-to-target distance changes.',
  'backprojection': 'For each candidate image location, read the echoes at its predicted delays, undo the predicted phase shifts, and add them.',
  'incidence angle': 'The angle between the incoming radar ray and the perpendicular to the surface at the point it hits.',
  'speckle': 'Grainy bright and dark patches caused by many small echoes reinforcing or cancelling within one image cell.',
  'layover': 'When a tall object’s top is nearer the radar than its base and appears in front of it in range.',
  'foreshortening': 'A slope facing the radar occupying less image distance in range than it does along the ground.',
  'RCS': 'Radar Cross Section. A measure of how strongly an object scatters energy back toward the radar.',
  'PRF': 'Pulse Repetition Frequency. The number of times the radar transmits a pulse each second.',
  'I/Q': 'In-phase and quadrature. The two coordinates of the received wave vector, which together preserve amplitude and phase.',
  'slant range': 'The straight-line distance from the radar to a target.',
  'slow time': 'Time measured along the flight, from one transmitted pulse to the next.',
  'Doppler': 'A frequency shift caused by changing path length between the radar and the target.',
  'bandwidth': 'The difference between the highest and lowest frequencies in one transmitted waveform.',
  'quadrature': 'The vertical coordinate of the complex wave vector, measured one quarter-cycle away from the in-phase reference.',
  'azimuth': 'The along-track direction, parallel to the platform flight path in this simulator.',
}
const lessons = [...curriculum[4].lessons,...curriculum[5].lessons,...curriculum[0].lessons]
const parameters = new Map(lessons.flatMap(lesson => lesson.controls.map(control => [control.key,lesson])))
parameters.set('targetX', parameters.get('targetY'))

export function parameterInfo(key, label) {
  return `<button type="button" class="info-button" data-parameter-info="${key}" aria-label="About ${label}" aria-haspopup="dialog">ⓘ</button>`
}

const patterns = Object.keys(terms).sort((a,b) => b.length-a.length).join('|')
const glossaryPattern = new RegExp(`\\b(${patterns})\\b`, 'gi')
export function explainTerms(text, seen) {
  return text.replace(glossaryPattern, match => {
    const key = Object.keys(terms).find(term => term.toLowerCase() === match.toLowerCase())
    if (seen.has(key)) return match
    seen.add(key)
    return `<button type="button" class="glossary-term" data-glossary="${key}" aria-haspopup="dialog" title="${terms[key]}">${match}</button>`
  })
}

export function installLearningInfo(dialog) {
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-parameter-info], [data-glossary]')
    if (!button) return
    const term = button.dataset.glossary
    const item = parameters.get(button.dataset.parameterInfo)
    const custom = button.dataset.infoTitle
    if (!term && !item && !custom) return
    dialog.querySelector('h2').textContent = term ? button.textContent : custom || item.title
    dialog.querySelector('[data-info-summary]').textContent = term ? terms[term] : button.dataset.infoSummary || item.bottom
    const details = dialog.querySelector('details')
    details.hidden = Boolean(term)
    details.open = false
    details.querySelector('p').textContent = term ? '' : button.dataset.infoDetails || item?.why || ''
    dialog.showModal()
  })
}
