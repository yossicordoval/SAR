import { C, DEFAULTS } from './physics.js'

const isolated = { ...DEFAULTS, scenario: 'study-point', clutter: false, noise: 0, targetX: 0, targetY: 0 }
const rangeMetrics = [
  { label: 'Slant range', unit: 'm', digits: 1, read: (_, target) => target.range },
  { label: 'Round-trip delay', unit: 'µs', digits: 2, read: (_, target) => target.delay * 1e6 },
]

export const curriculum = [{
  id: '0A', title: 'Radar parameters', lessons: [
    {
      id: '0A-1', title: 'Geometry, range & delay',
      intro: 'Altitude is the radar’s height above flat ground, in metres. Move the reflector across the flight path or change the look angle (the beam’s tilt from straight down, in degrees). The direct distance from radar to reflector is the slant range.',
      watch: 'Compare the line of sight in Radar Geometry with reflector A in the Range Profile. The horizontal axis is slant range in metres. The profile uses a pulse-compression filter to put each return’s range near the center of its peak.',
      focus: 'point-a', baseline: isolated, time: 4, instant: true, tab: 'range', stage: 'focused', profile: 'compressed',
      panels: ['geometry', 'signal'], sceneLabel: 'Single reflector',
      controls: [
        { key: 'altitude', label: 'Platform altitude', unit: 'm', min: 400, max: 680, step: 10 },
        { key: 'targetY', label: 'Reflector position across track', unit: 'm', min: -80, max: 80, step: 2 },
        { key: 'look', label: 'Nominal look angle', unit: '°', min: 20, max: 50, step: 1 },
      ],
      task: 'Raise altitude first. Then return it to 530 m and try changing only the reflector position or look angle.',
      predict: { prompt: 'If you raise the platform while keeping the look angle fixed, what happens to the echo?', options: ['It arrives later and moves right.', 'It arrives earlier and moves left.', 'It stays at the same range.'], correct: 0 },
      why: 'The pulse travels to reflector A and back. Raising the platform in this setup increases the total distance. A positive cross-track position puts the reflector farther from the platform. Changing the nominal look angle shifts the platform’s lateral offset so the beam still points at the scene origin.',
      math: 'R = |rₜ − rₚ|. Here R is slant range, and rₜ and rₚ are the reflector and platform positions. Round-trip delay τ = 2R/c, where τ is time in seconds, 2 accounts for the two legs, and c is the speed of light (about 300 million metres per second).',
      bottom: 'Longer slant range → later echo → farther right on the range plot.',
      check: { prompt: 'Two echoes arrive 4 µs and 6 µs after transmission. Which travelled a longer one-way distance?', options: ['The 4 µs echo', 'The 6 µs echo', 'Both travelled the same distance'], correct: 1, feedback: 'Both echoes travel out and back at the same speed, so the later return has the longer slant range.' },
      metrics: rangeMetrics,
    },
    {
      id: '0A-2', title: 'Carrier frequency & wavelength',
      intro: 'Carrier frequency is the central rate of oscillation of the transmitted radio wave. A megahertz (MHz) is one million cycles per second. Wavelength is the distance between wave crests. Bandwidth is the span swept around the carrier.',
      watch: 'Watch the Doppler curve in Received Signal. Time along the pass is on the horizontal axis. The vertical axis shows the frequency shift in hertz (Hz). Compare its height and sign with the baseline.',
      focus: 'point-a', baseline: { ...isolated, bandwidth: 48, prf: 36 }, time: 5.5, instant: false, tab: 'doppler', stage: 'focused',
      panels: ['geometry', 'signal'], sceneLabel: 'Single reflector',
      controls: [{ key: 'frequency', label: 'Carrier frequency', unit: 'MHz', min: 42, max: 70, step: 2 }],
      task: 'Sweep from 42 to 70 MHz. Compare wavelength, phase change per metre, and Doppler at the same instant. Slant range stays fixed.',
      predict: { prompt: 'The platform and reflector keep the same motion. What does a higher carrier frequency do?', options: ['Makes the wavelength longer and the shift weaker.', 'Makes the wavelength shorter and the shift larger in magnitude.', 'Makes the echo arrive earlier.'], correct: 1 },
      why: 'At a higher carrier frequency, the same movement spans more wave cycles. The echo phase changes faster per metre of range change. Doppler is how fast those cycles accumulate over time. The curve keeps its sign because the motion stays the same.',
      math: 'λ = c/f, where λ is wavelength in metres, c is the speed of light, and f is carrier frequency in cycles per second. A range change ΔR produces phase change Δφ = −4πΔR/λ radians, with π the circle constant. Doppler fᴅ = −2vᵣ/λ, where fᴅ is the frequency shift in hertz and vᵣ is the rate of change of range in metres per second.',
      bottom: 'Higher carrier → shorter wavelength → more phase change per metre and larger Doppler magnitude for the same motion.',
      check: { prompt: 'At closest approach the range stops changing for an instant. What happens to Doppler if you raise the carrier then?', options: ['It stays zero at that instant.', 'It becomes positive.', 'It becomes negative.'], correct: 0, feedback: 'A higher carrier scales the shift. At closest approach the instantaneous range rate is zero, so the shift remains zero.' },
      metrics: [
        { label: 'Wavelength', unit: 'm', digits: 2, read: config => C / (config.frequency * 1e6) },
        { label: 'Phase sensitivity', unit: '°/m', digits: 0, read: config => 720 * config.frequency * 1e6 / C },
        { label: 'Doppler at 5.5 s', unit: 'Hz', digits: 2, read: (_, target) => target.doppler },
        rangeMetrics[0],
      ],
    },
    {
      id: '0A-3', title: 'Bandwidth & range resolution',
      intro: 'Bandwidth is the span of frequencies inside the transmitted pulse, in megahertz. Range resolution is how close two echoes can be in slant range while remaining distinguishable.',
      watch: 'Compare reflectors A and B in the compressed Range Profile. The horizontal axis shows slant range and the vertical axis shows echo magnitude. The vertical marks show the reflectors’ true ranges. Look for one broad bump at low bandwidth and a dip between two peaks at high bandwidth.',
      focus: 'point-a', baseline: { ...isolated, scenario: 'study-pair', frequency: 56, bandwidth: 24, quality: 'high' },
      time: 4, instant: true, tab: 'range', stage: 'range', profile: 'compressed', zoom: 12,
      panels: ['optical', 'signal'], sceneLabel: 'Two reflectors',
      targets: [{ id: 'point-a', label: 'Reflector A' }, { id: 'point-b', label: 'Reflector B' }],
      controls: [{ key: 'bandwidth', label: 'Transmit bandwidth', unit: 'MHz', min: 24, max: 72, step: 2 }],
      task: 'Move the slider from 24 toward 72 MHz and back. Compare the peaks to the dashed baseline. The reflectors stay put.',
      predict: { prompt: 'At 24 MHz the two returns overlap. What will a wider transmitted band do after range compression?', options: ['Move the reflectors closer.', 'Make the same peak brighter without changing its width.', 'Narrow the responses so two peaks can emerge.'], correct: 2 },
      why: 'The receiver compares the echo to a copy of the transmitted sweep. A wider sweep loses agreement more quickly when shifted in time. That gives each reflector a narrower response, making room for a dip between the two peaks.',
      math: 'ΔR ≈ c/(2B), where ΔR is ideal slant-range resolution in metres, c is the speed of light, B is bandwidth in hertz, and 2 converts round-trip distance to one-way range. The actual peaks also depend on filtering, sampling, strength, and relative phase. This demonstration uses two equal reflectors with aligned echo phases at one pulse.',
      bottom: 'Wider bandwidth → finer slant-range resolution → close echoes are easier to separate.',
      check: { prompt: 'Two objects are side by side at exactly the same slant range. Can a wider band alone give them distinct range peaks?', options: ['Yes, if the band is wide enough.', 'No. They have the same round-trip delay.', 'Yes, if both echoes have equal strength.'], correct: 1, feedback: 'Bandwidth helps distinguish different delays. A single range profile cannot use delay to separate two objects at the same range.' },
      metrics: [
        { label: 'Ideal range resolution', unit: 'm', digits: 2, read: config => C / (2 * config.bandwidth * 1e6) },
        { label: 'A–B slant separation', unit: 'm', digits: 2, read: (_, target, pair) => pair ? Math.abs(pair.range - target.range) : NaN },
      ],
    },
  ],
}]
