import { comparisonAxes, historyFraction, rangeFraction } from './study-axes.js'
import { AREA, DURATION } from './physics.js'
import { migrationShift } from './processing.js'

const font = '10px ui-monospace, monospace'
const ink = '#94a9ba'
const cyan = '#4be4e8'
const amber = '#f3ce80'
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))

function setup(canvas) {
  const w = canvas.clientWidth, h = canvas.clientHeight
  if (w < 10 || h < 10) return null
  const ratio = Math.min(window.devicePixelRatio || 1, 2)
  if (canvas.width !== Math.round(w * ratio) || canvas.height !== Math.round(h * ratio)) {
    canvas.width = Math.round(w * ratio); canvas.height = Math.round(h * ratio)
  }
  const ctx = canvas.getContext('2d')
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  ctx.clearRect(0, 0, w, h)
  ctx.font = font
  return { ctx, w, h }
}

function grid(ctx, x, y, w, h, cols, rows) {
  ctx.fillStyle = '#0b1728'
  ctx.fillRect(x, y, w, h)
  ctx.strokeStyle = '#24364c'
  ctx.lineWidth = 0.65
  ctx.beginPath()
  for (let c = 0; c <= cols; c++) { ctx.moveTo(x + c * w / cols, y); ctx.lineTo(x + c * w / cols, y + h) }
  for (let r = 0; r <= rows; r++) { ctx.moveTo(x, y + r * h / rows); ctx.lineTo(x + w, y + r * h / rows) }
  ctx.stroke()
}

function ticks(ctx, x, y, w, h, columns, rows, xValue, yValue) {
  ctx.fillStyle = ink
  ctx.font = font
  ctx.textAlign = 'center'
  for (let c = 0; c <= columns; c++) ctx.fillText(xValue(c / columns), x + c * w / columns, y + h + 14)
  ctx.textAlign = 'right'
  for (let r = 0; r <= rows; r++) ctx.fillText(yValue(r / rows), x - 7, y + r * h / rows + 3)
  ctx.textAlign = 'left'
}

function trace(ctx, values, x, w, getY, color, area) {
  if (values.length < 1) return
  ctx.beginPath()
  values.forEach((v, n) => {
    const px = x + w * n / Math.max(1, values.length - 1), py = getY(v)
    if (n) ctx.lineTo(px, py)
    else ctx.moveTo(px, py)
  })
  ctx.strokeStyle = color
  ctx.lineWidth = 1.45
  ctx.stroke()
  if (area) {
    ctx.lineTo(x + w, area.bottom)
    ctx.lineTo(x, area.bottom)
    ctx.closePath()
    ctx.fillStyle = area.fill
    ctx.fill()
  }
}

function marker(ctx, x, y, h, color) {
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.setLineDash([3, 4])
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + h); ctx.stroke()
  ctx.setLineDash([])
}

