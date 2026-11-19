import { C } from './physics.js'
import { nadirPair, rangeTiming } from './orbital-acquisition.js'
import { EARTH_RADIUS, orbitalObservation } from './space-model.js'

const ink='#acc9e8', cyan='#63f3e5', amber='#ffcb8e', dim='#395975', purple='#aa9fed'
const tau=2*Math.PI
const sequence=(count,fn)=>Array.from({length:count},(_,i)=>fn(i/(count-1)))
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n))
const format=(v,n=1)=>Number.isFinite(v)?v.toFixed(n):'—'
function text(ctx,string,x,y,color=ink) {
  ctx.fillStyle=color
  ctx.fillText(string,x,y)
}
function line(ctx,points,color=dim,dash=[]) {
  if (!points.length) return
  ctx.beginPath()
  points.forEach(([x,y],i)=>i ? ctx.lineTo(x,y) : ctx.moveTo(x,y))
  ctx.strokeStyle=color
  ctx.setLineDash(dash)
  ctx.stroke()
  ctx.setLineDash([])
}
function polygon(ctx,points,color) {
  ctx.beginPath()
  points.forEach(([x,y],i)=>i ? ctx.lineTo(x,y) : ctx.moveTo(x,y))
  ctx.closePath()
  ctx.fillStyle=color
  ctx.fill()
}
function dot(ctx,p,color=cyan,size=2.2) {
  ctx.beginPath(); ctx.arc(p[0],p[1],size,0,tau)
  ctx.fillStyle=color; ctx.fill()
}
function satellite(ctx,p) {
  const [x,y]=p
  ctx.fillStyle='#5b86c4'
  ctx.fillRect(x-13,y-3,8,6); ctx.fillRect(x+5,y-3,8,6)
  ctx.fillStyle='#d1eaff'; ctx.fillRect(x-4,y-5,8,10)
  line(ctx,[[x-4,y+6],[x,y+9],[x+4,y+6]],cyan)
}

function coordinates(lat,lon) {
  return [Math.cos(lat)*Math.sin(lon),Math.sin(lat),Math.cos(lat)*Math.cos(lon)]
}

const continents = [
  [[-168,62],[-123,70],[-94,75],[-61,55],[-77,29],[-102,19],[-122,37],[-148,55]],
  [[-82,14],[-51,9],[-34,-7],[-52,-43],[-71,-55],[-79,-9]],
  [[-13,35],[18,44],[42,29],[52,4],[37,-22],[20,-37],[-8,-6],[-19,14]],
  [[-4,45],[28,65],[67,75],[119,67],[171,55],[131,27],[111,8],[80,25],[58,26],[47,41],[30,34]],
  [[114,-17],[136,-10],[154,-27],[149,-42],[112,-31]], [[-66,61],[-26,56],[-20,78],[-52,83]],
]
function inLand(lon,lat) {
  return continents.some(poly=>{
    let inside=false
    for (let i=0,j=poly.length-1;i<poly.length;j=i++) {
      const [x,y]=poly[i], [u,v]=poly[j]
      if ((y>lat)!==(v>lat) && lon<(u-x)*(lat-y)/(v-y)+x) inside=!inside
    }
    return inside
  })
}
const earthFaces = []
for(let lat=-90;lat<90;lat+=10) for(let lon=-180;lon<180;lon+=10) {
  const corners = [[lat,lon],[lat+10,lon],[lat+10,lon+10],[lat,lon+10]]
    .map(([a,b])=>coordinates(a*Math.PI/180,b*Math.PI/180))
  const land=inLand(lon+5,lat+5), polar=Math.abs(lat+5)>74
  earthFaces.push({points:[corners[0],corners[1],corners[2]],land,polar,tone:(lon+lat)%17},
    {points:[corners[0],corners[2],corners[3]],land,polar,tone:(lon+lat+4)%19})
}

