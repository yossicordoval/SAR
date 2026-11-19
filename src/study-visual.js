import { SURFACES, urbanBuildings } from './environments.js'
import { bandwidthStage, conceptSeek, storyboard } from './storyboards.js'
import { C, DURATION, measure, platform, pulseCount, random, sceneObjects } from './physics.js'

const cyan = '#59e4df', amber = '#ffcc84', muted = '#a8afcd', grid = '#52617f'
const tau = 2 * Math.PI
const line = (a, b, color = grid, extras = '') =>
  `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${color}" ${extras}/>`
const dot = (x, y, color = cyan, r = 3) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}"/>`
const label = (x, y, content, color = muted) => `<text x="${x}" y="${y}" fill="${color}">${content}</text>`
const path = (points, color = cyan, dash = '') =>
  `<polyline points="${points.map(point => point.map(value => value.toFixed(2)).join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="1.5" stroke-dasharray="${dash}"/>`
const series = (fn, count = 120) => Array.from({ length: count + 1 }, (_, i) => fn(i / count))
const lerp = (a, b, t) => a + (b - a) * t
const mix = (a, b, t) => a.map((value, i) => lerp(value, b[i], t))
const span = (x, y, width, color) => line([x, y], [x + width, y], color, 'stroke-width="4"')
const platformIcon = ([x,y]) => `<path d="M${x-11} ${y}h22m-15 -4h8v8h-8z" fill="#142438" stroke="${cyan}"/>`
const reflector = ([x,y], color = amber) => `<path d="M${x} ${y-5}l5 5 -5 5 -5 -5z" fill="${color}"/>`
const vector = (a, b, color) => {
  const angle = Math.atan2(b[1] - a[1], b[0] - a[0])
  return line(a, b, color, 'stroke-width="2"') + path([
    [b[0] - 7 * Math.cos(angle - 0.45), b[1] - 7 * Math.sin(angle - 0.45)],
    b, [b[0] - 7 * Math.cos(angle + 0.45), b[1] - 7 * Math.sin(angle + 0.45)],
  ], color)
}
const wave = (x, y, width, amplitude, cycles, chirp = 0, phase = 0, color = cyan) =>
  path(series(t => [x + t * width, y - amplitude * Math.sin(tau * (cycles * t + chirp * (t*t-t) / 2) + phase)], 160), color)

const content = {
  delay: ['Transmission, reflection & arrival', ['Emit one pulse', 'Travel to the reflector', 'Scatter back', 'Receive and plot the echo']],
  carrier: ['Wavelength & phase', ['Compare cycles over equal distance', 'Apply the same range change', 'Compare phase rate at the receiver']],
  sampling: ['Sampling the moving aperture', ['Trace the flight paths', 'Transmit at discrete positions', 'Compare the sampled phase history']],
  reflection: ['Echo strength', ['Illuminate both cases with the same pulse', 'Compare returned amplitude', 'Compare echo peaks at the same delay']],
  clutter: ['Distributed ground echoes', ['Illuminate the ground footprint', 'Collect delayed returns from its patches', 'Add the complex echoes at the receiver']],
  noise: ['Signal in receiver noise', ['Receiver fluctuations', 'A weak echo arrives', 'Compare baseline and current detectability']],
  environment: ['Surfaces, geometry & the image', ['Inspect the terrain patches', 'Trace candidate returns toward the radar', 'Compare the processed surroundings']],
  motion: ['Geometry and measurement history', ['Locate the platform and target', 'Compare actual and reference paths', 'Follow range and Doppler history']],
  vectors: ['Project velocity onto line of sight', ['Draw the line of sight', 'Draw target velocity', 'Project target velocity onto the sight line']],
  quality: ['Numerical sampling grids', ['Start with the same scene', 'Compare numerical samples', 'Increase grid density']],
  truth: ['Known scene and inferred image', ['Start from known target coordinates', 'Measure echoes along the pass', 'Reconstruct a ground location']],
  phasor: ['I, Q, and coherent addition', ['Draw one return as a vector', 'Read horizontal I and vertical Q', 'Add another scatterer’s contribution']],
  matrix: ['Build the raw matrix', ['Transmit the first pulse', 'Append successive echo profiles', 'Follow the selected reflector’s range history']],
  processing: ['Range compression, alignment & focus', ['Stack wide raw echoes', 'Compress each row in range', 'Align the selected reference curve', 'Combine phase-corrected echoes']],
  focus: ['Aperture & coherent focus', ['Observe from one point', 'Extend the sampled aperture', 'Compare along-track localization']],
  chain: ['From transmission to ground image', ['Transmit, propagate and scatter', 'Measure complex I/Q', 'Repeat and stack raw profiles', 'Compress each return and inspect migration', 'Correct phase and focus the ground image']],
}

export const visualizationStep = (progress, count) => Math.min(count - 1, Math.floor(progress * count))

