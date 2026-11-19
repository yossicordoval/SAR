import { blockedByTerrain, elevation, sourceColors, surfaceNormal } from './terrain.js'
import { terrainStrength, urbanBuildings } from './environments.js'
import { AREA, FOOTPRINT, platform, random, reflectivity, road, sceneObjects } from './physics.js'

const clamp = (n, low, high) => Math.max(low, Math.min(high, n))
const p = (x, y, z = 0) => [x, y, z]
const ring = (x, y, z, rx, ry, count = 48) =>
  Array.from({ length: count }, (_, i) => p(x + rx * Math.cos(i * 2 * Math.PI / count), y + ry * Math.sin(i * 2 * Math.PI / count), z))

function gradient(ctx, w, h, stops) {
  const fill = ctx.createLinearGradient(0, 0, 0, h)
  stops.forEach(([at, color]) => fill.addColorStop(at, color))
  ctx.fillStyle = fill
  ctx.fillRect(0, 0, w, h)
}

function camera(w, h, state, geometry) {
  const az = state.az, tilt = state.tilt, d = state.distance
  const right = [Math.cos(az), Math.sin(az), 0]
  const forward = [-Math.sin(az), Math.cos(az), 0]
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1]
  const scale = Math.min(w * 0.93, h * (geometry ? 1.85 : 2.03))
  return v => {
    const xy = [v[0] - state.x, v[1] - state.y]
    const f = dot(xy, forward)
    const z = v[2] - (geometry ? 44 : 6)
    const depth = d + f * Math.cos(tilt) - z * Math.sin(tilt)
    const s = scale / Math.max(d * 0.24, depth)
    return [w * 0.5 + dot(xy, right) * s, h * (geometry ? 0.54 : 0.57) - (f * Math.sin(tilt) + z * Math.cos(tilt)) * s, depth]
  }
}

function outline(ctx, points, fill, stroke, width = 1, closed = true) {
  if (!points.length) return
  ctx.beginPath()
  ctx.moveTo(points[0][0], points[0][1])
  for (let k = 1; k < points.length; k++) ctx.lineTo(points[k][0], points[k][1])
  if (closed) ctx.closePath()
  if (fill) { ctx.fillStyle = fill; ctx.fill() }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke() }
}