function earthView(ctx,config,o,view) {
  const cx=159+view.panX, cy=91+view.panY, r=68*view.zoom
  const cyaw=Math.cos(view.yaw), syaw=Math.sin(view.yaw), cpitch=Math.cos(view.pitch), spitch=Math.sin(view.pitch)
  const project = ([x,y,z],scale=1) => {
    const a=x*cyaw+z*syaw, depth=z*cyaw-x*syaw
    return [cx+r*scale*a,cy-r*scale*(y*cpitch-depth*spitch),depth*cpitch+y*spitch]
  }
  const glow=ctx.createRadialGradient(cx,cy,r*.93,cx,cy,r*1.22)
  glow.addColorStop(0,'#24629c'); glow.addColorStop(.42,'#25558e89'); glow.addColorStop(1,'#12315500')
  dot(ctx,[cx,cy],glow,r*1.22)
  dot(ctx,[cx,cy],'#102844',r)
  const faces=earthFaces.map(face=>{
    const points=face.points.map(point=>project(point))
    return {...face,points,depth:points.reduce((s,p)=>s+p[2],0)/3}
  }).filter(face=>face.depth>.025).sort((a,b)=>a.depth-b.depth)
  for (const {points,depth,land,polar,tone} of faces) {
    const k=clamp(.41+depth*.59,.35,1)
    const base=polar ? [118,158,181] : land ? [43,119,119] : [26,72,129]
    polygon(ctx,points,`rgb(${base.map(c=>Math.round(c*k+tone*.32)).join(',')})`)
  }
  const trackPoint = (t,offset=0) => coordinates(.55*Math.sin(t),t+offset)
  const orbitRadius=1.14+(config.altitude-350)/4700
  function track(scale,color,offset=0,visible=true) {
    const points=sequence(160,u=>project(trackPoint((u-.5)*tau,offset),scale))
    for(let j=1;j<points.length;j++) {
      if (visible && points[j][2]<0) continue
      const hidden=points[j][2] < 0
      // Back-side arcs are occluded by the disk.
      if (hidden && Math.hypot(points[j][0]-cx,points[j][1]-cy)<r) continue
      line(ctx,[points[j-1],points[j]],hidden?'#345277':color,hidden?[2,3]:[])
    }
  }
  track(orbitRadius,purple,0,false)
  track(1,'#5b94c8')
  if(view.mark==='track') track(1,amber,-o.nadirShift*Math.PI/180)
  const t=(view.progress-.5)*1.6*config.speedScale
  const s=project(trackPoint(t),orbitRadius), nadir=project(trackPoint(t))
  if (nadir[2]>0) {
    dot(ctx,nadir,amber)
    const off=.55*Math.sin(t)+Math.min(.65,o.look?.central ?? 0)
    const footprint=project(coordinates(off,t))
    if(o.look && footprint[2]>0) {
      const width=clamp((o.width??0)/12e3,3,18)
      ctx.beginPath(); ctx.ellipse(footprint[0],footprint[1],width,Math.max(3,width*.32),-.2,0,tau)
      ctx.fillStyle='#63f3e556'; ctx.fill();ctx.strokeStyle=cyan;ctx.stroke()
      line(ctx,[s,footprint],'#63f3e5a1')
    }
    line(ctx,[s,nadir],amber,[2,3])
  }
  if(view.mark==='velocity') {
    const ref=project(trackPoint((view.progress-.5)*1.6),orbitRadius)
    dot(ctx,ref,amber,3)
    if (Math.abs(s[0]-ref[0])>2) line(ctx,[ref,s],amber,[3,3])
    text(ctx,'Amber: circular reference at the same time',13,151,amber)
  }
  if(s[2]>=0 || Math.hypot(s[0]-cx,s[1]-cy)>r) satellite(ctx,s)
  text(ctx,'ORBIT • TRACK • FOOTPRINT',13,17)
  text(ctx,'Altitude exaggerated · drag to orbit · Shift to pan',13,167)
}