const storyboardTitle = { bandwidth: 'Chirp bandwidth & pulse compression', 'bandwidth-review': 'Two reflectors & range resolution', doppler: 'From path length to Doppler and focus', iq: 'Why SAR preserves I and Q' }
const visualContent = kind => storyboard(kind)
  ? [storyboardTitle[kind], storyboard(kind).map(([step]) => step)]
  : content[kind]

export function visualMarkup(kind) {
  const [title, steps] = visualContent(kind)
  return `<section class="study-visual" aria-label="Mental Visualization">
    <h3>Mental Visualization</h3><p>${title} · Conceptual slow motion, scales exaggerated</p>
    <p class="visual-chapter" data-visual-caption></p>
    <svg viewBox="0 0 320 166" role="img" aria-label="${title}"></svg>
    <svg data-visual-result viewBox="0 0 320 166" role="img" aria-label="Focused image comparison" hidden></svg>
    <p data-visual-description></p>
    <div class="study-visual-controls">
      <button type="button" data-visual-prev>Previous</button><button type="button" data-visual-next>Next stage</button>
    </div>
    <input type="range" data-visual-time aria-label="Concept progress" min="0" max="1000" value="0">
    <div class="study-visual-controls">
      <button type="button" data-visual-play>Play concept</button><button type="button" data-visual-replay>Replay concept</button>
      <label><input type="checkbox" data-visual-slow> Slow</label>
    </div>
    <div class="study-visual-steps" aria-label="Concept chapters">${steps.map((step, index) =>
      `<button type="button" data-visual-step="${index}" aria-label="${step}">${index + 1}</button>`).join('')}</div>
  </section>`
}

const measureFirst = (config, t) => measure(config, sceneObjects(config)[0], t)

function delayVisual(config, baseline, time, progress) {
  const ref = measureFirst(baseline, time)
  const actual = measureFirst(config, time)
  const preview = ref.range === actual.range && config.scenario === 'study-point'
  const target = preview ? measureFirst({ ...config, altitude: config.altitude+110 }, time) : actual
  const objects = sceneObjects(config)
  const showPair = objects.length > 1
  const bound = Math.max(ref.delay, target.delay, ...objects.map(object => measure(config,object,time).delay)) * 1.08
  const clock = progress * bound
  const source = [37, 43]
  const ends = [[158, 101], [276, 106]]
  const cases = showPair
    ? [target, measure(config, objects[1], time)] : [ref, target]
  const geometry = cases.map((echo, i) => {
    const color = i ? cyan : amber
    const p = Math.min(1, clock / echo.delay)
    const pulse = mix(source, ends[i], 1 - Math.abs(2*p-1))
    const mark = 29 + 263 * echo.delay / bound
    return line(source, ends[i], color, 'stroke-dasharray="4 4"') + reflector(ends[i], color)
      + (p < 1 ? dot(...pulse, color, 4) : line([mark, 143], [mark, 123 - i*7], color, 'stroke-width="2"'))
      + label(i ? 209 : 78, i ? 84 : 100, `${showPair ? ['A','B'][i] : ['Baseline',preview ? 'Higher' : 'Current'][i]} ${echo.range.toFixed(1)} m`, color)
  }).join('')
  return label(12, 15, `Timer ${(clock * 1e6).toFixed(2)} µs · delay = 2R/c`)
    + platformIcon(source) + geometry + line([29, 143], [294, 143])
    + label(17, 158, '0 · distance out/back = 2R') + label(164, 158, 'Later delay → farther range')
}

function phasor(x, y, r, angle, color, add = false) {
  const a = [x, y], b = [x + r*Math.cos(angle), y - r*Math.sin(angle)]
  const end = [b[0] + r * 0.58 * Math.cos(1), b[1] - r * 0.58 * Math.sin(1)]
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${grid}"/>`
    + line([x-r-7,y], [x+r+7,y]) + line([x,y-r-7], [x,y+r+7])
    + line(b, [b[0],y], grid, 'stroke-dasharray="3 3"')
    + line(b, [x,b[1]], grid, 'stroke-dasharray="3 3"')
    + vector(a, b, color) + label(x+r+8,y+3,'I') + label(x+4,y-r-8,'Q')
    + (add ? vector(b, end, amber) + vector(a, end, '#adf0a7') : '')
}