export function plotProfile(canvas, frame, tab, contributions, study) {
  const board = setup(canvas)
  if (!board || !frame) return
  const { ctx, w, h } = board
  const { acquisition: a } = frame
  const x = 40, y = 9, width = w - 59, height = h - 29
  const selected = a.tracks[frame.selected][frame.pulse]
  if (height < 12) return
  grid(ctx, x, y, width, height, 5, 3)
  if (study && tab === 'range') {
    plotStudyRange(ctx, { x, y, width, height }, frame, study)
    return
  }
  if (tab === 'doppler') {
    const history = a.tracks[frame.selected]
    const available = history.slice(frame.first, frame.pulse + 1)
    const reference = study && frame.comparison?.tracks[frame.selected]
    const max = study ? comparisonAxes(study.lesson).doppler : Math.ceil(Math.max(...history.flatMap(v => [Math.abs(v.doppler), Math.abs(v.stationary)]), 2) / 3) * 3
    const vertical = v => y + (1 - v / max) * height / 2
    const x0 = x + width * frame.first / (a.count - 1)
    const extent = width * historyFraction(frame.pulse - frame.first, a.count)
    ticks(ctx,x,y,width,height,5,2,u => (u * DURATION).toFixed(1) + 's',u => Math.round((1 - 2*u)*max))
    if (history.some(v => Math.abs(v.doppler - v.stationary) > 0.001))
      trace(ctx,available.map(v => v.stationary),x0,extent,vertical,amber)
    if (reference && study.reference) {
      ctx.setLineDash([5, 4])
      const first = frame.first === frame.pulse ? frame.comparison.pulse : 0
      trace(ctx,reference.slice(first,frame.comparison.pulse+1).map(v => v.doppler),
        x + width * historyFraction(first, reference.length),
        width * historyFraction(frame.comparison.pulse - first, reference.length),vertical,'#a8afcd')
      ctx.setLineDash([])
    }
    trace(ctx,available.map(v => v.doppler),x0,extent,vertical,cyan)
    marker(ctx,x0+extent,y,height,'#54e5dc75')
    ctx.beginPath(); ctx.arc(x0+extent,vertical(selected.doppler),3,0,Math.PI*2); ctx.fillStyle = cyan; ctx.fill()
    return
  }
  const iq = tab === 'iq'
  if (iq && study) {
    const axes = comparisonAxes(study.lesson)
    const vertical = value => y + height * (1-clamp((1+value/axes.magnitude)/2))
    ticks(ctx,x,y,width,height,5,2,t => Math.round(axes.left+(axes.right-axes.left)*t)+'m',
      t => ((1-2*t)*axes.magnitude).toFixed(1))
    const curve = (values, origin, dr, color, dashed) => {
      const first = Math.max(0,Math.ceil((axes.left-origin)/dr))
      const last = Math.min(values.length-1,Math.floor((axes.right-origin)/dr))
      if (last < first) return
      ctx.setLineDash(dashed ? [4,4] : [])
      trace(ctx,values.slice(first,last+1),x+width*rangeFraction(origin+first*dr,axes),
        width*(last-first)*dr/(axes.right-axes.left),vertical,color)
      ctx.setLineDash([])
    }
    const base = frame.comparison
    if (study.reference) {
      curve(base.iqI,base.minRange,base.dr,'#a8afcd',true)
      curve(base.iqQ,base.minRange,base.dr,'#917d63',true)
    }
    curve(frame.iqI,a.minRange,a.dr,cyan,false)
    curve(frame.iqQ,a.minRange,a.dr,amber,false)
    marker(ctx,x+width*rangeFraction(selected.range,axes),y,height,'#a8e0ab6b')
    return
  }
  const { echo, ground, target } = frame.profiles
  const max = Math.max(...echo, 2) * 1.08
  const vertical = v => y + height * (iq ? (1 - v / max) / 2 : 1 - v / max)
  ticks(ctx,x,y,width,height,5,2,u => Math.round(a.minRange + (a.bins-1) * u * a.dr) + 'm',
    u => ((iq ? 1 - 2*u : 1-u) * max).toFixed(1))
  const markerX = x + width * clamp((selected.range - a.minRange) / (a.dr * (a.bins - 1)))
  marker(ctx,markerX,y,height,'#a8e0ab6b')
  if (iq) {
    trace(ctx,frame.iqI,x,width,vertical,cyan)
    trace(ctx,frame.iqQ,x,width,vertical,amber)
    return
  }
  const fill = ctx.createLinearGradient(0,y,0,y+height)
  fill.addColorStop(0,'#2dd4dd5f'); fill.addColorStop(1,'#12c0d312')
  trace(ctx,echo,x,width,vertical,cyan,{ bottom: y+height, fill })
  if (contributions) {
    trace(ctx,ground,x,width,vertical,'#739bdb')
    trace(ctx,target,x,width,vertical,amber)
  }
  ctx.font = '9px ui-monospace, monospace'
  ctx.fillStyle = '#c3e9c8'
  ctx.fillText('SELECTED ECHO', markerX + (markerX > x+width-95 ? -79 : 6), y + 11)
}