function geometryView(ctx,config,o,view) {
  const {mark,chapter,progress}=view
  const radius=209, cx=118, cy=308
  const surface=angle=>[cx+radius*Math.sin(angle),cy-radius*Math.cos(angle)]
  const sat=[cx,cy-radius*(1+config.altitude*1000/EARTH_RADIUS)]
  const show=term=>({Nadir:'nadir','Look angle':'look','Incidence angle':'incidence','Geometric horizon':'horizon',Swath:'swath'}[view.term]===term)
    || mark===term || mark==='overview'&&!view.term
  const flatOnly=mark==='curvature'&&chapter===0
  const curved=sequence(92,u=>surface((u-.5)*2))
  if(!flatOnly) {
    polygon(ctx,[...curved,[320,180],[0,180]],'#14354e')
    line(ctx,curved,'#4fa5cd')
    line(ctx,curved.map(([x,y])=>[x,y-2]),'#63bfd54a')
  }
  if (flatOnly || show('altitude') || mark==='curvature'&&chapter<3) line(ctx,[[14,99],[306,99]],'#9ea8c8',[4,4])
  satellite(ctx,sat)
  const n=surface(0)
  if(flatOnly) {
    text(ctx,'Flat reference plane',18,125)
    line(ctx,[sat,n],amber,[3,3]); return
  }
  const nadir=show('nadir') || show('look') || mark==='incidence' || mark==='curvature'&&chapter>=2
  if(nadir) {
    line(ctx,[sat,n],amber,[3,3]); dot(ctx,n,amber)
    text(ctx,'Nadir point',n[0]-49,n[1]+15,amber)
  }
  const angle=config.look*Math.PI/180
  const target=o.look ? surface(o.look.central) : null
  const beam=mark!=='curvature'||chapter>=3
  if (beam) {
    const near=surface(o.near?.central??0), far=surface(o.far.central)
    if(o.look) {
      if(show('swath') || mark==='timing' || mark==='strip' || mark==='urban' || ['Near range','Far range'].includes(view.term)) {
        polygon(ctx,[sat,near,far],'#6df9e330')
        line(ctx,[sat,near],cyan,[2,3])
        line(ctx,[sat,far],cyan,[2,3])
        line(ctx,sequence(18,u=>surface(o.near.central+(o.far.central-o.near.central)*u)),cyan)
        text(ctx,'Near',near[0]-15,near[1]+18)
        text(ctx,'Far',far[0]+6,far[1]+13)
      }
      line(ctx,[sat,target],cyan)
      line(ctx,[sat,[sat[0]+30*Math.sin(angle),sat[1]+30*Math.cos(angle)]],'#9afce8')
      dot(ctx,target)
      const f=1-Math.abs(2*progress-1)
      dot(ctx,[sat[0]+(target[0]-sat[0])*f,sat[1]+(target[1]-sat[1])*f],progress<.5?cyan:amber,3)
    } else line(ctx,[sat,[sat[0]+190*Math.sin(angle),sat[1]+190*Math.cos(angle)]],amber)
  }
  if(mark==='altitude') {
    const refConfig={...config,altitude:350}
    const ref=orbitalObservation(refConfig)
    const lower=[cx,cy-radius*(1+.35e6/EARTH_RADIUS)]
    line(ctx,[lower,surface(ref.look.central)],purple,[3,3])
    dot(ctx,lower,purple,2.2)
    text(ctx,'350 km reference',lower[0]-91,lower[1]+14,purple)
  }
  if(target && ['velocity','motion'].includes(mark)) {
    const direction=[sat[0]-37,sat[1]+4]
    line(ctx,[sat,direction],amber)
    line(ctx,[direction,[direction[0]+6,direction[1]-3]],amber)
    text(ctx,'Velocity has a line-of-sight component',14,141,amber)
  }
  if (show('look') || mark==='incidence' || mark==='curvature'&&chapter>=3) {
    ctx.beginPath(); ctx.arc(...sat,16,Math.PI/2-angle,Math.PI/2);ctx.strokeStyle=amber;ctx.stroke()
    text(ctx,`Look ${config.look}°`,sat[0]+23,sat[1]+13,amber)
  }
  if (target && (show('incidence') || mark==='curvature'&&chapter>=5)) {
    const p=o.look.central
    const normal=[target[0]+40*Math.sin(p),target[1]-40*Math.cos(p)]
    line(ctx,[target,normal],purple,[2,3])
    const direction=Math.atan2(sat[1]-target[1],sat[0]-target[0])
    const out=Math.atan2(normal[1]-target[1],normal[0]-target[0])
    ctx.beginPath();ctx.arc(...target,11,direction,out);ctx.strokeStyle=purple;ctx.stroke()
    text(ctx,`Incidence ${format(o.look.incidence)}°`,normal[0]+6,normal[1]+8,purple)
  }
  if (show('horizon') || !target || mark==='curvature'&&chapter>=8) {
    const tangent=surface(Math.acos(EARTH_RADIUS/(EARTH_RADIUS+config.altitude*1000)))
    const tail=[tangent[0]+74,tangent[1]+(tangent[1]-sat[1])*74/(tangent[0]-sat[0])]
    line(ctx,[sat,tangent,tail],purple,[3,3]);dot(ctx,tangent,purple)
    text(ctx,'Tangent',tangent[0]-12,tangent[1]+16,purple)
  }
  if (mark==='nadir' && config.look===0) {
    const paths=[surface(-.34),surface(.34)]
    paths.forEach((p,i)=>{line(ctx,[sat,p],i?cyan:purple);dot(ctx,p,i?cyan:purple)
      text(ctx,i?'B':'A',p[0],p[1]+13)})
    const [a,b]=nadirPair(config)
    text(ctx,`A and B arrive at ${format(a.delay*1e3,5)} ms`,13,151)
    text(ctx,`Delay difference ${format((a.delay-b.delay)*1e9,2)} ns · symmetric paths`,13,167)
  } else if(mark==='power' && target) {
    for (let j=1;j<5;j++) {
      const f=(j/5+progress)%1
      const x=sat[0]+(target[0]-sat[0])*f, y=sat[1]+(target[1]-sat[1])*f
      ctx.beginPath();ctx.ellipse(x,y,5+43*f,3+12*f,.1,0,tau);ctx.strokeStyle='#8aead283';ctx.stroke()
    }
    text(ctx,'Outgoing and returning energy both spread',12,164)
  } else {
    text(ctx,target?`Spherical path ${format(o.look.range/1000)} km · ${format(o.look.range*2000/C,3)} ms`:'The boresight ray misses Earth',13,162,target?ink:amber)
  }
  text(ctx,'CURVED EARTH SECTION · EXAGGERATED VIEW',13,16)
}