function carrierVisual(config, time, progress, step) {
  if (step === 2) {
    const configs = [{...config,frequency:42},{...config,frequency:config.frequency === 42 ? 70 : config.frequency}]
    const curves = configs.map(c => series(t => measureFirst(c,t*DURATION).doppler,80))
    const max = Math.max(1,...curves.flat().map(Math.abs))
    return label(13,18,'Same motion · different Doppler scales')
      + line([20,82],[297,82])
      + curves.map((curve,i) => path(curve.map((v,k) => [20+k*277/80,82-v*53/max]),i ? cyan : amber)).join('')
      + label(13,148,configs.map(c => `${c.frequency} MHz: ${measureFirst(c,time).doppler.toFixed(1)} Hz`).join(' · '))
  }
  const frequencies = [42, config.frequency === 42 ? 70 : config.frequency]
  const excursion = Math.max(0, progress - 1/3) * 2
  return frequencies.map((frequency, i) => {
    const wavelength = C / (frequency * 1e6)
    const y = 40 + 76*i, color = i ? cyan : amber
    const width = 201, distance = 30, spacing = width * wavelength / distance
    const phase = -2 * tau * excursion / wavelength
    return label(10, y-22, `${frequency} MHz · λ ${wavelength.toFixed(2)} m`, color)
      + wave(10, y, width, 9, distance/wavelength, 0, step ? phase : 0, color)
      + span(10, y+18, spacing, color) + label(13, y+31, 'One wavelength')
      + phasor(264,y,21, phase,color)
  }).join('') + label(11, 161, step ? `Same ΔR ${excursion.toFixed(2)} m · illustrative frequency colors` : 'Same 30 m path · illustrative frequency colors')
}

function bandwidthVisual(config, offset, step, frame) {
  const wide = config.bandwidth === 24 ? 72 : config.bandwidth
  const B = step < 2 ? wide : config.bandwidth
  if (step === 0) {
    return label(18,17,'ONE transmitted pulse')
      + wave(22,49,274,15,9,B/5) + line([22,70],[296,70])
      + line([22,138],[22,86]) + line([22,138],[296,138])
      + line([30,131],[276,92],cyan,'stroke-width="2"')
      + line([285,92],[285,131],amber) + label(290,113,'B',amber)
      + label(25,153,'Low instantaneous frequency → high')
  }
  if (step === 1) return [24,wide].map((band, i) => {
    const y = 53 + 67*i, color = i ? cyan : amber
    return line([24,y],[296,y]) + line([160,y-20],[160,y+11])
      + span(160 - band * 1.75,y,band*3.5,color) + label(27,y-15,`${band} MHz bandwidth`,color)
      + label(135,y+25,`${config.frequency} MHz`)
  }).join('') + label(162,159,'Same carrier → frequency')
  if (step === 2 || step === 3) {
    const radar = [30,49], ends = [[192,71],[274,93]]
    const tracks = frame?.tracks
    const real = tracks?.['point-b'] ? ['point-a','point-b'].map(id => tracks[id][frame.pulse].delay*1e6) : null
    return platformIcon(radar) + ends.map((end,i) => {
      const color = i ? cyan : amber
      const t = Math.min(1,offset*(i ? 1.12 : 1.52))
      const pulse = step === 2 ? mix(radar,end,t) : mix(end,radar,t)
      return line(radar,end) + reflector(end,color) + dot(...pulse,color,4)
        + label(end[0]-5,end[1]-12,i ? 'B' : 'A',color)
    }).join('') + label(15,126,step === 2 ? 'A is reached first' : 'A arrives before B')
      + (real && step === 3 ? label(15,150,`τA ${real[0].toFixed(3)} µs · τB ${real[1].toFixed(3)} µs · Δτ ${((real[1]-real[0])*1000).toFixed(1)} ns`) : '')
  }
  if (step === 4) {
    const chirp = t => Math.sin(tau*(8*t + B/4*(t*t-t)/2))
    const offsetB = 0.17
    return label(16,16,'Two copies occupy receiver time together')
      + wave(31,44,204,9,8,B/4,0,amber) + label(9,47,'A',amber)
      + wave(31+204*offsetB,79,204,9,8,B/4) + label(9,82,'B',cyan)
      + line([31,128],[296,128]) + path(series(t => {
        const x=t*1.31, b=x-offsetB
        return [31+204*x,128-9*((x<1 ? chirp(x) : 0)+(b>=0 && b<1 ? chirp(b) : 0))]
      },215),muted) + label(16,153,'Raw receiver sum · time →')
  }
  if (step === 5 || step === 6) {
    const shift = step === 5 ? 0 : (offset-.68)*43
    const score = v => Math.abs(v) < 0.01 ? 1 : Math.abs(Math.sin(v)/v)
    return label(13,16,'Received echo',amber) + wave(60,34,205,10,8,B/4,0,amber)
      + label(13,67,'Reference copy',cyan) + wave(60+shift,85,205,10,8,B/4)
      + (step === 6 ? line([28,145],[293,145])
        + path(series(t => [28+265*t*offset,145-30*score((t*offset-.68)*14)]),cyan)
        + label(14,161,'Match score for candidate delays →') : label(14,142,'The radar retains the chirp it transmitted'))
  }
  if (!frame?.comparison?.profile || !frame.compressed) return label(12,55,'Waiting for the measured Range Profiles.')
  const base = frame.comparison
  const alternate = step === 8 || config.bandwidth === 24
  const current = alternate ? base.wide : { ...frame.acquisition, profile: frame.compressed }
  const a = frame.tracks['point-a'][frame.pulse].range
  const b = frame.tracks['point-b'][frame.pulse].range
  const mid = (a+b)/2
  const x = range => 160 + (range-mid)*7.5
  const draw = (data,y,color) => path(Array.from(data.profile,(v,i) => [data.minRange+i*data.dr,v])
    .filter(([r]) => Math.abs(r-mid) < 18).map(([r,v]) => [x(r),y-14*v]),color)
  if (step < 9) return label(13,18,step === 7 ? '24 MHz · broad, merged response' : '72 MHz · two separable responses')
    + line([25,121],[295,121]) + draw(step === 7 ? base : current,121,step === 7 ? amber : cyan)
    + label(x(a)-4,142,'A') + label(x(b)-4,142,'B')
  return label(13,17,'Measured Range Profile · common range axis')
    + [a,b].map((range,index) => line([x(range),37],[x(range),135],grid,'stroke-dasharray="3 3"') + label(x(range)-3,32,index ? 'B' : 'A')).join('')
    + line([25,135],[295,135]) + draw(base,135,amber) + draw(current,135,cyan)
    + label(13,155,`24 MHz baseline · ${alternate ? '72 MHz example' : config.bandwidth+' MHz current'}`,muted)
}

