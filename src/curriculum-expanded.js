import { C, DEFAULTS, QUALITY, pulseCount } from './physics.js'

const single = { ...DEFAULTS, scenario: 'study-point', targetX: 0, targetY: 0, clutter: false, noise: 0 }
const vehicle = { ...single, scenario: 'road' }
const moving = { ...vehicle, targetSpeed: 24, heading: 90 }
const pair = { ...single, scenario: 'study-pair', frequency: 56, bandwidth: 24, quality: 'high' }

const slider = (key, label, unit, min, max, step, extras) => ({ key, label, unit, min, max, step, ...extras })
const choices = (key, label, values, labels, view) => slider(key, label, '', 0, values.length - 1, 1, { values, labels, view })
const timing = slider('time', 'Flight time', 's', 0, 8, 0.25, { view: true })
const rawPulse = slider('pulseIndex', 'Acquired pulse index', '', 0, pulseCount(single)-1, 1, { view: true })
const processing = choices('stage', 'Processing stage', ['raw', 'range', 'migration', 'focused'],
  ['Raw echoes', 'Range compression', 'Reference alignment', 'Coherent focus'], true)
const altitude = slider('altitude', 'Platform altitude', 'm', 400, 680, 10)
const carrier = slider('frequency', 'Carrier frequency', 'MHz', 42, 70, 2)
const speed = slider('speed', 'Platform speed', 'm/s', 40, 140, 2)
const targetSpeed = slider('targetSpeed', 'Target speed', 'm/s', 0, 36, 2)
const position = slider('targetY', 'Target across-track position', 'm', -100, 100, 2)
const bandwidth = slider('bandwidth', 'Transmit bandwidth', 'MHz', 24, 72, 2)
const clutter = choices('clutter', 'Ground clutter', [false, true], ['Off', 'On'])
const noise = slider('noise', 'Receiver noise', 'relative units', 0, 0.8, 0.02)
const range = { label: 'Slant range', unit: 'm', digits: 1, read: (_, target) => target.range }
const delay = { label: 'Round-trip delay', unit: 'µs', digits: 2, read: (_, target) => target.delay * 1e6 }
const doppler = { label: 'Doppler', unit: 'Hz', digits: 2, read: (_, target) => target.doppler }
const radial = { label: 'Relative range rate', unit: 'm/s', digits: 2, read: (config, target) => -target.doppler * C / (2 * config.frequency * 1e6) }
const wrapped = { label: 'Wrapped propagation phase', unit: '°', digits: 1, read: (_, t) => Math.atan2(Math.sin(t.phase), Math.cos(t.phase)) * 180 / Math.PI }
const samples = { label: 'Pulses in full pass', unit: '', digits: 0, read: pulseCount }

function lesson(id, title, visual, control, content, overrides = {}) {
  const [intro, watch, predict, alternatives, why, math, bottom, check, wrong, changed, fixed] = content
  return {
    id, title, visual, intro, watch, why, math, bottom, changed, fixed,
    baseline: single, time: 4, instant: false, tab: 'range', stage: 'focused', profile: 'compressed',
    panels: ['geometry', 'signal'], metrics: [range, doppler], controls: [control], sceneLabel: 'Teaching scene',
    task: `Move “${control.label}” away from its baseline. Use the diagram and highlighted monitors to follow the change.`,
    predict: { prompt: predict, options: alternatives, correct: 0 },
    check: { prompt: check, options: [wrong, bottom], correct: 1, feedback: why },
    ...overrides,
  }
}

