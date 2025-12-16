// Stable, known-good client script: polls /api/state and renders bus + popup dots
let stops = 10
let polling = null
let pollInterval = 1000
let playing = true
let lastData = null
let displayedStop = 0

// per-stop positions and assignments
const MAX_SLOTS = 20
const positionsByStop = {}    // stop -> [{x,y},...]
const assignmentByStop = {}   // stop -> { hash: slotIndex }

async function fetchState(){
  try{
    const res = await fetch('/api/state')
    const data = await res.json()
    lastData = data
    if(typeof data.current_stop === 'number') displayedStop = data.current_stop
    document.getElementById('last-update').innerText = data.last_update ? `Última: ${data.last_update}` : ''
    updateUI(data)
  }catch(err){
    console.error('fetchState error', err)
  }
}

function ensurePositionsForStop(stop){
  if(positionsByStop[stop]) return positionsByStop[stop]
  const busRect = document.getElementById('popupBusRect')
  const rectX = Number(busRect.getAttribute('x'))
  const rectY = Number(busRect.getAttribute('y'))
  const rectW = Number(busRect.getAttribute('width'))
  const rectH = Number(busRect.getAttribute('height'))
  const padding = 12
  const minDist = 20
  const positions = []
  function randBetween(a,b){ return a + Math.random()*(b-a) }
  let tries = 0
  while(positions.length < MAX_SLOTS && tries < 2000){
    const cx = Math.round(randBetween(rectX + padding, rectX + rectW - padding))
    const cy = Math.round(randBetween(rectY + padding, rectY + rectH - padding))
    let ok = true
    for(const p of positions){
      const dx = p.x - cx, dy = p.y - cy
      if(Math.hypot(dx,dy) < minDist){ ok = false; break }
    }
    if(ok) positions.push({x:cx,y:cy})
    tries++
  }
  if(positions.length === 0){
    for(let i=0;i<Math.min(MAX_SLOTS,8);i++) positions.push({x:rectX+padding + i*30, y:rectY+padding+20})
  }
  positionsByStop[stop] = positions
  assignmentByStop[stop] = {}
  return positions
}

function hashIndex(h, len){
  let v = 0
  for(let i=0;i<h.length;i++) v = (v*31 + h.charCodeAt(i)) >>> 0
  return v % len
}

function updateUI(data){
  const current = (typeof data.current_stop === 'number') ? data.current_stop : 0
  stops = data.stops ?? stops
  document.getElementById('state-text').innerText = `Parada ${current}`

  // move bus
  const bus = document.getElementById('bus')
  const x = 50 + (current/(Math.max(stops-1,1))) * 900
  bus.setAttribute('transform', `translate(${x},40)`)

  // highlight stops
  const stopEls = document.querySelectorAll('circle.stop')
  stopEls.forEach((el, idx)=>{
    el.setAttribute('fill', idx === current ? 'var(--accent2)' : '#f0f3f7')
    el.setAttribute('r', idx === current ? 14 : 12)
  })

  // popup dots
  const dotsGroup = document.getElementById('popup-dots')
  const tooltip = document.getElementById('popup-tooltip')
  if(!dotsGroup) return
  while(dotsGroup.firstChild) dotsGroup.removeChild(dotsGroup.firstChild)
  const hashes = data.hashes || []

  const positions = ensurePositionsForStop(current)
  const assignment = assignmentByStop[current] || (assignmentByStop[current] = {})

  // remove assignments for hashes no longer present
  const present = new Set(hashes)
  for(const k of Object.keys(assignment)) if(!present.has(k)) delete assignment[k]

  // assign deterministically
  for(const h of hashes){
    if(assignment[h] === undefined){
      const start = hashIndex(h, positions.length)
      let chosen = start
      for(let i=0;i<positions.length;i++){
        const idx = (start + i) % positions.length
        let occupied = false
        for(const key in assignment) if(assignment[key] === idx){ occupied = true; break }
        if(!occupied){ chosen = idx; break }
      }
      assignment[h] = chosen
    }
  }

  // render
  for(const h of hashes){
    const slot = assignment[h] % positions.length
    const pos = positions[slot]
    const c = document.createElementNS('http://www.w3.org/2000/svg','circle')
    c.setAttribute('cx', pos.x)
    c.setAttribute('cy', pos.y)
    c.setAttribute('r', 9)
    c.setAttribute('fill', '#e44')
    c.setAttribute('data-hash', h)
    c.addEventListener('mouseenter', (ev)=>{
      ev.stopPropagation()
      const hv = ev.target.getAttribute('data-hash')
      if(tooltip){
        const wrap = document.getElementById('popup-bus-wrap')
        const rect = wrap.getBoundingClientRect()
        const left = ev.clientX - rect.left + 8
        const top = ev.clientY - rect.top + 8
        tooltip.style.left = `${Math.min(left, rect.width - 20)}px`
        tooltip.style.top = `${Math.max(top, 8)}px`
        tooltip.classList.remove('hidden')
        tooltip.innerText = hv
      }
    })
    c.addEventListener('mouseleave', ()=>{ if(tooltip) tooltip.classList.add('hidden') })
    dotsGroup.appendChild(c)
  }
}

function startPolling(){
  stopPolling()
  polling = setInterval(()=>{ if(playing) fetchState() }, pollInterval)
}
function stopPolling(){ if(polling) clearInterval(polling); polling = null }

window.addEventListener('load', ()=>{
  fetchState()
  startPolling()

  const busEl = document.getElementById('bus')
  if(busEl){
    busEl.style.cursor = 'pointer'
    busEl.addEventListener('click', ()=>{
      const popup = document.getElementById('popup')
      if(popup) popup.classList.remove('hidden')
      const tt = document.getElementById('popup-tooltip')
      if(tt) tt.classList.add('hidden')
    })
  }
  const close = document.getElementById('close')
  if(close) close.addEventListener('click', ()=>{ document.getElementById('popup').classList.add('hidden') })

  const popup = document.getElementById('popup')
  if(popup) popup.addEventListener('click', ()=>{ const tt = document.getElementById('popup-tooltip'); if(tt) tt.classList.add('hidden') })

  const pauseBtn = document.getElementById('pauseBtn')
  const prevBtn = document.getElementById('prevBtn')
  const nextBtn = document.getElementById('nextBtn')
  const speed = document.getElementById('speed')
  if(pauseBtn) pauseBtn.addEventListener('click', ()=>{ playing = !playing; pauseBtn.innerText = playing ? '⏸️' : '▶' })
  if(prevBtn) prevBtn.addEventListener('click', ()=>{ if(lastData) { displayedStop = Math.max(0, displayedStop - 1); updateUI(lastData) } })
  if(nextBtn) nextBtn.addEventListener('click', ()=>{ if(lastData) { displayedStop = Math.min((lastData.stops||stops)-1, displayedStop + 1); updateUI(lastData) } })
  if(speed) speed.addEventListener('input', (e)=>{ pollInterval = Number(e.target.value); startPolling() })
})