function model(add, cx, cy, z, kind, scale, angle = 0) {
  const transform = ([x, y, height]) => p(cx + scale * (x * Math.cos(angle) - y * Math.sin(angle)),
    cy + scale * (x * Math.sin(angle) + y * Math.cos(angle)), z + scale * height)
  const face = (points, color, edge) => add(points.map(transform), color, edge)
  const box = (x1, y1, x2, y2, bottom, top, colors) => {
    const a = p(x1, y1, bottom), b = p(x2, y1, bottom), c = p(x2, y2, bottom), d = p(x1, y2, bottom)
    const e = p(x1, y1, top), f = p(x2, y1, top), g = p(x2, y2, top), h = p(x1, y2, top)
    face([a, b, f, e], colors[1]); face([b, c, g, f], colors[2]); face([c, d, h, g], colors[1])
    face([d, a, e, h], colors[3] || colors[2]); face([e, f, g, h], colors[0])
  }
  if (kind === 'vehicle') {
    box(-14, -6, 14, 6, 3, 7, ['#c3cc78', '#76834b', '#a5a662'])
    box(-6, -5.5, 5, 5.5, 7, 13, ['#dbe097', '#949c58', '#9eae61'])
    box(4.8, -4.8, 5.05, 4.8, 8.7, 11.7, ['#a6bcb3', '#283638', '#364f54'])
    box(-11, -7, -5, -5.8, 0.6, 5.6, ['#414039', '#292f28', '#343732'])
    box(6, -7, 12, -5.8, 0.6, 5.6, ['#414039', '#292f28', '#343732'])
    box(-11, 5.8, -5, 7, 0.6, 5.6, ['#414039', '#292f28', '#343732'])
    box(6, 5.8, 12, 7, 0.6, 5.6, ['#414039', '#292f28', '#343732'])
    box(-3, -2.2, 2, 2.2, 13.05, 14.5, ['#d5ded9', '#525c53', '#798984'])
    box(13.8, -4, 14.1, 4, 3.7, 5.1, ['#8b9182', '#535e53', '#697266'])
  } else if (kind === 'sat') {
    box(-8, -8, 8, 8, -5, 6, ['#e0e8ed', '#627189', '#a7b8d1'])
    box(-12, -2, 12, 2, -1, 2, ['#bdc6d4', '#53647c', '#7585a5'])
    for (let i of [-4, -3, -2, 1, 2, 3]) {
      for (let j of [-1, 0]) {
        const y = i * 10 + 5
        face([p(j * 10, y, 0), p(j * 10 + 9.6, y, 0), p(j * 10 + 9.6, y + 9.6, 0), p(j * 10, y + 9.6, 0)],
          (i + j) % 2 ? '#3767ad' : '#3d78c4', '#7ab7eb')
      }
    }
    face([p(-5, 8.1, -2), p(5, 8.1, -2), p(5, 8.1, 4), p(-5, 8.1, 4)], '#516788', '#c4d6e7')
  } else {
    const base = ring(0, 0, 0, 8, 5.5, 6)
    const top = p(-1.5, 1.5, kind === 'tree' ? 10 : 5)
    const colors = kind === 'tree' ? ['#415f46', '#506e4c', '#678354', '#71925b', '#587749', '#395944']
      : ['#535c5c', '#727b76', '#9a9c85', '#adab95', '#71796c', '#616962']
    base.forEach((v, i) => face([v, base[(i + 1) % base.length], top], colors[i]))
  }
}

const detail = (() => {
  const rng = random(317)
  return Array.from({ length: 175 }, () => {
    const x = (rng() * 2 - 1) * 460, y = (rng() * 2 - 1) * 310
    return [x, y, rng(), rng(), rng()]
  })
})()

function label(ctx, x, y, text, sub, color) {
  ctx.font = '600 10px system-ui'
  const w = Math.max(ctx.measureText(text).width, sub ? ctx.measureText(sub).width : 0) + 18
  ctx.beginPath()
  ctx.roundRect(x, y, w, sub ? 34 : 20, 5)
  ctx.fillStyle = '#0c1822e8'
  ctx.fill()
  ctx.strokeStyle = '#53716b'
  ctx.lineWidth = 0.7
  ctx.stroke()
  ctx.fillStyle = color
  ctx.fillText(text, x + 9, y + 13)
  if (sub) {
    ctx.font = '9px ui-monospace, monospace'
    ctx.fillStyle = '#b2c2c4'
    ctx.fillText(sub, x + 9, y + 26)
  }
}