export const parameterLessons = [
  lesson('0A-4', 'Pulse repetition frequency', 'sampling', slider('prf', 'PRF', 'Hz', 4, 48, 1), [
    'PRF counts how many pulses the radar transmits each second.',
    'Compare the sample dots along the pass and on the phase waveform. The underlying motion is shared.',
    'What does a higher PRF give you over the same flight interval?', ['More samples of the changing geometry.', 'One longer chirp.', 'A faster platform.'],
    'Each transmission samples a new along-track position. Sparse measurements of a fast phase oscillation can also fit a slower oscillation. Doppler shown in the monitor is the geometric prediction. The sampling diagram shows why the measured phase can be ambiguous.',
    'Pulse spacing is 1/PRF in seconds and speed/PRF in metres for this constant-speed pass.',
    'Higher PRF → denser slow-time samples → less risk of ambiguous Doppler.',
    'What improves when you increase PRF at fixed speed?', 'The bandwidth of each pulse doubles.',
    'Pulse count and spacing along the path.', 'Flight path, observation duration, and transmitted chirp.',
  ], { time: 7, tab: 'doppler', metrics: [samples, { label: 'Along-track sample spacing', unit: 'm', digits: 2, read: c => c.speed / c.prf }] }),
  lesson('0A-5', 'Platform speed', 'sampling', speed, [
    'Compare two passes over the same observation interval.',
    'Follow the platform dots, slant-range histories, and Doppler curves.',
    'What does greater speed change at fixed PRF and duration?', ['A longer path and wider pulse spacing.', 'More pulses along the same path.', 'A shorter chirp.'],
    'Moving faster covers more aperture in the same time and changes the slant-range and phase histories faster. The fixed PRF must still sample those changes adequately.',
    'Travel distance is speed × time. Along-track spacing is speed/PRF. Echo phase is −4πR/λ.',
    'Faster flight covers more aperture while spreading the same samples farther apart.',
    'What trade-off comes with greater speed at fixed PRF?', 'Faster always guarantees a sharper image.',
    'Distance covered, sample spacing, and the phase and Doppler histories.', 'Observation interval and PRF.',
  ], { time: 6, tab: 'doppler', metrics: [range, wrapped, doppler, { label: 'Distance observed', unit: 'm', digits: 0, read: c => c.speed * 6 }] }),
  lesson('0A-6', 'Radar cross section & reflectivity', 'reflection', slider('rcs', 'Model reflectivity', '×', 0.2, 2, 0.1), [
    'Radar Cross Section (RCS) describes how strongly an object scatters radar energy toward the receiver.',
    'Keep the target in place and compare the strength of its returned wave and peak.',
    'What happens when the model reflectivity increases?', ['The echo grows at the same delay.', 'The echo arrives earlier.', 'The pulse sweeps a larger band.'],
    'RCS is an effective scattering area that can depend on viewing angle and wavelength. This teaching model scales echo amplitude directly by a relative strength knob.',
    'The simulator uses amplitude proportional to strength × (reference range / actual range)², with an illumination factor.',
    'Stronger scattering → higher return magnitude at the same delay.',
    'What changes if only relative reflectivity increases?', 'The target moves in range.',
    'The model echo amplitude.', 'Target geometry and timing.',
  ], { baseline: vehicle, instant: true, magnitude: 12, metrics: [range, { label: 'Amplitude multiplier', unit: '×', digits: 1, read: c => c.rcs }] }),
  lesson('0A-7', 'Ground clutter', 'clutter', clutter, [
    'The illuminated ground contains many small scatterers.',
    'Watch the additional returns fill the Range Profile when ground clutter is enabled.',
    'What will happen when you include ground returns?', ['Many weak echoes will overlap the target echo.', 'Only receiver electronics will change.', 'All ranges except the target will disappear.'],
    'Every illuminated patch adds a delayed complex echo. Contributions can reinforce or cancel. Focused clutter can remain visible in a SAR image.',
    'The receiver adds I and Q contributions before computing magnitude.',
    'Ground clutter comes from physical scattering across the illuminated scene.',
    'Why can clutter remain after focusing?', 'Image formation automatically deletes all ground echoes.',
    'Distributed ground reflections enter the receiver.', 'Target, waveform, and receiver noise.',
  ], { instant: true, magnitude: 12, zoom: 175, panels: ['optical', 'signal', 'image'] }),
  lesson('0A-8', 'Receiver noise', 'noise', noise, [
    'Receiver electronics can contribute fluctuations even without a strong echo.',
    'Watch the fluctuations on either side of the weak target peak.',
    'How does greater receiver noise affect a weak return?', ['It becomes harder to distinguish.', 'Its true range changes.', 'Its carrier changes.'],
    'Signal-to-noise ratio compares signal power to noise power. The simulator adds seeded, independent fluctuations to I and Q.',
    'Holding signal power fixed while noise power rises lowers SNR = signal power / noise power.',
    'More receiver noise → weaker detectability at fixed echo strength.',
    'Does a higher noise setting change the target’s true range?', 'Yes, more noise shifts the target.',
    'The amplitude of receiver fluctuations.', 'The target return and its physical delay.',
  ], { baseline: { ...vehicle, rcs: 0.2 }, instant: true, profile: 'range', zoom: 80 }),
  lesson('0A-9', 'Target speed', 'motion', targetSpeed, [
    'Target motion during a pass changes the sequence of ranges and phases measured by the radar.',
    'Compare the dashed stationary reference with the measured Doppler and focused image.',
    'What happens if the target moves during the pass?', ['Its range and phase histories diverge from the stationary prediction.', 'Only its reflectivity changes.', 'SAR automatically tracks it.'],
    'A processor focusing at fixed ground positions expects stationary geometry. A moving target’s actual phase can accumulate with the wrong correction and appear shifted or smeared.',
    'R(t) = |target(t) − platform(t)|, with Doppler proportional to dR/dt.',
    'Target motion alters range and phase history and can shift or defocus the reconstruction.',
    'What causes moving-target defocus?', 'The pulse stops reflecting when the target moves.',
    'Target positions during the pass and resulting range, phase, and Doppler.', 'Stationary focusing assumption and radar waveform.',
  ], { baseline: { ...moving, targetSpeed: 0 }, time: 7, tab: 'doppler', panels: ['geometry', 'signal', 'image'] }),
  lesson('0A-10', 'Target heading & line of sight', 'vectors', slider('heading', 'Target heading', '°', 0, 360, 1), [
    'Only velocity projected onto the line of sight contributes to instantaneous range rate.',
    'Turn the heading and compare its projection, the simulated range rate, and Doppler.',
    'When is the target’s contribution to instantaneous radial velocity near zero?', ['When target motion is perpendicular to the line of sight.', 'Whenever the target moves quickly.', 'Whenever it moves away.'],
    'The projection of target velocity contributes to relative range rate along with the platform’s motion. Approaching motion reduces range and produces positive Doppler in this convention.',
    'vᵣ = (v_target − v_platform) · R̂, with R̂ pointing from radar to target. fᴅ = −2vᵣ/λ.',
    'Rotating velocity changes its radial projection and therefore the Doppler shift.',
    'What does perpendicular target motion contribute at that instant?', 'The largest possible radial component.',
    'The relative radial velocity and Doppler.', 'Target speed and carrier wavelength.',
  ], { baseline: { ...moving, heading: 0 }, time: 4, tab: 'doppler', metrics: [radial, doppler] }),
  lesson('0A-11', 'Target position', 'motion', position, [
    'Move a stationary target across track and observe its different distance from the same platform.',
    'Compare the sight line, range history, raw curve, and image location.',
    'What changes if the target moves farther across track?', ['Delay and the range history.', 'Pulse duration alone.', 'PRF alone.'],
    'Every observation has a new slant range when the target’s location changes. That changes where the echo lands in each pulse and affects its Doppler history and reconstruction location.',
    'At each pulse, round-trip delay is 2R/c.',
    'A new ground position changes the complete delay history used to locate the target.',
    'Why does the raw trace move with target position?', 'Changing position changes the carrier frequency.',
    'The target’s geometry, delay, and image position.', 'Transmitted waveform and target strength.',
  ], { panels: ['geometry', 'signal', 'raw', 'image'] }),
  lesson('0A-12', 'Simulation quality', 'quality', choices('quality', 'Simulation quality', ['interactive', 'medium', 'high'], ['Interactive', 'Medium', 'High']), [
    'Quality controls computational sampling of the same model.',
    'Compare the diagram’s sampling grids and the image pixel count.',
    'What changes when quality is raised?', ['Numerical sampling becomes denser.', 'The physical range decreases.', 'Each pulse acquires more bandwidth.'],
    'Quality changes the number of simulated cells, ground samples, and image pixels. The dimensions are discretized more finely, while the underlying geometry, chirp and PRF stay the same.',
    'Grid spacing is the physical extent divided by the number of grid intervals.',
    'A finer numerical grid samples the same physics more densely.',
    'What does image sampling quality change?', 'The true target geometry.',
    'Numerical sample counts and reconstruction grid size.', 'Radar geometry, bandwidth, and PRF.',
  ], { panels: ['optical', 'image'], metrics: [range, { label: 'Reconstruction pixels', unit: '', digits: 0, read: c => QUALITY[c.quality].width * QUALITY[c.quality].height }] }),
]

