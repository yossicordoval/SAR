import { createAcquisition, DEFAULTS } from './physics.js'
import { createFocuser } from './processing.js'
import { createOrbitalAcquisition, focusOrbital } from './orbital-acquisition.js'

let ground
function referencePatch() {
  if (!ground) {
    const acquisition=createAcquisition({...DEFAULTS,scenario:'shared-orbital-patch',clutter:false,noise:0,prf:16})
    const {width,height,count,bins,i,q,tracks,minRange,dr}=acquisition
    ground={width,height,count,bins,minRange,dr,tracks:Object.values(tracks),
      raw:i.map((value,i)=>Math.hypot(value,q[i])),values:createFocuser(acquisition)(count-1,false)}
  }
  return ground
}

self.onmessage = ({data:{revision,config,compare}}) => {
  const state = createOrbitalAcquisition(config)
  if (!state) {
    self.postMessage({revision,state:null})
    return
  }
  const image=focusOrbital(state)
  const corrected=['urban','rural','ridge'].includes(config.terrain) ? focusOrbital(state,true) : image
  const {sensors,rangeQ,...data} = state
  const compressed = state.rangeI.map((value,i)=>Math.hypot(value,rangeQ[i]))
  delete data.rangeI
  const transferred = [...new Set([data.rawI.buffer,data.rawQ.buffer,compressed.buffer,image.values.buffer,corrected.values.buffer])]
  self.postMessage({revision,state:{...data,compressed,image,corrected,ground:compare?referencePatch():undefined}},transferred)
}