function chart(ctx,title,axis) {
  text(ctx,title,12,18)
  line(ctx,[[29,32],[29,145],[305,145]],dim)
  ;[48,80,112].forEach(y=>line(ctx,[[29,y],[305,y]],'#172e48'))
  text(ctx,axis,29,165)
}
function signalView(ctx,c,o,view,compact=false) {
  if(view.signal==='timing') return timingView(ctx,c,o,view.progress)
  const state=view.data
  if(!state) { text(ctx,o.look?'Computing the orbital receive gate…':'No surface return along the selected ray',15,87); return }
  const pulse=clamp(view.pulses-1,0,state.count-1)
  if(view.signal==='raw' || compact) {
    matrix(ctx,state,view.pulses)
    return
  }
  if(view.pulses===0) { text(ctx,'Step or play to acquire the first echo',15,88);return }
  if(view.signal==='doppler') {
    chart(ctx,'DOPPLER · SELECTED PATCH REFLECTOR','Slow time · sampled aperture →')
    const history=state.tracks[view.target]??state.tracks[1]
    const max=Math.max(1,...history.map(value=>Math.abs(value.doppler)),c.prf/2)
    const plotY=v=>88-51*v/max
    const plotX=i=>29+276*i/(state.count-1)
    line(ctx,[[29,88],[305,88]],dim)
    line(ctx,history.map((value,i)=>[plotX(i),plotY(value.doppler)]),cyan)
    line(ctx,history.slice(1).map((value,i)=>{
      const change=value.phase-history[i].phase
      const estimate=Math.atan2(Math.sin(change),Math.cos(change))*c.prf/(2*Math.PI)
      return [plotX(i+.5),plotY(estimate)]
    }),amber,[2,3])
    dot(ctx,[plotX(pulse),plotY(history[pulse].doppler)],cyan,3)
    text(ctx,`${format(history[pulse].doppler)} Hz true · dashed amber = wrapped samples`,30,157)
    return
  }
  const iq=view.signal==='iq'
  chart(ctx,iq?'COMPLEX RECEIVED ECHO · I / Q':'RANGE PROFILE · MATCHED FILTER','Slant-range offset within receive gate →')
  const offset=pulse*state.bins
  const primary=(iq?state.rawI:state.compressed).subarray(offset,offset+state.bins)
  const secondary=iq?state.rawQ.subarray(offset,offset+state.bins):[]
  const max=Math.max(1,...primary.map(Math.abs),...Array.from(secondary,Math.abs))
  const x=i=>29+275*i/(state.bins-1)
  const y=v=>iq?88-v*46/max:144-v*105/max
  line(ctx,Array.from(primary,(value,i)=>[x(i),y(value)]),cyan)
  if(iq) line(ctx,Array.from(secondary,(value,i)=>[x(i),y(value)]),amber)
  if(!iq) {
    for (let i=0;i<state.targets.length;i++) {
      const measured=state.tracks[i][pulse].range
      const px=x((measured-state.minRange)/state.dr)
      line(ctx,[[px,38],[px,144]],i===view.target?amber:dim,[3,3])
      text(ctx,state.targets[i].id,px+3,36,i===view.target?amber:ink)
    }
  }
  text(ctx,`Gate starts ${format(2*state.minRange/C*1e3,4)} ms`,29,177)
}