function plotStudyRange(ctx, { x, y, width, height }, frame, { lesson, reference }) {
  const baseline = frame.comparison
  const current = frame.compressed || frame.profiles.echo
  const points = Object.values(frame.tracks).map(track => track[frame.pulse].range)
  const axes = comparisonAxes(lesson)
  const { left, right, magnitude: max } = axes
  const yAt = v => y + height * (1 - clamp(v / max))
  const xAt = range => x + width * rangeFraction(range, axes)
  ticks(ctx,x,y,width,height,4,2,t => Math.round(left + (right-left)*t) + ' m',t => (max*(1-t)).toFixed(1))
  const curve = (values, start, resolution, color, dashed) => {
    const first = Math.max(0,Math.ceil((left-start)/resolution))
    const last = Math.min(values.length-1,Math.floor((right-start)/resolution))
    if (last < first) return
    const axis = start + first*resolution
    ctx.setLineDash(dashed ? [5, 4] : [])
    trace(ctx, values.slice(first,last+1), xAt(axis), (last-first)*resolution*width/(right-left), yAt, color)
    ctx.setLineDash([])
  }
  if (reference) curve(baseline.profile, baseline.minRange, baseline.dr, '#a8afcd', true)
  curve(current, frame.acquisition.minRange, frame.acquisition.dr, cyan, false)
  points.forEach((range, index) => {
    const color = index === 0 ? '#a5f6be' : amber
    const active = frame.selected === Object.keys(frame.tracks)[index]
    const px = xAt(range)
    if (px < x || px > x + width) return
    marker(ctx,px,y,height,active ? color : color + 'a0')
    ctx.fillStyle = color
    ctx.fillText(index === 0 ? 'A' : 'B',px + (index === 0 ? -10 : 3),y + 12)
    if (active) {
      ctx.beginPath(); ctx.arc(px,y + 4,2.4,0,Math.PI*2); ctx.fill()
    }
  })
}

const colors = [[8,13,32],[26,27,74],[42,54,132],[30,106,169],[30,166,177],[73,206,159],[164,228,114],[253,222,117]]
const rawPalette = Array.from({ length: 256 }, (_, k) => {
  const pos = k / 255 * (colors.length - 1)
  const a = Math.floor(pos), b = Math.min(a + 1, colors.length - 1)
  return colors[a].map((c, i) => Math.round(c + (colors[b][i] - c) * (pos - a)))
})

function db(value, reference, span) {
  return clamp(1 + 20 * Math.log10(Math.max(0.0001,value) / reference) / span)
}

const raster = document.createElement('canvas')
const rasterCtx = raster.getContext('2d')

function scaleBar(ctx, x, y, w, h, grayscale) {
  const gradient = ctx.createLinearGradient(x,y+h,x,y)
  const colors = grayscale ? ['#101a25','#575c5a','#c7c9bb','#fff9d7'] : ['#141b45','#304780','#1aa5b0','#69dd95','#fadd75']
  colors.forEach((c,i) => gradient.addColorStop(i/(colors.length-1),c))
  ctx.fillStyle = gradient
  ctx.fillRect(x,y,w,h)
  ctx.strokeStyle = '#69849668'
  ctx.strokeRect(x,y,w,h)
  ctx.fillStyle = ink
  ctx.font = '9px ui-monospace, monospace'
  ctx.fillText('0',x+w+5,y+6)
  if (h > 58) ctx.fillText(grayscale ? '−18' : '−20',x+w+5,y+h/2+3)
  ctx.fillText(grayscale ? '−36' : '−40',x+w+5,y+h)
}

export function plotMatrix(canvas, frame, stage = 'raw', large = false) {
  const board = setup(canvas)
  if (!board || !frame) return
  const { ctx, w, h } = board
  const { acquisition: a } = frame
  const x = large ? 43 : 40, y = large ? 18 : 8, width = w-x-49, height = h-y-23
  if (width < 20 || height < 18) return
  const data = stage === 'migration' ? frame.corrected : a[stage === 'range' ? 'compressed' : 'raw']
  if (!data) return
  raster.width = a.bins; raster.height = a.count
  const image = rasterCtx.createImageData(a.bins,a.count)
  const reference = stage === 'raw' ? 6.4 : 4
  for (let p = 0; p < a.count; p++) {
    const available = p >= frame.first && p <= frame.pulse
    for (let b = 0; b < a.bins; b++) {
      const k = (p*a.bins+b)*4
      const source = stage === 'migration' ? (p-frame.first)*a.bins+b : p*a.bins+b
      const value = available ? db(data[source],reference,40) : 0
      const rgb = available ? rawPalette[Math.round(value*255)] : [12,22,37]
      image.data[k] = rgb[0]; image.data[k+1] = rgb[1]; image.data[k+2] = rgb[2]; image.data[k+3] = 255
    }
  }
  rasterCtx.putImageData(image,0,0)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(raster,x,y,width,height)
  const track = a.tracks[frame.selected]
  const mid = track[Math.floor(a.count/2)]
  ctx.beginPath()
  for (let p = frame.first; p <= frame.pulse; p++) {
    const range = track[p].range - (stage === 'migration' ? migrationShift(frame.config,mid,p) : 0)
    const px = x + clamp((range - a.minRange)/(a.dr*(a.bins-1))) * width
    const py = y + height*(p+0.5)/a.count
    if (p === frame.first) ctx.moveTo(px,py); else ctx.lineTo(px,py)
    if (p === frame.pulse) {
      ctx.strokeStyle = '#fce5a6a8'; ctx.lineWidth = 1; ctx.stroke()
      ctx.beginPath(); ctx.arc(px,py,2.2,0,Math.PI*2); ctx.fillStyle = '#ffdf93'; ctx.fill()
    }
  }
  ctx.strokeStyle = '#395168'; ctx.lineWidth = 1; ctx.strokeRect(x,y,width,height)
  ticks(ctx,x,y,width,height,5,height < 55 ? 2 : 4,
    u => Math.round(a.minRange+(a.bins-1)*u*a.dr)+'m',u => Math.round(u*(a.count-1)))
  scaleBar(ctx,w-38,y,8,height,false)
}