function iqVisual(step, progress) {
  if (step === 0) return phasor(155,80,45,0.22+progress*tau,cyan)
    + label(12,156,'Length = amplitude · angle = phase')
  if (step === 1 || step === 2) return phasor(76,69,24,0,cyan) + phasor(236,69,24,Math.PI,amber)
    + label(26,112,'A = +1 + 0j',cyan) + label(191,112,'B = −1 + 0j',amber)
    + label(22,145,step === 1 ? 'Same magnitude: 1 · phases: 0° and 180°' : 'Coherent sum A + B = 0')
  const correction = step === 4 ? 1 : 0
  return [0.7,2.9,-1.4].map((angle,i) => phasor(57+i*101,76,22,angle*(1-correction),cyan)).join('')
    + label(12,148,correction ? 'Aligned at the right location → sum grows' : 'Before correction, echo phases differ')
}

function dopplerVisual(config, time, step, progress, frame) {
  const obj = sceneObjects(config)[0]
  const t = step < 2 ? 4*progress : step < 7 ? 8*progress : time
  const m = measure(config,obj,t)
  const wheel = phasor(238,72,29,m.phase,cyan)
  const moving = { ...config, scenario: 'road', targetSpeed: 20, heading: 90 }
  const phaseOrigin = measure(config,obj,0).phase
  const drawTrace = (fn,min,max,color) => path(series(p => [25+270*p,127-86*(fn(p*8)-min)/Math.max(1,max-min)],100),color)
  if (step < 3) return platformIcon([24+145*t/8,45]) + reflector([152,115])
    + line([24+145*t/8,45],[152,115],amber) + wheel
    + (step === 1 ? wave(25,137,164,8,6,0,m.phase,cyan) : '')
    + label(14,22,`Slant range ${m.range.toFixed(1)} m`)
    + label(14,157,step === 2 ? 'One turn = 2π radians' : 'Approach → shorter path')
  if (step === 7) {
    const compare = frame?.comparison?.motionImage
    return label(12,16,'Stationary assumption applied to both scenes')
      + (compare && frame.comparison.image ? miniImage(frame.comparison.image,frame.comparison,1,17,32,125,105,1.65)
        + miniImage(compare,frame.comparison,1,177,32,125,105,1.65) : '')
      + label(17,152,'Stationary scene',amber) + label(177,152,'Moving scene',cyan)
  }
  const isDoppler = step === 4 || step === 5
  const variable = (c,o,u) => isDoppler ? measure(c,o,u).doppler : (measure(c,o,u).phase-phaseOrigin)/tau
  const stationary = u => variable(config,obj,u)
  const actual = u => variable(moving,sceneObjects(moving)[0],u)
  const values = series(u => stationary(u*8),80).concat(step === 6 ? series(u => actual(u*8),80) : [])
  const min = Math.min(...values), max = Math.max(...values)
  return line([25,127],[295,127]) + line([25,41],[25,127])
    + drawTrace(stationary,min,max,step === 6 ? amber : cyan)
    + (step === 6 ? drawTrace(actual,min,max,cyan) : dot(25+270*t/8,127-86*(stationary(t)-min)/Math.max(1,max-min),amber))
    + label(12,20,isDoppler ? 'Doppler (Hz) · phase slope in cycles/s' : 'Accumulated phase (cycles)')
    + label(13,151,step === 6 ? 'Stationary (amber) · moving (cyan)' : 'Approach → closest → departure   Slow time →')
}