const raster = new WeakMap()
function colors(values,width,height,key,kind,limit=height) {
  let cached=raster.get(key)
  if(!cached || cached.limit!==limit) {
    const canvas=document.createElement('canvas')
    canvas.width=width;canvas.height=height
    const c=canvas.getContext('2d')
    const data=c.createImageData(width,height)
    for(let row=0;row<height;row++) for(let column=0;column<width;column++) {
      const i=row*width+column
      const sample=row>=limit?0:values(i)
      const v=clamp((Math.log10(Math.max(sample,1e-4))+1.75)/1.72,0,1)
      const base=kind==='matrix'?[27,187,228]:[170,229,243]
      const k=(kind==='matrix'?i:(height-1-row)*width+column)*4
      data.data[k]=7+base[0]*v; data.data[k+1]=15+base[1]*v; data.data[k+2]=26+base[2]*v; data.data[k+3]=255
    }
    c.putImageData(data,0,0)
    cached={canvas,limit}
    raster.set(key,cached)
  }
  return cached.canvas
}
function matrix(ctx,state,pulses) {
  text(ctx,`RAW I/Q MAGNITUDE · ${pulses} / ${state.count} PULSES`,13,15)
  const image=colors(i=>Math.hypot(state.rawI[i],state.rawQ[i]),state.bins,state.count,state,'matrix',pulses)
  ctx.drawImage(image,23,26,274,125)
  line(ctx,[[23,26],[23,151],[297,151]],dim)
  if(pulses) for (const track of state.tracks.slice(0,3)) {
    line(ctx,track.slice(0,pulses).map((m,i)=>[23+274*(m.range-state.minRange)/(state.dr*(state.bins-1)),26+125*(i+.5)/state.count]),amber,[2,2])
  }
  text(ctx,'Fast time → · pulse order runs downward',26,168)
}
function rangeHistory(ctx,state,pulses,targetIndex) {
  if(!state) {text(ctx,'Waiting for the orbital receive gate',15,91);return}
  const tracks=[state.tracks[targetIndex]??state.tracks[1]]
  const labelTitle=state.ground?'AIRBORNE AND ORBITAL RANGE HISTORY':'ORBITAL RANGE HISTORY · MAGNIFIED'
  chart(ctx,labelTitle,'Pulse position along each aperture →')
  const track=tracks[0], anchor=Math.min(...track.map(m=>m.range))
  const change=Math.max(...track.map(m=>m.range))-anchor
  const squeeze = (range, origin, span) => 139-103*(range-origin)/Math.max(.000001,span)
  if(state.ground) {
    const ref=state.ground.tracks[1], low=Math.min(...ref.map(m=>m.range)), span=Math.max(...ref.map(m=>m.range))-low
    line(ctx,ref.map((m,i)=>[29+276*i/(ref.length-1),squeeze(m.range,low,span)]),purple,[4,3])
    text(ctx,`Airborne ${format(span)} m · orbital ${format(change,3)} m (independent scales)`,30,28)
  }
  const points=track.slice(0,pulses).map((m,i)=>[29+276*i/(track.length-1),squeeze(m.range,anchor,change)])
  line(ctx,points,cyan)
  if(points.length) dot(ctx,points.at(-1),amber)
  text(ctx,`Orbital range variation across patch aperture: ${format(change,3)} m`,29,178)
}