export function plotImage(canvas, frame, onSelect, highlight = true) {
  const board = setup(canvas)
  if (!board || !frame?.image) return
  const { ctx, w, h } = board
  const { acquisition: a } = frame
  const x = 18, y = 12, width = w-71, height = h-38
  if (width < 20 || height < 20) return
  raster.width = a.width; raster.height = a.height
  const image = rasterCtx.createImageData(a.width,a.height)
  for (let p = 0; p < a.height; p++) {
    for (let b = 0; b < a.width; b++) {
      const k = ((a.height-1-p)*a.width+b)*4
      const v = db(frame.image[p*a.width+b],1.65,36)
      image.data[k] = 11 + 244 * v; image.data[k+1] = 16 + 237 * v
      image.data[k+2] = 24 + 201 * v; image.data[k+3] = 255
    }
  }
  rasterCtx.putImageData(image,0,0)
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(raster,x,y,width,height)
  ctx.strokeStyle = '#50616d'
  ctx.lineWidth = 1
  ctx.strokeRect(x,y,width,height)
  const selected = a.tracks[frame.selected][frame.focusReference ?? frame.pulse]
  const toPixel = v => [x+width*(v.x+AREA.x)/(2*AREA.x),y+height*(AREA.y-v.y)/(2*AREA.y)]
  const [px,py] = toPixel(selected)
  if (highlight && px > x+7 && px < x+width-7 && py > y+7 && py < y+height-7) {
    ctx.strokeStyle = '#9cf6b5'; ctx.lineWidth = 1.1
    ctx.beginPath(); ctx.arc(px,py,8,0,2*Math.PI); ctx.stroke()
    outlineCross(ctx,px,py)
  }
  ctx.font = '10px ui-monospace, monospace'
  ctx.fillStyle = '#ebf0e6'
  const bar = width * 50 / (2*AREA.x)
  ctx.strokeStyle = '#ebf0e6'; ctx.lineWidth = 1.4
  ctx.beginPath(); ctx.moveTo(x+13,y+height-15); ctx.lineTo(x+13+bar,y+height-15)
  ctx.moveTo(x+13,y+height-19);ctx.lineTo(x+13,y+height-11)
  ctx.moveTo(x+13+bar,y+height-19);ctx.lineTo(x+13+bar,y+height-11);ctx.stroke()
  ctx.fillText('50 m',x+13,y+height-23)
  ctx.fillStyle = ink
  ctx.fillText('AZIMUTH →',x+width-75,y+height+16)
  ctx.fillText('↑ RANGE',x,y+height+16)
  scaleBar(ctx,w-39,y+3,9,height-7,true)
  canvas.onclick = event => {
    const rect = canvas.getBoundingClientRect()
    const hits = Object.entries(a.tracks).map(([id, history]) => {
      const [hx,hy] = toPixel(history[frame.focusReference ?? frame.pulse])
      return [id,Math.hypot(event.clientX-rect.left-hx,event.clientY-rect.top-hy)]
    }).sort((left,right) => left[1]-right[1])
    if (hits[0][1] < 24) onSelect(hits[0][0])
  }
}

function outlineCross(ctx,x,y) {
  ctx.beginPath()
  for (const [dx,dy] of [[0,1],[0,-1],[1,0],[-1,0]]) {
    ctx.moveTo(x+dx*7,y+dy*7); ctx.lineTo(x+dx*12,y+dy*12)
  }
  ctx.stroke()
}