function samplingVisual(config, baseline, time, progress, step) {
  if (step === 2) {
    const count = pulseCount(config)
    const actual = series(t=>measureFirst(config,t*DURATION).doppler,100)
    const pulses = Array.from({length:count},(_,i)=>measureFirst(config,i*DURATION/(count-1)).phase)
    const sampled = pulses.slice(1).map((phase,i)=> {
      const difference = phase-pulses[i]
      return Math.atan2(Math.sin(difference),Math.cos(difference))*(count-1)/(DURATION*tau)
    })
    const bound=Math.max(1,...actual.map(Math.abs),...sampled.map(Math.abs))
    const y=value=>86-value*53/bound
    const sampleAt=(i)=>[22+278*(i+.5)/(count-1),y(sampled[i])]
    const dots=sampled.flatMap((_,i)=>i%Math.max(1,Math.ceil(sampled.length/105)) ? [] : [dot(...sampleAt(i),amber,1.4)])
    return label(13,17,'Doppler from sampled echo phase')
      + line([22,86],[300,86]) + path(actual.map((value,i)=>[22+i*2.78,y(value)]),cyan) + dots.join('')
      + label(13,150,'True geometry (cyan) · sampled estimate (amber)')
      + label(13,163,`${config.prf} Hz PRF · ±${config.prf/2} Hz unambiguous band`)
  }
  const extent = Math.max(config.speed, baseline.speed) * 2
  const pulseWindow = 0.9
  const start = Math.min(time, DURATION - pulseWindow)
  const doppler = measureFirst(config,start).doppler
  const alias = doppler - Math.round(doppler / config.prf) * config.prf
  const samples = (c, fn) => Array.from({ length: Math.floor(pulseWindow*c.prf)+1 }, (_, i) => fn(i/c.prf)).join('')
  return [baseline,config].map((c,i) => {
    const y = 34+i*38, color = i ? cyan : amber
    return label(14,y-12,`${i ? 'Current' : 'Baseline'} · ${c.speed} m/s · ${c.prf} Hz`,color)
      + line([18,y],[18+280*c.speed*pulseWindow/extent,y],color)
      + samples(c, t => t <= progress ? dot(18+280*c.speed*t/extent,y,color,2) : '')
  }).join('') + (step > 0 ? line([18,114],[300,114])
    + wave(18,114,282,18,doppler*pulseWindow,0,0,muted)
    + (Math.abs(alias-doppler) > 0.01 ? wave(18,114,282,18,alias*pulseWindow,0,0,amber) : '')
    + samples(config,t => dot(18+282*t/pulseWindow,114-18*Math.sin(tau*doppler*t),cyan,2))
    + label(14,151,Math.abs(alias-doppler) > 0.01 ? 'Same samples also fit the amber oscillation' : 'Sample dots follow the local phase oscillation') : '')
}

function signalVisual(kind, config, baseline, frame, progress, step) {
  const source = [34,49], target = [264,50]
  const geometry = platformIcon(source) + reflector(target) + vector(source,target,muted)
    + (step > 0 ? vector([248,63],[48,63],cyan) : '')
  if (kind === 'clutter') {
    const patches = series(t => [85+204*t, 61+19*Math.sin(30*t)],8)
    return geometry + (config.clutter ? patches.map((p,i) => dot(...p,amber,2)
      + line(p,source,grid) + dot(...mix(p,source,(progress*3+i/9)%1),amber,2)).join('') : '')
      + label(13,101,config.clutter ? 'Each illuminated patch sends back a weak echo' : 'Target-only comparison')
      + profileTrace(frame,progress,137)
  }
  if (kind === 'reflection') return geometry + label(15,24,`Current strength ${config.rcs.toFixed(1)}× · baseline ${baseline.rcs.toFixed(1)}×`)
    + wave(54,82,196,5*config.rcs,8,0,tau*progress) + profileTrace(frame,progress,143)
  const rng = random(41)
  const points = series(t => {
    const n = (rng()+rng()-1)*config.noise*49
    const echo = step > 0 ? 16*Math.exp(-((t-0.54)**2)/0.0015) : 0
    return [16+287*t,95-n-echo]
  })
  return label(15,36,`Receiver noise ${config.noise.toFixed(2)} relative units`)
    + line([16,95],[303,95]) + path(points) + label(15,128,step > 0 ? 'The weak return stays at the same delay' : 'Fluctuations in a receiver without a strong echo')
}

function profileTrace(frame, progress, y) {
  if (!frame?.comparison?.profile) return ''
  const base = frame.comparison, current = frame.compressed || frame.profiles.echo
  const signal = (values,color) => path(Array.from(values,(v,i) => [15+287*i/(values.length-1),y-7*v])
    .slice(0,Math.max(2,Math.ceil(values.length*progress))),color)
  return line([15,y],[302,y]) + signal(base.profile,amber) + signal(current,cyan)
}