function timingView(ctx,c,o,progress) {
  const timing=rangeTiming(c,o)
  text(ctx,'TRANSMIT AND RECEIVE WINDOWS',13,18)
  if(!timing.returns.length) { text(ctx,'The selected beam misses Earth',18,90);return }
  const t=timing.returns[0]
  const max=timing.returns[2].far
  const x=v=>24+268*v/max
  line(ctx,[[24,52],[293,52]],dim)
  line(ctx,[[24,119],[293,119]],dim)
  const cycles=Math.min(32,Math.floor(max/timing.period)+1)
  for(let i=0;i<cycles;i++) line(ctx,[[x(i*timing.period),47],[x(i*timing.period),56]],i<3?cyan:dim)
  timing.returns.forEach((event,i)=>{
    const y=83+i*15
    line(ctx,[[x(event.start),52],[x(event.near),y]],'#52769b',[2,3])
    ctx.fillStyle=[cyan,purple,amber][i]
    ctx.fillRect(x(event.near),y,Math.max(3,x(event.far)-x(event.near)),7)
  })
  line(ctx,[[x(progress*max),33],[x(progress*max),135]],'#e0ffef65')
  text(ctx,`First near ${format(t.near*1e3,3)} ms · interval ${format(timing.period*1e3,3)} ms`,14,151)
  text(ctx,timing.overlap?'Adjacent receive windows overlap':'Windows separated in this ideal timing model',14,167,timing.overlap?amber:cyan)
}
function imageView(ctx,c,o,view) {
  const {data,product}=view
  if(product==='coverage') {
    text(ctx,'SIDE-LOOKING SWATH · SCHEMATIC',13,17)
    if(!o.look) {text(ctx,'No surface intersection',15,92);return}
    const width=clamp(o.width/2900,11,100), length=clamp(o.azimuthLength/480,31,250)
    polygon(ctx,[[15,40],[304,40],[304,147],[15,147]],'#153754')
    line(ctx,[[15,52],[304,52]],purple,[2,3])
    ctx.fillStyle='#62efe242';ctx.fillRect(35,73,length,width*.7);ctx.strokeStyle=cyan;ctx.strokeRect(35,73,length,width*.7)
    ctx.strokeStyle=amber;ctx.strokeRect(145,80,15,12)
    text(ctx,'Teaching patch (exaggerated)',165,94)
    text(ctx,`${format(o.azimuthLength/1000)} km along × ${format(o.width/1000)} km across`,13,165)
    return
  }
  if(product==='range') {
    if(!o.look) {text(ctx,'No surface intersection',13,90);return}
    chart(ctx,'GROUND ARC TO SLANT RANGE','Across the swath →')
    const span=Math.max(.01,o.far.range-o.near.range)
    const r=EARTH_RADIUS+c.altitude*1e3
    line(ctx,sequence(100,u=>{
      const angle=o.near.central+(o.far.central-o.near.central)*u
      const range=Math.hypot(r-EARTH_RADIUS,2*Math.sqrt(r*EARTH_RADIUS)*Math.sin(angle/2))
      return [29+276*u,144-105*(range-o.near.range)/span]
    }),cyan)
    text(ctx,`Near ${format(o.near.range/1000)} km · Far ${format(o.far.range/1000)} km`,30,177)
    return
  }
  if(!data){text(ctx,o.look?'Focusing the reference patch…':'No orbit image for this ray',14,91);return}
  if(product==='compare'&&data.ground) {
    const a=data.ground,b=data.image
    ctx.drawImage(colors(i=>a.values[i],a.width,a.height,a,'image'),12,33,141,116)
    ctx.drawImage(colors(i=>b.values[i],b.width,b.height,b,'image'),165,33,141,116)
    text(ctx,'Airborne · 440 × 340 m',13,23)
    text(ctx,'Orbital · 280 × 210 m',170,23)
    text(ctx,`Pulses ${a.count} / ${data.count} · delay ${format(a.tracks[1][a.count>>1].delay*1e6,2)} µs / ${format(data.tracks[1][data.count>>1].delay*1e3,3)} ms`,12,165)
    text(ctx,`Aperture ${format(8*82,0)} m / ${format((data.times.at(-1)-data.times[0])*data.observation.speed,0)} m`,12,177)
    return
  }
  const corrected=product==='terrain'||c.focus==='elevation'
  const img=corrected?data.corrected:data.image
  const finalFrame=view.pulses>=data.count || view.mark!=='raw'
  text(ctx,corrected?'ELEVATION-AWARE ORBITAL FOCUS':'REFERENCE-SPHERE ORBITAL FOCUS',13,17)
  if(!finalFrame) {text(ctx,'Collect the pulse rows to reveal the reconstruction',12,90);return}
  ctx.drawImage(colors(i=>img.values[i],img.width,img.height,img,'image'),31,29,254,117)
  data.targets.forEach((target,i)=>{
    const x=31+(target.x+140)*254/280, y=29+(105-target.y)*117/210
    if(view.overlay || i===view.target) {dot(ctx,[x,y],i===view.target?amber:cyan);text(ctx,target.id,x+5,y-4)}
  })
  text(ctx,'280 m along track × 210 m cross-track',16,165)
}

