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
  bandwidth: ['Chirp bandwidth & pulse compression', ['Compare bandwidth at one carrier', 'Send one chirp toward two reflectors', 'Receive two overlapping delayed copies', 'Slide the known chirp template', 'Compare compressed responses']],
  sampling: ['Sampling the moving aperture', ['Trace the flight paths', 'Transmit at discrete positions', 'Compare the sampled phase history']],
  reflection: ['Echo strength', ['Illuminate both cases with the same pulse', 'Compare returned amplitude', 'Compare echo peaks at the same delay']],
  clutter: ['Distributed ground echoes', ['Illuminate the ground footprint', 'Collect delayed returns from its patches', 'Add the complex echoes at the receiver']],
  noise: ['Signal in receiver noise', ['Receiver fluctuations', 'A weak echo arrives', 'Compare baseline and current detectability']],
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

export function visualMarkup(kind) {
  const [title, steps] = content[kind]
  return `<section class="study-visual" aria-label="Mental Visualization">
    <h3>Mental Visualization</h3><p>${title} · Conceptual slow motion, scales exaggerated</p>
    <svg viewBox="0 0 320 166" role="img" aria-label="${title}"></svg>
    <div class="study-visual-controls"><button type="button" data-visual-replay>Replay concept</button>
    <input type="range" data-visual-time aria-label="Concept progress" min="0" max="1000" value="0"></div>
    <div class="study-visual-steps" aria-label="Concept chapters">${steps.map((step, index) =>
      `<button type="button" data-visual-step="${index}" aria-label="${step}">${index + 1}</button>`).join('')}</div>
    <p data-visual-caption></p>
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

function carrierVisual(config, progress, step) {
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

function bandwidthVisual(config, progress, step, frame) {
  const bands = [24, config.bandwidth === 24 ? 72 : config.bandwidth]
  if (step === 0) return bands.map((band, i) => {
    const y = 53 + 67*i, color = i ? cyan : amber
    return line([24,y],[296,y]) + line([160,y-20],[160,y+11])
      + span(160 - band * 1.75,y,band*3.5,color) + label(27,y-15,`${band} MHz bandwidth`,color)
      + label(135,y+25,`${config.frequency} MHz`)
  }).join('') + label(162, 159, 'Same carrier → frequency')
  const B = bands[1]
  const offset = (progress * 5 - step)
  if (step === 1) {
    const start = [32,45], a = [208,55], b = [276,97]
    return platformIcon(start) + line(start,a) + line(start,b) + reflector(a) + reflector(b,cyan)
      + dot(...mix(start,a,offset),amber,4) + dot(...mix(start,b,offset),cyan,4)
      + label(209,38,'A') + label(278,81,'B')
      + wave(33,123,252,11,10,B/5) + label(29,151,'Lower instantaneous frequency → higher')
  }
  if (step === 2 || step === 3) {
    const shift = step === 3 ? 44*(1-offset) : 19
    const echoMarker = step === 2 ? dot(29+210*offset,53,amber) + dot(29+shift+210*offset,107,cyan) : ''
    return label(16,19,step === 3 ? 'Known template slides toward alignment' : 'Two delayed copies of the same full chirp')
      + wave(29,53,210,9,10,B/5,0,amber)
      + wave(29+shift,107,210,9,10,B/5)
      + echoMarker + label(19,79,'Echo A',amber) + label(19,134,step === 3 ? 'Template' : 'Echo B',cyan)
      + label(19,154,step === 3 ? (shift < 8 ? 'Phases agree → strong sum' : 'Phase mismatch → partial cancellation') : 'Long returns overlap in receiver time')
  }
  if (!frame?.comparison?.profile || !frame.compressed) return label(12,55,'Change bandwidth to compare the measured peaks.')
  const base = frame.comparison
  const useExample = config.bandwidth === 24 && base.wide
  const current = useExample ? base.wide : frame.acquisition
  const compressed = useExample ? base.wide.profile : frame.compressed
  const t = frame.tracks['point-a'][frame.pulse].range
  const trace = (values, origin, dr, y, color) => path(Array.from(values, (value, i) => [origin + i*dr, value])
    .filter(([r]) => Math.abs(r-t-2.5) < 17)
    .map(([r,value]) => [160 + (r-t-2.5)*8, y - 10*value]), color)
  return label(14,20,'Measured compressed Range Profiles') +
    line([23,78],[296,78]) + trace(base.profile,base.minRange,base.dr,78,amber)
    + label(14,95,`Baseline 24 MHz`,amber)
    + line([23,143],[296,143]) + trace(compressed,current.minRange,current.dr,143,cyan)
    + label(14,160,`${useExample ? 'Example 72' : 'Current ' + config.bandwidth} MHz · ΔR ≈ c/(2B)`,cyan)
}

function samplingVisual(config, baseline, time, progress, step) {
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

function miniImage(image, { width, height }, opacity) {
  let peak = 0
  for (const value of image) peak = Math.max(value, peak)
  if (!peak) return ''
  const cells = []
  for (let y = 0; y < 20; y++) {
    for (let x = 0; x < 54; x++) {
      const value = image[Math.floor(y*height/20)*width + Math.floor(x*width/54)]
      const strength = Math.max(0,(Math.log10(Math.max(value/peak,1e-3))+1.35)/1.35)
      if (strength > 0.09) cells.push(`<rect x="${25+5*x}" y="${51+5*y}" width="5.2" height="5.2" opacity="${strength.toFixed(2)}"/>`)
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

function diagram(kind, config, baseline, time, progress, step, frame) {
  switch (kind) {
    case 'delay': return delayVisual(config,baseline,time,progress)
    case 'carrier': return carrierVisual(config,progress,step)
    case 'bandwidth': return bandwidthVisual(config,progress,step,frame)
    case 'sampling': return samplingVisual(config,baseline,time,progress,step)
    case 'reflection': case 'clutter': case 'noise': return signalVisual(kind,config,baseline,frame,progress,step)
    case 'motion': case 'matrix': return historyVisual(config,baseline,time,progress,step,kind)
    case 'vectors': return vectorVisual(config,time,step)
    case 'quality': return qualityVisual(config)
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
  const steps = content[lesson.visual][1]
  let progress = 0, animation = 0, frame, start
  function draw() {
    const step = visualizationStep(progress,steps.length)
    const config = frame?.config || lesson.baseline
    const synchronized = card.querySelector('[data-study-control="pulseIndex"]')
    const time = lesson.visual === 'matrix' && !synchronized ? progress*DURATION : frame?.time ?? lesson.time
    root.querySelector('svg').innerHTML = diagram(lesson.visual,config,lesson.baseline,time,progress,step,frame)
    if (caption.textContent !== steps[step]) {
      caption.textContent = steps[step]
      buttons.forEach((button,i) => button.setAttribute('aria-pressed',i===step))
    }
    slider.value = Math.round(progress*1000)
  }
  function seek(next, sync) {
    progress = next
    draw()
    if (sync && lesson.visual === 'matrix') onScrub(progress*DURATION)
  }
  function tick(now) {
    if (!root.isConnected || root.closest('[hidden]')) {
      animation = 0
      return
    }
    start ??= now
    const next = Math.min(1,(now-start)/6500)
    seek(next,true)
    animation = next < 1 ? requestAnimationFrame(tick) : 0
  }
  root.querySelector('[data-visual-replay]').onclick = () => {
    cancelAnimationFrame(animation)
    animation = 0
    seek(0,true)
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      start = undefined
      animation = requestAnimationFrame(tick)
    }
  }
  slider.oninput = () => {
    cancelAnimationFrame(animation)
    animation = 0
    seek(+slider.value/1000,true)
  }
  buttons.forEach((button,i) => button.onclick = () => {
    cancelAnimationFrame(animation)
    animation = 0
    seek(Math.min(1,(i+0.42)/steps.length),true)
  })
  draw()
  return snapshot => {
    frame = snapshot
    if (!animation && lesson.visual === 'matrix' && card.querySelector('[data-study-control="pulseIndex"]')) {
      progress = snapshot.pulse / (snapshot.acquisition.count-1)
    }
    draw()
  }
}