function historyVisual(config, baseline, time, progress, step, kind) {
  const at = kind === 'matrix' || step === 0 ? time : progress * DURATION
  const { x } = platform(config,at)
  const obj = sceneObjects(config)[0]
  const now = measure(config,obj,at)
  const source = [26+268*(x/(DURATION*config.speed)+0.5), 38]
  const destination = [153+now.x*0.28, 62+now.y*0.12]
  const history = c => series(t => measureFirst(c,t*DURATION),64)
  const current = history(config), ref = history(baseline)
  const ranges = [...current, ...ref].map(sample => sample.range)
  const min = Math.min(...ranges)
  const max = Math.max(...ranges)
  const scaled = r => (r-min)/Math.max(1,max-min)
  const geometry = line([26,38],[294,38]) + platformIcon(source) + reflector(destination) + line(source,destination)
  if (kind === 'matrix') {
    const count = pulseCount(config)
    const last = Math.round(time/DURATION*(count-1))
    const rows = Array.from({ length: last + 1 }, (_, i) => {
      const sample = measure(config,obj,i*DURATION/(count-1))
      const y = 84+66*i/(count-1), x = 76+208*scaled(sample.range)
      return line([53,y],[298,y], '#25314b') + span(x-3,y,6,i===last?amber:cyan)
    }).join('')
    return geometry + rows + label(12,99,'Rows') + label(12,115,last+1)
      + label(178,163,'Slant range →')
  }
  const dopplerMax = Math.max(1,...current.map(p=>Math.abs(p.doppler)),...ref.map(p=>Math.abs(p.doppler)))
  const trace = (samples,color,dash) => path(samples.map((p,i)=>[25+269*i/64,117-32*scaled(p.range)]),color,dash)
  return geometry + trace(ref,amber,'3 4') + trace(current,cyan)
    + dot(25+269*at/DURATION,117-32*scaled(now.range))
    + path(current.map((p,i)=>[25+269*i/64,141-13*p.doppler/dopplerMax]),muted)
    + label(16,163,`Range ${now.range.toFixed(1)} m · Doppler ${now.doppler.toFixed(2)} Hz`)
}

function vectorVisual(config, time, step) {
  const sat = platform(config,time)
  const obj = sceneObjects(config)[0]
  const target = measure(config,obj,time)
  const u = [(target.x-sat.x)/target.range,(target.y-sat.y)/target.range]
  const projected = (obj.vx||0)*u[0]+(obj.vy||0)*u[1]
  const groundLength = Math.hypot(...u)
  const origin = [164,82]
  const ground = u.map(value => value / Math.max(groundLength,0.001))
  const tip = [origin[0]+(obj.vx||0)*2,origin[1]-(obj.vy||0)*2]
  const projectedGround = projected / Math.max(groundLength,0.001)
  const projection = [origin[0]+ground[0]*projectedGround*2,origin[1]-ground[1]*projectedGround*2]
  return label(12,18,'Top view · radial readout uses full 3D sight line')
    + vector([origin[0]-ground[0]*83,origin[1]+ground[1]*83],origin,muted)
    + reflector(origin) + (step > 0 ? vector(origin,tip,cyan) + label(230,40,'Velocity',cyan) : '')
    + (step > 1 ? vector(origin,projection,amber) + line(tip,projection,amber,'stroke-dasharray="3 3"') : '')
    + label(12,142,`Target radial contribution ${projected.toFixed(2)} m/s`,amber)
    + label(12,158,`Total Doppler ${target.doppler.toFixed(2)} Hz`,cyan)
}

function qualityVisual(config) {
  const density = ['interactive','medium','high'].indexOf(config.quality)
  return [5, 5+density*4].map((n,i) => {
    const x = 19+i*158, y = 33
    return label(x,20,i ? config.quality : 'interactive')
      + Array.from({ length: n*n },(_,j) => dot(x+j%n*120/(n-1),y+Math.floor(j/n)*105/(n-1),grid,1.4)).join('')
      + reflector([x+67,y+44])
  }).join('') + label(19,161,'Same reflector and field of view')
}

function focusVisual(frame, config, time, progress, truth) {
  const count = frame ? frame.pulse-frame.first+1 : 1
  const shown = Math.max(1, Math.round(count*progress))
  const n = Math.min(38,shown)
  const spanWidth = 268 * Math.max(0,shown-1)/(pulseCount(config)-1)
  const dots = Array.from({ length:n },(_,i)=>dot(26+spanWidth*i/Math.max(1,n-1),35,cyan,2)).join('')
  const target = measureFirst(config,time)
  const spot = [160+target.x*0.61,100+target.y*0.28]
  const image = frame?.image
  const raster = image ? miniImage(image,frame.acquisition,progress) : ''
  return label(14,17,truth ? 'Ground Truth diamond over the reconstruction' : `${count} acquired pulse${count === 1 ? '' : 's'} · measured reconstruction`)
    + line([26,35],[294,35]) + dots + line([26+spanWidth,35],spot)
    + raster + reflector(spot) + label(17,161,'Along track →')
}