export function paintSpace(config,observation,view) {
  const painters={optical:earthView,geometry:geometryView,profile:signalView,
    raw:(ctx,c,o,v)=>v.signal==='raw'?rangeHistory(ctx,v.data,v.pulses,v.target):signalView(ctx,c,o,v,true),image:imageView}
  for (const [id,painter] of Object.entries(painters)) {
    const canvas=document.getElementById(id)
    const w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(2,window.devicePixelRatio||1)
    if(w<10||h<10) continue
    if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){
      canvas.width=Math.round(w*dpr); canvas.height=Math.round(h*dpr)
    }
    const ctx=canvas.getContext('2d')
    ctx.setTransform(1,0,0,1,0,0)
    ctx.fillStyle='#060d1c';ctx.fillRect(0,0,canvas.width,canvas.height)
    const sx=canvas.width/320, sy=canvas.height/180
    if (id==='optical' || id==='geometry') {
      const scale=Math.min(sx,sy)
      ctx.setTransform(scale,0,0,scale,(canvas.width-320*scale)/2,(canvas.height-180*scale)/2)
    } else ctx.setTransform(sx,0,0,sy,0,0)
    for(let i=0;i<44;i++) {ctx.fillStyle=i%9===0?'#567493':'#294760';ctx.fillRect((i*47+3)%317,i*89%178,.65,.7)}
    ctx.font='8.9px system-ui'
    painter(ctx,id==='geometry'?view.geometryConfig:config,id==='geometry'?view.geometryObservation:observation,view)
  }
}
