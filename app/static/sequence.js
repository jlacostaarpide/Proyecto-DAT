let seq = []
let idx = 0
let timer = null
let playing = false
let intervalMs = 800

function resetUI(){
  pause()
  seq = []
  idx = 0

  // bus al inicio
  const bus = document.getElementById('playerBus')
  if (bus) bus.setAttribute('transform', `translate(50,40)`)

  // lista inferior vacía
  const list = document.getElementById('sequenceList')
  if (list) list.innerHTML = ''

  // contador de frames
  const frameInfo = document.getElementById('frameInfo')
  if (frameInfo) frameInfo.innerText = '0/0'

  // agregados vacíos (por si existen en el HTML)
  const stopsEl = document.getElementById('stopsAggregate')
  const journeysEl = document.getElementById('journeys')
  if (stopsEl) stopsEl.innerHTML = ''
  if (journeysEl) journeysEl.innerHTML = ''
}

function renderFrame(i){
  const frame = seq[i]
  if(!frame) return

  const bus = document.getElementById('playerBus')
  const stops = frame.stops || 10
  const current = frame.current_stop || 0
  const x = 50 + (current / (Math.max(stops - 1, 1))) * 900
  if (bus) bus.setAttribute('transform', `translate(${x},40)`)

  // update list (formato: Stop X -> N people detected -- fecha/hora)
  const list = document.getElementById('sequenceList')
  if (!list) return
  list.innerHTML = ''

  seq.forEach((f, j) => {
    const div = document.createElement('div')
    div.className = 'item'
    div.style.padding = '6px'
    div.style.borderBottom = '1px solid #eef2f7'
    if (j === i) div.style.background = 'linear-gradient(90deg, rgba(23,102,166,0.06), rgba(43,136,136,0.03))'

    const count = (f.hashes || []).length
    const stop = f.current_stop ?? 0

    let when = ''
    if (f.timestamp) {
      const d = new Date(f.timestamp)
      when = d.toLocaleString('es-ES', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      })
    }

    div.textContent = `Stop ${stop} -> ${count} people detected -- ${when}`
    list.appendChild(div)
  })

  const frameInfo = document.getElementById('frameInfo')
  if (frameInfo) frameInfo.innerText = `${i + 1}/${seq.length}`
}

function play(){
  if(playing) return
  if(seq.length === 0) return // nada que reproducir

  playing = true
  document.getElementById('playPause').innerText = '⏸️'

  timer = setInterval(() => {
    idx = Math.min(seq.length - 1, idx + 1)
    renderFrame(idx)
    if(idx >= seq.length - 1) pause()
  }, intervalMs)
}

function pause(){
  playing = false
  const btn = document.getElementById('playPause')
  if (btn) btn.innerText = '▶'
  if(timer) clearInterval(timer)
  timer = null
}

function loadSequence(data){
  pause()
  seq = Array.isArray(data) ? data : []
  idx = 0

  if (seq.length === 0){
    resetUI()
    return
  }

  renderFrame(0)

  // agregados DESACTIVADOS (no los quieres al cargar)
  renderAggregates()
}

/* ---- Agregados (los dejo por si quieres reactivarlos) ---- */
function computeAggregates(){
  const stopsMap = {} // stop -> Set of hashes
  const journeys = {} // hash -> array of stops (ordered)
  seq.forEach((frame)=>{
    const s = frame.current_stop || 0
    const hs = frame.hashes || []
    if(!stopsMap[s]) stopsMap[s] = new Set()
    hs.forEach(h=> stopsMap[s].add(h))
    hs.forEach(h=>{
      if(!journeys[h]) journeys[h] = []
      const arr = journeys[h]
      if(arr.length === 0 || arr[arr.length-1] !== s) arr.push(s)
    })
  })
  return {stopsMap, journeys}
}

function renderAggregates(){
  const containers = computeAggregates()
  const stopsMap = containers.stopsMap
  const journeys = containers.journeys

  const stopsEl = document.getElementById('stopsAggregate')
  const journeysEl = document.getElementById('journeys')

  if(stopsEl){
    stopsEl.innerHTML = ''
    const keys = Object.keys(stopsMap).sort((a,b)=>a-b)
    keys.forEach(k=>{
      const set = stopsMap[k]
      const div = document.createElement('div')
      div.style.marginBottom = '6px'
      div.innerHTML = `<strong>Parada ${k}:</strong> ${Array.from(set).join(', ')}`
      stopsEl.appendChild(div)
    })
  }

  if(journeysEl){
    journeysEl.innerHTML = ''
    const hashes = Object.keys(journeys).sort()
    hashes.forEach(h=>{
      const arr = journeys[h]
      const btn = document.createElement('button')
      btn.style.display = 'block'
      btn.style.width = '100%'
      btn.style.textAlign = 'left'
      btn.style.marginBottom = '6px'
      btn.textContent = `${h}: ${arr.join(' → ')}`
      btn.addEventListener('click', ()=>{
        for(let i=0;i<seq.length;i++){
          if((seq[i].hashes || []).includes(h)){
            idx = i
            renderFrame(idx)
            break
          }
        }
      })
      journeysEl.appendChild(btn)
    })
  }
}
/* --------------------------------------------------------- */

window.addEventListener('load', () => {
  // IMPORTANTE: no cargar nada por defecto
  resetUI()

  document.getElementById('playPause').addEventListener('click', () => {
    if(playing) pause()
    else play()
  })

  document.getElementById('prev').addEventListener('click', () => {
    if(seq.length === 0) return
    idx = Math.max(0, idx - 1)
    renderFrame(idx)
  })

  document.getElementById('next').addEventListener('click', () => {
    if(seq.length === 0) return
    idx = Math.min(seq.length - 1, idx + 1)
    renderFrame(idx)
  })

  document.getElementById('speedRange').addEventListener('input', (e) => {
    intervalMs = Number(e.target.value)
    if(playing){ pause(); play(); }
  })

  const upload = document.getElementById('fileUpload')
  upload.addEventListener('change', async (e) => {
    const f = e.target.files[0]
    if(!f) return
    try{
      const text = await f.text()
      const data = JSON.parse(text)
      loadSequence(data)
    }catch(err){
      alert('JSON no válido')
      resetUI()
    }
  })
})