function imageComparison(frame) {
  const before = frame?.comparison
  if (!before?.image || !frame.image) return ''
  return label(13,17,'Actual focused image · shared intensity scale')
    + miniImage(before.image,before,1,12,29,140,112,1.65)
    + miniImage(frame.image,frame.acquisition,1,168,29,140,112,1.65)
    + label(12,157,'Baseline',amber) + label(168,157,'Current',cyan)
}

function miniImage(image, { width, height }, opacity, left = 25, top = 51, imageWidth = 270, imageHeight = 100, reference) {
  let peak = 0
  for (const value of image) peak = Math.max(value, peak)
  peak = reference ?? peak
  if (!peak) return ''
  const cells = []
  for (let y = 0; y < 20; y++) {
    for (let x = 0; x < 54; x++) {
      const value = image[Math.floor(y*height/20)*width + Math.floor(x*width/54)]
      const strength = Math.min(1,Math.max(0,(Math.log10(Math.max(value/peak,1e-3))+1.35)/1.35))
      if (strength > 0.09) cells.push(`<rect x="${left+x*imageWidth/54}" y="${top+y*imageHeight/20}" width="${imageWidth/54+.1}" height="${imageHeight/20+.1}" opacity="${strength.toFixed(2)}"/>`)
    }
  }
  return `<g fill="${cyan}" opacity="${opacity.toFixed(2)}">${cells.join('')}</g>`
}

function processingVisual(progress, step, chain, config, baseline, time, frame) {
  if (chain && step === 0) return delayVisual(config, baseline, time, progress*5)
  if (chain && step === 1) return phasor(160,84,48,Math.PI*progress,cyan)
  if (chain && step === 4 || !chain && step === 3) return focusVisual(frame,config,time,progress,false)
  const transform = chain ? step-2 : step
  const mix = progress*(chain ? 5 : 4)-step
  const rows = series(t => {
    const x = 182 + (1-t*2)**2*76*(transform < 2 ? 1 : 1-mix)
    const y = 30+114*t
    const w = transform === 0 ? 62 : transform === 1 ? lerp(62,10,mix) : 10
    return line([35,y],[291,y]) + span(x-w/2,y,w,cyan)
  }, 11).join('')
  return rows + label(16,161,transform === 0 ? 'Wide echoes across successive pulses' : transform === 1 ? 'Matched filtering narrows each return' : 'Align the selected reference range')
}

function environmentVisual(config,step) {
  if (config.scenario === 'materials') return SURFACES.map((surface,i) => {
    const x=8+i%4*78,y=24+Math.floor(i/4)*64
    return `<rect x="${x}" y="${y}" width="73" height="54" fill="${['#154456','#286071','#685a3f','#656e72','#36573d','#71808a','#547a8b','#444951'][i]}"/>`
      + label(x+4,y+29,surface,'#f2f8ff')
  }).join('') + label(9,157,'Surface and viewing geometry affect return strength')
  if (config.scenario !== 'urban') return label(14,26,'Strong and weak echoes in one acquisition')
    + [0,1,2].map((i) => reflector([52+i*100,85],i === 2 ? muted : cyan)).join('')
  const radar = [20,29]
  const row = urbanBuildings(config.urbanDensity).filter(block => block.x<0).slice(0,4)
  return platformIcon(radar) + line([11,132],[309,132])
    + row.map((b,i) => {
      const x=66+i*60, y=132-b.height
      return `<rect x="${x}" y="${y}" width="27" height="${b.height}" fill="#52677d"/>`
        + (step ? line(radar,[x,y],cyan) + span(x+27,133,b.height*.36,'#203042') : '')
    }).join('') + label(14,154,'Elevated roofs and blocked ground alter echoes')
}

function diagram(kind, config, baseline, time, progress, step, frame) {
  if (['clutter','noise','motion','vectors','focus','environment','quality'].includes(kind)
    && frame?.comparison?.image && step === visualContent(kind)[1].length - 1) return imageComparison(frame)
  switch (kind) {
    case 'delay': return delayVisual(config,baseline,time,progress)
    case 'carrier': return carrierVisual(config,time,progress,step)
    case 'bandwidth': case 'bandwidth-review': {
      const count = storyboard(kind).length
      return bandwidthVisual(config,Math.min(1,progress*count-step),bandwidthStage(kind,step),frame)
    }
    case 'iq': return iqVisual(step,Math.min(1,progress*storyboard(kind).length-step))
    case 'doppler': return dopplerVisual(config,time,step,Math.min(1,progress*storyboard(kind).length-step),frame)
    case 'sampling': return samplingVisual(config,baseline,time,progress,step)
    case 'reflection': case 'clutter': case 'noise': return signalVisual(kind,config,baseline,frame,progress,step)
    case 'motion': case 'matrix': return historyVisual(config,baseline,time,progress,step,kind)
    case 'vectors': return vectorVisual(config,time,step)
    case 'quality': return qualityVisual(config)
    case 'environment': return environmentVisual(config,step)
    case 'truth': case 'focus': return focusVisual(frame,config,time,progress,kind === 'truth')
    case 'phasor': return phasor(155,82,47,measureFirst(config,time).phase + tau*progress,cyan,step === 2)
      + label(14,158,step === 2 ? 'Cyan + amber = green resultant' : 'Angle gives phase · length gives magnitude')
    case 'processing': case 'chain': return processingVisual(progress,step,kind === 'chain',config,baseline,time,frame)
  }
}