export const monitorLessons = [
  lesson('0B-1', 'Ground Truth monitor', 'truth', position, [
    'Ground Truth shows privileged simulator coordinates and object identities.',
    'Compare the known location with the image inferred from echoes.',
    'Which view knows the target’s exact coordinates before observing echoes?', ['Ground Truth.', 'The focused image.', 'The Raw SAR monitor.'],
    'The simulator uses the known scene to synthesize measurements. A real receiver only measures signals and cannot inspect this scene description.',
    'The forward model maps scene coordinates and scattering strengths to complex echoes.',
    'Ground Truth is the known input scene used to assess the reconstruction.',
    'Which view can serve as a reference for image accuracy?', 'A single noisy sample.',
  ], { panels: ['optical', 'image'] }),
  lesson('0B-2', 'Radar Geometry monitor', 'delay', altitude, [
    'The geometry monitor shows the platform, line of sight, and ground footprint.',
    'Follow the selected sight line from the platform to the reflector.',
    'Which length determines when an echo arrives?', ['The slant path length.', 'The projected ground distance alone.', 'The flight path length.'],
    'Altitude is vertical height. The line of sight is the diagonal between platform and selected target. This diagonal determines echo delay.',
    'Slant range is the Euclidean distance in three dimensions.',
    'Radar Geometry connects the selected line of sight to the signal delay.',
    'Which relationship does this view make visible?', 'Altitude always equals slant range.',
  ], { instant: true, metrics: [range, delay] }),
  lesson('0B-3', 'Range Profile monitor', 'delay', choices('sceneMix', 'Scene contributions', [0, 1, 2, 3], ['One reflector', 'Two reflectors', 'Add ground clutter', 'Add receiver noise'], true), [
    'A Range Profile displays echo magnitude against one-way range for a single pulse.',
    'Add a reflector, then ground scattering and receiver noise. Watch how each contributes to the profile.',
    'Where does a later echo appear?', ['Farther right.', 'Farther left.', 'At zero range.'],
    'Echoes are spaced by arrival time. The receiver compresses the chirp and converts the delay coordinate to distance. Distributed clutter and noise can obscure weak peaks.',
    'Range coordinate = c × delay / 2.',
    'The Range Profile places each received echo at its equivalent slant range.',
    'How is the horizontal coordinate assigned?', 'Targets are sorted by brightness.',
  ], { time: 4, instant: true, zoom: 170, sceneMix: 0, magnitude: 12, metrics: [range, delay] }),
  lesson('0B-4', 'I/Q monitor', 'phasor', position, [
    'Each complex receiver sample has an in-phase component I and a quadrature component Q.',
    'Move the reflector and watch its propagation phase change. The diagram also adds a second illustrative contribution.',
    'How do two simultaneous scatterer echoes combine?', ['Their complex vectors add.', 'Their magnitudes always add.', 'Their phases are discarded.'],
    'I and Q are the horizontal and vertical components of a complex vector. Coherent summation can reinforce or cancel even when both echoes are strong.',
    'Magnitude = √(I² + Q²). Phase = atan2(Q, I).',
    'I and Q preserve both magnitude and phase for coherent processing.',
    'Why keep both I and Q?', 'One real number always gives the full phase.',
  ], { tab: 'iq', instant: true, metrics: [range, wrapped] }),
  lesson('0B-5', 'Doppler monitor', 'motion', timing, [
    'The moving platform changes distance to a stationary reflector throughout the pass.',
    'Scrub through closest approach and follow the point on the Doppler trace.',
    'What happens to the Doppler sign across closest approach?', ['It reverses.', 'It stays positive throughout.', 'It depends on echo brightness.'],
    'On approach the travel path shortens and the received phase advances. On departure the path lengthens and the phase retreats.',
    'Doppler is the rate of received phase change in cycles per second.',
    'Doppler follows range rate and crosses zero at the instant of closest approach.',
    'Why can a stationary target produce Doppler?', 'A fixed target must reflect a new carrier.',
  ], { time: 0, tab: 'doppler', metrics: [range, radial, doppler] }),
  lesson('0B-6', 'Raw SAR data monitor', 'matrix', rawPulse, [
    'The raw matrix stacks the complex echo samples of successive pulses. Brightness displays their magnitude.',
    'Scrub forward to add pulse rows. The geometry and highlighted endpoint follow the same acquired pulse.',
    'Why does a stationary reflector draw a curve?', ['Platform motion changes its slant range.', 'Each pulse changes the carrier.', 'The reflector follows the curve on the ground.'],
    'Each transmission contributes one row. As the platform approaches, the selected echo moves toward shorter range and then back toward longer range.',
    'R(t) = √(R₀² + x(t)²) for this stationary target and straight flight path. R₀ is the closest slant range.',
    'A curved raw trace records changing slant range across repeated observations.',
    'What does one raw-data row represent?', 'One ground pixel.',
  ], { time: 0, pulseIndex: 0, stage: 'raw', panels: ['geometry', 'signal', 'raw'], metrics: [range, delay] }),
  lesson('0B-7', 'Processing stages', 'processing', processing, [
    'Follow the same acquisition through the processing views.',
    'Switch among raw, range-compressed, reference-aligned and focused views. Replay the diagram for the intermediate transformations.',
    'What does range compression do first?', ['It localizes a long echo in delay.', 'It creates more pulses.', 'It changes the target’s position.'],
    'Range compression matches the chirp in each pulse. Reference alignment makes the selected stationary history easier to inspect. Backprojection focuses by sampling and phase-aligning each pixel’s predicted history directly.',
    'Coherent backprojection sums complex samples after applying the predicted propagation-phase correction.',
    'Range compression localizes delay and coherent focusing combines phase across the aperture.',
    'What makes coherent summation concentrate energy at a ground point?', 'Adding magnitudes alone.',
  ], { stage: 'raw', time: 6, panels: ['raw', 'image'] }),
  lesson('0B-8', 'Final SAR image monitor', 'focus', timing, [
    'The focused image estimates where strong scatterers are on the ground.',
    'Build up the aperture and compare the reconstructed spot to Ground Truth.',
    'What helps the focused image localize the reflector along track?', ['Coherently combining observations from multiple positions.', 'One stronger single pulse alone.', 'Knowing its label.'],
    'At the correct candidate pixel the expected phase correction aligns echoes. At nearby incorrect pixels, residual phases vary and their sum is weaker.',
    'Image magnitude is the absolute value of the phase-corrected complex sum.',
    'Coherent observations from multiple positions localize the ground scatterer.',
    'What can narrow the along-track response?', 'A label placed on the target in advance.',
  ], { time: 0, panels: ['optical', 'image'] }),
]

