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
  ], { instant: true, magnitude: 12, zoom: 175, compareImage: true, panels: ['optical', 'signal', 'image'] }),
  lesson('0A-8', 'Receiver noise', 'noise', noise, [
    'Receiver electronics can contribute fluctuations even without a strong echo.',
    'Watch the fluctuations on either side of the weak target peak.',
    'How does greater receiver noise affect a weak return?', ['It becomes harder to distinguish.', 'Its true range changes.', 'Its carrier changes.'],
    'Signal-to-noise ratio compares signal power to noise power. The simulator adds seeded, independent fluctuations to I and Q.',
    'Holding signal power fixed while noise power rises lowers SNR = signal power / noise power.',
    'More receiver noise → weaker detectability at fixed echo strength.',
    'Does a higher noise setting change the target’s true range?', 'Yes, more noise shifts the target.',
    'The amplitude of receiver fluctuations.', 'The target return and its physical delay.',
  ], { baseline: { ...vehicle, rcs: 0.2 }, instant: true, profile: 'range', zoom: 80, compareImage: true, panels: ['signal','image'] }),
  lesson('0A-9', 'Target speed', 'motion', targetSpeed, [
    'Target motion during a pass changes the sequence of ranges and phases measured by the radar.',
    'Compare the dashed stationary reference with the measured Doppler and focused image.',
    'What happens if the target moves during the pass?', ['Its range and phase histories diverge from the stationary prediction.', 'Only its reflectivity changes.', 'SAR automatically tracks it.'],
    'A processor focusing at fixed ground positions expects stationary geometry. A moving target’s actual phase can accumulate with the wrong correction and appear shifted or smeared.',
    'R(t) = |target(t) − platform(t)|, with Doppler proportional to dR/dt.',
    'Target motion alters range and phase history and can shift or defocus the reconstruction.',
    'What causes moving-target defocus?', 'The pulse stops reflecting when the target moves.',
    'Target positions during the pass and resulting range, phase, and Doppler.', 'Stationary focusing assumption and radar waveform.',
  ], { baseline: { ...moving, targetSpeed: 0 }, time: 7, tab: 'doppler', compareImage: true, panels: ['geometry', 'signal', 'image'] }),
  lesson('0A-10', 'Target heading & line of sight', 'vectors', slider('heading', 'Target heading', '°', 0, 360, 1), [
    'Only velocity projected onto the line of sight contributes to instantaneous range rate.',
    'Turn the heading and compare its projection, the simulated range rate, and Doppler.',
    'When is the target’s contribution to instantaneous radial velocity near zero?', ['When target motion is perpendicular to the line of sight.', 'Whenever the target moves quickly.', 'Whenever it moves away.'],
    'The projection of target velocity contributes to relative range rate along with the platform’s motion. Approaching motion reduces range and produces positive Doppler in this convention.',
    'vᵣ = (v_target − v_platform) · R̂, with R̂ pointing from radar to target. fᴅ = −2vᵣ/λ.',
    'Rotating velocity changes its radial projection and therefore the Doppler shift.',
    'What does perpendicular target motion contribute at that instant?', 'The largest possible radial component.',
    'The relative radial velocity and Doppler.', 'Target speed and carrier wavelength.',
  ], { baseline: { ...moving, heading: 0 }, time: 4, tab: 'doppler', compareImage: true, panels: ['geometry','signal','image'], metrics: [radial, doppler] }),
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
  ], { panels: ['optical', 'image'], compareImage: true, metrics: [range, { label: 'Reconstruction pixels', unit: '', digits: 0, read: c => QUALITY[c.quality].width * QUALITY[c.quality].height }] }),
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
  lesson('0B-4', 'I/Q monitor', 'iq', position, [
    'Each complex receiver sample has an in-phase component I and a quadrature component Q.',
    'Move the reflector and watch its propagation phase change. The diagram also adds a second illustrative contribution.',
    'How do two simultaneous scatterer echoes combine?', ['Their complex vectors add.', 'Their magnitudes always add.', 'Their phases are discarded.'],
    'I and Q preserve a sample’s amplitude and phase. Two equal samples at 0° and 180° cancel when added, even though their magnitudes match. The processor uses predicted propagation to rotate samples from the same ground location into alignment before adding them.',
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
  lesson('2', 'Two reflectors & range resolution', 'bandwidth-review', bandwidth, [
    'Two nearby stationary reflectors generate two delayed copies of the transmitted chirp.',
    'Change bandwidth and compare the compressed peaks and focused image.',
    'What can separate two nearby delays?', ['A wider chirp bandwidth.', 'A higher PRF alone.', 'A longer pass alone.'],
    'A broad sweep gives a better-defined delay match and narrows the compressed response while the physical echoes still overlap.',
    'Ideal slant-range resolution is approximately c/(2B).',
    'Wider bandwidth improves separation of reflectors with distinct close delays.',
    'What improves delay discrimination?', 'Merely collecting echoes more often.',
  ], { baseline: pair, compareImage: true, zoom: 12, magnitude: 6, time: 4, panels: ['signal', 'image'], targets: [{ id: 'point-a', label: 'Reflector A' }, { id: 'point-b', label: 'Reflector B' }] }),
  lesson('3', 'Synthetic aperture & azimuth localization', 'focus', aperture, [
    'Build the reconstruction from 1, 5, 20, 50, or all acquired pulses.',
    'Follow the increasing spatial extent of the sampled flight path and the image’s along-track response.',
    'Which change usually improves along-track localization here?', ['A longer coherently observed aperture.', 'A second receiver-noise source.', 'One pulse with the same bandwidth.'],
    'An extended aperture provides a variety of sight lines and phase histories. Candidate ground pixels are easier to distinguish when more different observations constrain the coherent sum.',
    'The processor tests the range history predicted for each pixel across the observed aperture.',
    'A longer, adequately sampled coherent aperture can sharpen along-track localization.',
    'What supplies the along-track information?', 'A single pulse’s delay by itself.',
  ], { time: 4, baseline:{...single,quality:'high'}, panels: ['geometry', 'raw', 'image'], compareImage: true,
    metricGuide: '−3 dB width measures the connected peak down to half power on the along-track cut through the reflector. A dash means the response reaches the edge. The pulse window stays centered near closest approach.',
    metrics: [
      { label: 'Pulses used', unit: '', digits: 0, read: (c,t,p,m) => m?.pulses },
      { label: 'Coherent aperture', unit: 'm', digits: 1, read: (c,t,p,m) => m?.aperture },
      { label: 'Along-track −3 dB width', unit: 'm', digits: 1, read: (c,t,p,m) => m?.azimuthWidth },
    ] }),
  lesson('4', 'Doppler & phase history', 'doppler', carrier, [
    'Doppler tells how quickly echo phase changes. The phase history is needed for focusing.',
    'Compare Doppler and replay the phase wheel, then inspect the current focused point.',
    'How does larger Doppler magnitude affect phase?', ['It changes more cycles per second.', 'It fixes phase at zero.', 'It changes the flight path.'],
    'As the platform approaches the reflector, slant range decreases and received phase advances. The slope of unwrapped phase is Doppler. After closest approach, increasing range reverses the sign. A moving target changes the phase history and can defeat stationary phase correction.',
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
  ], { baseline: { ...moving, targetSpeed: 0 }, time: 7, tab: 'doppler', compareImage: true, panels: ['geometry', 'raw', 'image'] }),
]

export function studyScene(index) {
  if (index === 0) return single
  return { ...pair, bandwidth: 72, clutter: index >= 2, noise: index === 3 ? 0.35 : 0 }
}

const evidence = (id, title, visual, control, baseline, prompt, options, correct, why, extra = {}) => lesson(
  id,title,visual,control,[
    'Inspect the reconstructed image as evidence. Then change one acquisition or scene assumption and test your interpretation.',
    'Compare the bright responses and their shape across range and along track. The green ground-truth marker appears when you reach Explain.',
    prompt,options,why,'A SAR image is the magnitude of a coherent sum evaluated at candidate ground locations.',
    why,prompt,options[(correct+1)%options.length],
  ],{ baseline, time: 7, evidence: true, compareImage: true, panels: ['image','signal'],
    predict: { prompt,options,correct }, check: extra.check ?? { prompt,options,correct,feedback: why }, ...extra }
)

export const analysisLessons = [
  evidence('2-1','Count distinguishable reflectors','focus',noise,{...single,scenario:'study-several',noise:.32,quality:'medium'},
    'How many dominant compact returns stand out over the rest of the image?',
    ['One dominant return.','Two dominant returns, with weaker evidence elsewhere.','Every visible bright pixel is a separate object.'],1,
    'A compact peak supports a scattering location. Closely spaced targets can merge, weak targets can disappear, and clutter can produce peaks.', {
      check:{prompt:'The background falls when noise is reduced and a third stable peak becomes visible. What changed?',options:['The scene acquired another target.','A previously obscured return became distinguishable.','The carrier wavelength grew.'],correct:1,feedback:'Lower receiver noise can reveal an existing return. Count distinguishable responses before inferring an exact object count.'},
    }),
  evidence('2-2','Recognize moving-target signatures','motion',targetSpeed,{...moving,targetSpeed:28},
    'A response is displaced relative to a registered map and becomes tighter after accounting for motion. What does that support?',
    ['Target motion is a plausible explanation.', 'The two images prove its complete velocity.', 'A wider chirp must have moved the target.'],0,
    'An unmodeled moving target can shift or spread because the stationary phase correction is wrong. A displacement alone is not proof of motion.', {
      check:{prompt:'Which competing explanation should you check before concluding a displaced response is moving?',options:['The display font changed.','The vehicle has a different name.','A map registration or trajectory error.'],correct:2,feedback:'An independent registration or trajectory error can also move apparent positions. Compare stable reference targets.'},
    }),
  evidence('2-3','Compare range and azimuth blur','bandwidth-review',bandwidth,pair,
    'Two scenes share the same flight path. In one image, closely spaced range responses separate. Which change best fits?',
    ['More receiver noise.', 'The same bandwidth with a different display color.', 'A wider transmitted sweep.'],2,
    'Extra chirp bandwidth improves discrimination between close delays. A longer aperture primarily adds along-track information.', { time:4, magnitude:6, zoom:12,
      check:{prompt:'You separate the range responses, but one still stretches along track. Which change addresses the remaining blur?',options:['Only increase receiver noise.','Collect a longer well-sampled coherent aperture.','Separate the center frequencies of the targets.'],correct:1,feedback:'Bandwidth narrows a delay response. More spatially distinct coherent samples improve along-track localization.'} }),
  evidence('2-4','Infer radial motion from Doppler','vectors',slider('heading','Target heading','°',0,360,1),{...moving,heading:90},
    'After accounting for the platform, a target at λ = 6 m has Doppler +4 Hz. What can you infer?',
    ['It must be travelling north at 12 m/s.', 'Its radial contribution is −12 m/s, toward the sensor.', 'Its radial contribution is +24 m/s, away from the sensor.'],1,
    'Use vᵣ = −λfᴅ/2. A single monostatic frequency shift gives a line-of-sight component, with many possible full velocity vectors.', { time:4, tab:'doppler', metrics:[radial,doppler],
      check:{prompt:'A second vehicle has the same Doppler after accounting for platform motion. Which inference is justified?',options:['It has the same line-of-sight velocity component.','It follows the same heading.','Its speed must be equal in all directions.'],correct:0,feedback:'Doppler constrains the radial component. The perpendicular component remains unknown.'} }),
  evidence('2-5','Choose a sharpening strategy','focus',aperture,single,
    'A stationary point forms a thin range arc from one pulse. What would best localize it along track?',
    ['Combine a longer, adequately sampled coherent aperture.', 'Use the same pulse twice.', 'Change only the display contrast.'],0,
    'A sequence from different positions provides distinct path lengths. Correcting and summing those phases can localize a stationary return along track.', { time:4, baseline:{...single,quality:'high'} }),
]

const advanced = (id,title,visual,control,baseline,prompt,options,correct,why,extra) =>
  ({ ...evidence(id,title,visual,control,baseline,prompt,options,correct,why,extra), evidence:false,
    intro: 'Compare the measured echo with the geometry or surface that produced it.',
    watch: 'Compare the highlighted monitors and the baseline/current results.' })

export const advancedLessons = [
  advanced('3-1','Off-nadir geometry & incidence','delay',slider('look','Off-nadir angle','°',18,53,1),single,
    'With altitude fixed, which look uses a longer slant path?', ['A steeper downward look.', 'A more sideways look.', 'Both have equal paths.'],1,
    'A more sideways look lengthens the path to the flat ground. Over a slope, local incidence is measured from the slope normal and can differ from the look angle. Use the terrain geometry when comparing backscatter.', { instant:true, metrics:[range,delay] }),
  advanced('3-2','Urban shadows & strong corners','environment',choices('urbanDensity','Building density',['sparse','medium','dense'],['Sparse','Medium','Dense']),
    {...vehicle,scenario:'urban',urbanDensity:'sparse',clutter:true},
    'A dark strip lies behind a tall block. Which observation best tests whether it is radar shadow?',
    ['Observe from a different side and see whether the dark strip moves.', 'Turn up display gain until it vanishes.', 'Double the PRF from the same look direction.'],0,
    'An opaque obstruction can hide part of the scene. More viewing angles can fill missing coverage. Wall-ground corners can give bright returns. This model uses geometric occlusion and simplified corner scatterers.', { panels:['optical','geometry','image'], magnitude:15, zoom:170 }),
  advanced('3-3','Slopes, foreshortening & layover','environment',slider('look','Off-nadir angle','°',18,53,1),
    {...vehicle,scenario:'urban',urbanDensity:'dense',clutter:true,look:18},
    'A building roof has a shorter slant range than its base. Where can it appear under flat-ground focusing?',
    ['Behind the base in range.', 'At the same location for every angle.', 'In front of the base in range.'],2,
    'A facing slope can compress in slant-range coordinates. If range order reverses, the upper surface can lay over the lower one. A terrain model or another viewing angle can help separate the contributions.', { panels:['geometry','image'], magnitude:15, zoom:170 }),
  advanced('3-4','Surface roughness & viewing angle','environment',carrier,
    {...vehicle,scenario:'materials',clutter:true},
    'A water patch is dark at one look angle. Which explanation is consistent with radar physics?',
    ['Water has one universal brightness.', 'The smooth surface may reflect energy away from the sensor.', 'The radar cannot transmit over water.'],1,
    'Roughness relative to wavelength and the surface orientation affect how much energy returns. The patch coefficients are illustrative. Compare other angles and wavelengths before assigning a material from brightness alone.', { panels:['optical','image'], magnitude:12, zoom:175 }),
  advanced('3-5','Range & azimuth ambiguity','sampling',slider('prf','PRF','Hz',4,48,1),
    {...single,prf:4},
    'A higher PRF reduces slow-time aliasing. What trade-off can matter when echoes come from far away?',
    ['The unambiguous delay interval gets shorter.', 'Every pulse changes color.', 'The physical swath doubles automatically.'],0,
    'Closely spaced transmissions sample phase more often, but a late echo may be mistaken for one from a later transmission. Choose PRF with both timing and Doppler bandwidth in mind. The ground engine illustrates slow-time aliasing without wrapping echoes between pulses.', { tab:'doppler' }),
  advanced('3-6','Phase errors & motion compensation','motion',
    choices('focusModel','Reconstruction hypothesis',['stationary','moving'],['Stationary ground','Known target motion'],true),
    {...single,targetSpeed:25,heading:90,quality:'high'},
    'A moving reflector smears under stationary focusing. Which change can correctly align its echoes?',
    ['Increase chirp bandwidth.','Use the reflector’s predicted path in the phase correction.','Discard the echo phase.'],1,
    'Apply the known velocity to each candidate pixel’s expected range history. Compare both images at the mid-pass reference position. A matching hypothesis restores coherence to that motion class. Other motions would need other estimates.',
    { time:8, tab:'doppler', panels:['geometry','image'], focusModel:'stationary',
      changed:'The paths used to compute candidate delays and phase rotations.', fixed:'The collected pulses, raw echoes, and target motion.' }),
  advanced('3-7','Strong and weak scatterers','environment',noise,
    {...single,scenario:'study-several',clutter:true},
    'A weak response lies next to a bright peak. What else could the weak response be?',
    ['Always a second vehicle.', 'No physical echo is possible.', 'A sidelobe from the bright scatterer.'],2,
    'A strong target can mask nearby weak ones through sidelobes or background clutter. Windowing can suppress sidelobes at the cost of broadening the main peak. More looks help distinguish stable targets from random noise.', { panels:['signal','image'], magnitude:12, zoom:170 }),
  advanced('3-8','Platform trajectory error','motion',
    slider('trajectoryDrift','Assumed along-track speed error','m/s',0,18,1,{view:true}),
    single,
    'Stationary objects smear together after an incorrect navigation update. What should the processor try first?',
    ['Re-estimate the platform path and repeat focusing.','Interpret every smear as target motion.','Only raise the image brightness.'],0,
    'The receiver data stayed the same. An along-track speed error in the reconstruction changes predicted delay and phase. Using the correct trajectory restores the stationary scene. Real platforms can use navigation data and autofocus to estimate phase errors.',
    { time:7, trajectoryDrift:0, panels:['geometry','image'], changed:'The assumed path used for reconstruction.', fixed:'The actual trajectory, scene, and raw measurements.' }),

]