export function mountVisualization(card, lesson, onScrub) {
  const root = card.querySelector('.study-visual')
  if (!root) return
  const slider = root.querySelector('[data-visual-time]')
  const caption = root.querySelector('[data-visual-caption]')
  const buttons = [...root.querySelectorAll('[data-visual-step]')]
  const steps = visualContent(lesson.visual)[1]
  const board = storyboard(lesson.visual)
  const previous = root.querySelector('[data-visual-prev]')
  const next = root.querySelector('[data-visual-next]')
  const play = root.querySelector('[data-visual-play]')
  const slow = root.querySelector('[data-visual-slow]')
  let progress = 0, animation = 0, frame, lastTick, lastDraw
  function draw() {
    const step = visualizationStep(progress,steps.length)
    const config = frame?.config || lesson.baseline
    const synchronized = card.querySelector('[data-study-control="pulseIndex"]')
    const time = lesson.visual === 'matrix' && !synchronized ? progress*DURATION : frame?.time ?? lesson.time
    const evidenceOnly = lesson.evidence && card.closest('.evidence')
    root.querySelector('svg').innerHTML = evidenceOnly && frame?.image
      ? step === steps.length-1 && frame.comparison?.image ? imageComparison(frame)
        : label(12,19,'Focused radar evidence') + miniImage(frame.image,frame.acquisition,1)
      : diagram(lesson.visual,config,lesson.baseline,time,progress,step,frame)
    const result = root.querySelector('[data-visual-result]')
    result.hidden = !(lesson.visual.startsWith('bandwidth') && step === steps.length-1 && frame?.image && frame.comparison?.image)
    if (!result.hidden) result.innerHTML = imageComparison(frame)
    if (lastDraw !== step) {
      lastDraw = step
      caption.textContent = `${step+1} / ${steps.length} · ${steps[step]}`
      root.querySelector('[data-visual-description]').textContent = board?.[step][1] || (step === steps.length-1 ? lesson.bottom : '')
      previous.disabled = step === 0
      next.disabled = step === steps.length-1
      buttons.forEach((button,i) => button.setAttribute('aria-pressed',i===step))
    }
    slider.value = Math.round(progress*1000)
  }
  function seek(next, sync) {
    progress = next
    draw()
    if (sync && lesson.visual === 'matrix') onScrub(progress*DURATION)
  }
  function pause() {
    cancelAnimationFrame(animation)
    animation = 0
    lastTick = undefined
    play.textContent = 'Play concept'
  }
  function tick(now) {
    if (!root.isConnected || root.closest('[hidden]')) return pause()
    const elapsed = lastTick === undefined ? 0 : Math.min(70, now-lastTick)
    lastTick = now
    const duration = board ? steps.length*5000 : 8500
    seek(Math.min(1,progress+elapsed/(duration*(slow.checked ? 2 : 1))),true)
    if (progress < 1) animation = requestAnimationFrame(tick)
    else pause()
  }
  function jump(index, fraction = board ? 0.58 : 0.42) {
    pause()
    seek(conceptSeek(index,steps.length,fraction),true)
  }
  play.onclick = () => {
    if (animation) return pause()
    if (progress >= 1) seek(0,true)
    play.textContent = 'Pause concept'
    animation = requestAnimationFrame(tick)
  }
  root.querySelector('[data-visual-replay]').onclick = () => {
    pause()
    seek(0,true)
  }
  previous.onclick = () => jump(visualizationStep(progress,steps.length)-1)
  next.onclick = () => jump(visualizationStep(progress,steps.length)+1)
  slider.oninput = () => {
    pause()
    seek(+slider.value/1000,true)
  }
  buttons.forEach((button,i) => button.onclick = () => jump(i))
  draw()
  return snapshot => {
    frame = snapshot
    if (!animation && lesson.visual === 'matrix' && card.querySelector('[data-study-control="pulseIndex"]')) {
      progress = snapshot.pulse / (snapshot.acquisition.count-1)
    }
    draw()
  }
}