const aperture = choices('pulses', 'Acquired pulses', [1, 5, 20, 50, pulseCount(single)], ['1', '5', '20', '50', 'Full aperture'], true)
export const processLessons = [
  lesson('1', 'The complete SAR process', 'chain', processing, [
    'Follow one stationary reflector from transmission to a reconstructed ground point.',
    'Replay the visual sequence, then follow the same observations through the processing monitor.',
    'What does the reconstruction combine?', ['Complex echoes from repeated observations.', 'A picture from Ground Truth.', 'The movement of display pixels.'],
    'The emitted chirp travels out, scatters, and returns as I/Q samples. Repeated pulses form the raw matrix. Compression narrows the delay response. Reference alignment illustrates migration. Backprojection follows each predicted range and corrects its phase to focus the reflector.',
    'At a candidate position, interpolate the compressed return at predicted R(t) and rotate by +4πR(t)/λ before summing.',
    'SAR reconstructs ground reflectivity from repeated phase-preserving observations.',
    'Why repeat the transmission as the platform moves?', 'SAR needs multiple independent pictures of Ground Truth.',
  ], { stage: 'raw', time: 6, panels: ['geometry', 'signal', 'raw', 'image'] }),
  lesson('2', 'Two reflectors & range resolution', 'bandwidth', bandwidth, [
    'Two nearby stationary reflectors generate two delayed copies of the transmitted chirp.',
    'Change bandwidth and compare the compressed peaks and focused image.',
    'What can separate two nearby delays?', ['A wider chirp bandwidth.', 'A higher PRF alone.', 'A longer pass alone.'],
    'A broad sweep gives a better-defined delay match and narrows the compressed response while the physical echoes still overlap.',
    'Ideal slant-range resolution is approximately c/(2B).',
    'Wider bandwidth improves separation of reflectors with distinct close delays.',
    'What improves delay discrimination?', 'Merely collecting echoes more often.',
  ], { baseline: pair, zoom: 12, magnitude: 6, time: 4, panels: ['signal', 'image'], targets: [{ id: 'point-a', label: 'Reflector A' }, { id: 'point-b', label: 'Reflector B' }] }),
  lesson('3', 'Synthetic aperture & azimuth localization', 'focus', aperture, [
    'Build the reconstruction from 1, 5, 20, 50, or all acquired pulses.',
    'Follow the increasing spatial extent of the sampled flight path and the image’s along-track response.',
    'Which change usually improves along-track localization here?', ['A longer coherently observed aperture.', 'A second receiver-noise source.', 'One pulse with the same bandwidth.'],
    'An extended aperture provides a variety of sight lines and phase histories. Candidate ground pixels are easier to distinguish when more different observations constrain the coherent sum.',
    'The processor tests the range history predicted for each pixel across the observed aperture.',
    'A longer, adequately sampled coherent aperture can sharpen along-track localization.',
    'What supplies the along-track information?', 'A single pulse’s delay by itself.',
  ], { time: 0, panels: ['geometry', 'raw', 'image'] }),
  lesson('4', 'Doppler & phase history', 'phasor', carrier, [
    'Doppler tells how quickly echo phase changes. The phase history is needed for focusing.',
    'Compare Doppler and replay the phase wheel, then inspect the current focused point.',
    'How does larger Doppler magnitude affect phase?', ['It changes more cycles per second.', 'It fixes phase at zero.', 'It changes the flight path.'],
    'The echo phase winds as the range changes. A pixel’s predicted propagation phase is removed before summation so a stationary return adds coherently.',
    'fᴅ = (1/2π) dφ/dt, with propagation phase φ = −4πR/λ.',
    'Doppler is phase rate. Focusing uses the phase history across pulses.',
    'What does coherent focusing need to account for?', 'Only the average magnitude over time.',
  ], { time: 6, tab: 'doppler', panels: ['signal', 'image'], metrics: [wrapped, doppler] }),
  lesson('5', 'Moving target & stationary focus', 'motion', targetSpeed, [
    'Compare the same ground target under stationary and moving assumptions.',
    'Watch the expected and actual range histories diverge and inspect the resulting focus.',
    'What can result from applying stationary focusing to a moving target?', ['A shifted or smeared response.', 'A change in carrier frequency at the transmitter.', 'Perfect motion tracking.'],
    'Motion changes the slant ranges and phase accumulated across the pass. The stationary prediction can disagree enough to shift the strongest response or spread energy.',
    'The uncompensated phase error is −4π(R_actual − R_predicted)/λ.',
    'Unmodeled target motion can shift or defocus a SAR reconstruction.',
    'Why does the strongest image response move or spread?', 'The receiver changes the number of transmitted pulses.',
  ], { baseline: { ...moving, targetSpeed: 0 }, time: 7, tab: 'doppler', panels: ['geometry', 'raw', 'image'] }),
]

export function studyScene(index) {
  if (index === 0) return single
  return { ...pair, bandwidth: 72, clutter: index >= 2, noise: index === 3 ? 0.35 : 0 }
}