export function createScene(canvas, geometry, onSelect) {
  const ctx = canvas.getContext('2d')
  const defaults = geometry
    ? { az: 0.54, tilt: 0.43, distance: 700, x: 48, y: -83 }
    : { az: -0.39, tilt: 0.35, distance: 254, x: -7, y: 9 }
  const view = { ...defaults }
  let frame, config, options, hits = [], drag, moved = false
  function draw() {
    if (!frame || !canvas.clientWidth || !canvas.clientHeight) return
    const w = canvas.clientWidth, h = canvas.clientHeight
    const ratio = Math.min(2, window.devicePixelRatio || 1)
    if (canvas.width !== Math.round(w * ratio) || canvas.height !== Math.round(h * ratio)) {
      canvas.width = Math.round(w * ratio); canvas.height = Math.round(h * ratio)
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    const project = camera(w, h, view, geometry)
    const poly = (pts, ...style) => outline(ctx, pts.map(project), ...style)
    const line = (pts, color, width) => poly(pts, null, color, width, false)
    gradient(ctx, w, h, geometry ? [[0, '#0a192a'], [0.66, '#10273a'], [1, '#112538']]
      : [[0, '#629cb9'], [0.44, '#b8cabc'], [0.69, '#c7be97'], [1, '#857d60']])
    if (geometry) {
      const cell = 28
      for (let x = 0; x < w; x += cell) outline(ctx, [[x, 0], [x, h]], null, '#2443565e', 1, false)
      for (let y = 0; y < h; y += cell) outline(ctx, [[0, y], [w, y]], null, '#2443565e', 1, false)
    } else {
      for (let layer = 0; layer < 3; layer++) {
        const ridge = [[0, h]]
        for (let i = 0; i <= 36; i++) {
          ridge.push([w * i / 36, h * (0.15 + layer * 0.08 + 0.063 * Math.sin(i * 0.28 + layer * 1.9) +
            0.019 * Math.sin(i * 0.82 + layer + view.az))])
        }
        ridge.push([w, h])
        outline(ctx, ridge, ['#809ca4', '#829794', '#8d9a7a'][layer])
      }
    }
    const xbound = geometry ? AREA.x : 490
    const ybound = geometry ? AREA.y : 272
    if (geometry) {
      poly([p(-xbound,-ybound,-10),p(xbound,-ybound,-10),p(xbound,ybound,-10),p(-xbound,ybound,-10)], '#0c2530', '#315c64')
      poly([p(-xbound,-ybound,-10),p(xbound,-ybound,-10),p(xbound,-ybound),p(-xbound,-ybound)], '#102c34', '#33515a')
      poly([p(xbound,-ybound,-10),p(xbound,ybound,-10),p(xbound,ybound),p(xbound,-ybound)], '#112d32', '#33515a')
    }
    const raised = config.scenario === 'terrain'
    const sensor = platform(config,frame.time)
    const surface = (x,y,lift=0) => p(x,y,elevation(config,x,y)+lift)
    const step = raised ? 16 : geometry ? 34 : 40
    const terrain = []
    for (let y = -ybound; y < ybound; y += step) {
      for (let x = -xbound; x < xbound; x += step) {
        const x2 = Math.min(x + step, xbound), y2 = Math.min(y + step, ybound)
        const s = terrainStrength(x,y,config,reflectivity(x+step*.51,y+step*.51,config.scenario))
        const f = Math.sin(x * 0.48 + y * 0.32)
        const land = geometry ? [29 + s * 18, 52 + s * 19, 54 + s * 13] : [111 + s * 32, 116 + s * 26, 78 + s * 27]
        const a = surface(x,y), b = surface(x2,y), c = surface(x2,y2), d = surface(x,y2)
        const green = (color, n) => 'rgb(' + color.map(k => Math.round(k + n)).join(',') + ')'
        const mx=(x+x2)/2, my=(y+y2)/2
        if (raised && geometry && blockedByTerrain(config,sensor,{x:mx,y:my,z:elevation(config,mx,my)})) {
          terrain.push([[a,b,c],'#171f36'],[[a,c,d],'#1a2340'])
          continue
        }
        terrain.push([[a,b,c], s < 0.1 ? '#345e70' : green(land, f * 4)], [[a,c,d], s < 0.1 ? '#386677' : green(land, f * 2 - 3)])
      }
    }
    terrain.sort((a, b) => project(b[0][0])[2] - project(a[0][0])[2])
    for (const [pts, color] of terrain) poly(pts,color,raised && options.dem ? '#7ecdd92e' : color,.85)
    if (geometry && !raised) {
      for (let x = -200; x <= 200; x += 40) line([p(x,-170,.2),p(x,170,.2)], '#43676655', 0.6)
      for (let y = -160; y <= 160; y += 40) line([p(-220,y,.2),p(220,y,.2)], '#43676655', 0.6)
    }
    const strips = [[-11, 11, geometry ? '#6b6250' : '#b9a47c'], [-8, -6.6, '#dac29a77'], [5, 6.6, '#d1b99077']]
    for (const [l, r, color] of raised ? [] : strips) {
      const sides = [[], []]
      for (let x = -xbound; x <= xbound; x += 5) {
        sides[0].push(p(x,road(x) + l,0.7)); sides[1].unshift(p(x,road(x) + r,0.7))
      }
      poly([...sides[0], ...sides[1]], color)
    }

    const faces = []
    let satelliteLabel
    const add = (pts, color, edge) => {
      const projected = pts.map(project)
      const depth = projected.reduce((sum, v) => sum + v[2], 0) / projected.length
      faces.push({ projected, color, edge, depth })
    }
    if (config.scenario === 'urban') {
      for (const x of [-85,0,85]) poly([p(x-8,-ybound,.75),p(x+8,-ybound,.75),p(x+8,ybound,.75),p(x-8,ybound,.75)],'#46525c')
      for (const y of [7,80]) poly([p(-xbound,y-7,.8),p(xbound,y-7,.8),p(xbound,y+7,.8),p(-xbound,y+7,.8)],'#46525c')
      for (const {x,y,hx,hy,height} of urbanBuildings(config.urbanDensity)) {
        const base = [p(x-hx,y-hy),p(x+hx,y-hy),p(x+hx,y+hy),p(x-hx,y+hy)]
        const roof = base.map(([u,v]) => p(u,v,height))
        base.forEach((a,i) => add([a,base[(i+1)%4],roof[(i+1)%4],roof[i]],i%2 ? '#536a7e' : '#384958','#293b4d'))
        add(roof,height>=50 ? '#82a1b2' : '#708281','#a9bbc1')
      }
    }
    for (const [x, y, variant, scale, angle] of raised ? [] : detail) {
      if (config.scenario === 'urban' && (variant < .88 || urbanBuildings(config.urbanDensity).some(b => Math.abs(x-b.x) < b.hx+9 && Math.abs(y-b.y) < b.hy+9))) continue
      if (Math.abs(y - road(x)) < 18 || Math.abs(x) > xbound - 8 || Math.abs(y) > ybound - 8 ||
        reflectivity(x,y,config.scenario) < 0.1 || (geometry && variant < 0.45)) continue
      const size = scale * (geometry ? 1.35 : 1.65) + 0.18
      poly(ring(x + 3,y - 2,0.9,size * 9,size * 4,7), '#182c2466')
      model(add,x,y,0,variant > 0.37 ? 'tree' : 'rock',size,angle * 6.28)
    }
    if (geometry && options.footprint) {
      const sat = platform(config, frame.time)
      const x = sat.x
      poly(ring(x,0,1.4,FOOTPRINT.x,FOOTPRINT.y).map(([u,v,z])=>surface(u,v,z)), '#31d1b629', '#3ee7c79a', 1)
      for (const factor of [0.78, 0.56]) poly(ring(x,0,1.5,FOOTPRINT.x*factor,FOOTPRINT.y*factor).map(([u,v,z])=>surface(u,v,z)), null, '#53e5bc52', 0.7)
    }
    hits = []
    for (const obj of sceneObjects(config)) {
      const spot = frame.tracks[obj.id][frame.pulse]
      const isSelected = obj.id === frame.selected
      if (obj.id.startsWith('point-')) {
        const color = obj.id === 'point-a' ? '#a5f6be' : '#f4ce80'
        const point = project(p(spot.x,spot.y,spot.z+1))
        const [x,y] = point
        outline(ctx, [[x,y-5],[x+5,y],[x,y+5],[x-5,y]], color, isSelected ? '#e9ffff' : '#192839', 1)
        hits.push({ point, obj, spot })
        continue
      }
      poly(ring(spot.x - 4,spot.y + 0.5,1,17,8,12), '#14212177')
      if (isSelected) poly(ring(spot.x,spot.y,1.5,21,13,36), '#73edaa1c', '#93f0afaa', 1)
      model(add,spot.x,spot.y,0,obj.id === 'vehicle' ? 'vehicle' : 'rock', obj.id === 'vehicle' ? (geometry ? 1.2 : 1.75) : 1.85,0.13)
      hits.push({ point: project(p(spot.x,spot.y,geometry ? 12 : 20)), obj, spot })
    }
    if (geometry) {
      const sat = platform(config, frame.time)
      const satPoint = p(sat.x * 0.56, sat.y * 0.50, 78 + sat.z * 0.23)
      const selected = frame.tracks[frame.selected][frame.pulse]
      const target = p(selected.x,selected.y,raised ? selected.z : 8)
      const shadow = raised && blockedByTerrain(config,sat,selected)
      if (raised && options.dem) {
        const normal = surfaceNormal(config,selected.x,selected.y)
        line([target,target.map((value,i)=>value+normal[i]*47)],'#faf2b3',1.7)
      }
      const lerp = (a, b, u) => a.map((v, i) => v * (1 - u) + b[i] * u)
      if (options.footprint) {
        const x = sat.x
        poly([satPoint,p(x - FOOTPRINT.x * 0.81,-83,1.5),p(x + FOOTPRINT.x * 0.81,83,1.5)], '#49e6d019')
        poly([satPoint,p(x - FOOTPRINT.x * 0.81,-83,1.5),p(x - 30,FOOTPRINT.y,1.5)], '#49e6d013')
      }
      ctx.setLineDash([5, 6])
      const left = p(-225,satPoint[1],satPoint[2]), right = p(225,satPoint[1],satPoint[2])
      line([left,right], '#89a5c794', 1)
      if (options.los) line([satPoint,target],shadow?'#ff9a98':'#6ddec5',1)
      ctx.setLineDash([])
      if (options.range) {
        const [x, y] = project(lerp(satPoint, target, 0.55))
        label(ctx,clamp(x + 8,8,w - 95),clamp(y + 7,8,h - 28),selected.range.toFixed(1) + ' m',null,'#b3f7e0')
      }
      if (options.outbound) {
        const center = frame.time * 0.78 % 1
        for (let i = 0; i < 8; i++) {
          const q = (center + i / 8) % 1
          const here = lerp(satPoint, target, q)
          const extent = 7 + q * 38
          const arc = Array.from({length: 13}, (_, j) => {
            const u = j / 12 * 2 - 1
            return p(here[0] + extent * u, here[1] - extent * 0.32 * u, here[2] - extent * 0.5 * (1 - u*u))
          })
          line(arc, '#49efd4c0', 1.5)
        }
      }
      if (options.echo && !shadow) {
        const a = project(target), b = project(satPoint)
        const bend = [(a[0] + b[0]) / 2 + 44, (a[1] + b[1]) / 2 - 13]
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(...bend,b[0],b[1])
        ctx.strokeStyle = '#ffca71'; ctx.lineWidth = 1.25; ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([])
        for (let i = 0; i < 3; i++) {
          const t = (frame.time * 0.65 + i / 3) % 1, u = 1 - t
          ctx.beginPath()
          ctx.arc(u*u*a[0]+2*u*t*bend[0]+t*t*b[0],u*u*a[1]+2*u*t*bend[1]+t*t*b[1],2.4,0,Math.PI*2)
          ctx.fillStyle = '#ffcb70'; ctx.fill()
        }
      }
      if (options.velocity) {
        const origin = project(satPoint), end = project(p(satPoint[0] + 69,satPoint[1],satPoint[2]))
        outline(ctx, [origin,end], null,'#b9d0e7',1.25,false)
        outline(ctx, [end,[end[0]-7,end[1]-2],[end[0]-5,end[1]+4]], '#b9d0e7')
        const moving = sceneObjects(config).find(obj => obj.id === frame.selected)
        if (Math.hypot(moving.vx || 0, moving.vy || 0) > 0) {
          const a = project(target), b = project(p(target[0] + moving.vx * 8, target[1] + moving.vy * 8, target[2]))
          const angle = Math.atan2(b[1]-a[1],b[0]-a[0])
          outline(ctx,[a,b],null,'#ffcc79',1.8,false)
          outline(ctx,[b,[b[0]-8*Math.cos(angle-0.45),b[1]-8*Math.sin(angle-0.45)],[b[0]-8*Math.cos(angle+0.45),b[1]-8*Math.sin(angle+0.45)]],'#ffcc79')
        }
      }
      model(add,...satPoint,'sat',2.3,-0.6)
      if (options.labels) {
        satelliteLabel = project(satPoint)
      }
    }
    faces.sort((a,b) => b.depth - a.depth)
    for (const face of faces) outline(ctx,face.projected,face.color,face.edge,0.7)
    for (const spot of frame.sourcePoints ?? []) {
      const [x,y] = project(p(spot.x,spot.y,spot.z+2))
      ctx.beginPath(); ctx.arc(x,y,3,0,Math.PI*2)
      ctx.fillStyle = sourceColors[spot.source]; ctx.fill()
    }
    if (satelliteLabel) {
      const [x, y] = satelliteLabel
      label(ctx,clamp(x - 48,8,w - 108),Math.max(8,y - 38),'SAR platform',null,'#c7def9')
    }
    if (options.labels) {
      for (const { point, obj } of hits) {
        const isPoint = obj.id.startsWith('point-')
        if (obj.id !== frame.selected && !geometry && !isPoint) continue
        const [x,y] = point
        if (isPoint) {
          const second = obj.id === 'point-b'
          const color = second ? '#f4ce80' : '#a5f6be'
          const lx = clamp(x + (second ? 14 : -105),8,w - 101)
          const ly = clamp(y - (second ? 31 : 19),9,h - 25)
          outline(ctx, [[x,y],[second ? lx : lx+77,ly+10]], null, color, 0.8, false)
          label(ctx,lx,ly,obj.label,null,color)
          continue
        }
        label(ctx,clamp(x + 12,8,w - 112),clamp(y - 28,9,h - 25),obj.label,null,obj.id === frame.selected ? '#a5f6be' : '#ced8d5')
      }
    }
  }

  canvas.addEventListener('pointerdown', e => {
    if (canvas.closest('.space-mode')) return
    drag = { x: e.clientX, y: e.clientY, ...view, pointerX: e.clientX, pointerY: e.clientY, pan: e.shiftKey || e.button !== 0 }
    moved = false
    canvas.setPointerCapture(e.pointerId)
  })
  canvas.addEventListener('pointermove', e => {
    if (!drag) return
    const dx = e.clientX - drag.pointerX, dy = e.clientY - drag.pointerY
    moved ||= Math.hypot(dx,dy) > 4
    if (!moved) return
    if (drag.pan) {
      view.x = drag.x - (Math.cos(view.az) * dx + Math.sin(view.az) * dy) * 1.3
      view.y = drag.y - (Math.sin(view.az) * dx - Math.cos(view.az) * dy) * 1.3
    } else {
      view.az = drag.az + dx * 0.008
      view.tilt = clamp(drag.tilt + dy * 0.007,0.14,1.36)
    }
    draw()
  })
  canvas.addEventListener('pointerup', e => {
    if (drag && !moved) {
      const rect = canvas.getBoundingClientRect()
      const distances = hits.map(({ point: [x,y], obj }) => ({ obj, distance: Math.hypot(e.clientX-rect.left-x,e.clientY-rect.top-y) }))
      distances.sort((a,b) => a.distance - b.distance)
      if (distances[0]?.distance < 38) onSelect(distances[0].obj.id)
    }
    drag = null
  })
  canvas.addEventListener('pointercancel', () => { drag = null })
  canvas.addEventListener('contextmenu', e => e.preventDefault())
  canvas.addEventListener('wheel', e => { if (canvas.closest('.space-mode')) return; e.preventDefault(); view.distance = clamp(view.distance * Math.exp(e.deltaY * 0.001),120,1750); draw() }, { passive: false })
  return {
    render(next, params, visibility) { frame = next; config = params; options = visibility; draw() },
    draw,
    reset() { Object.assign(view, defaults); draw() },
  }
}
