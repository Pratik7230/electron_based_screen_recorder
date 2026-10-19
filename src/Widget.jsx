import { useEffect, useState } from 'react'
import { Pause, Play, Square, X } from 'lucide-react'
import { fmt } from './format'
import './Widget.css'

export default function Widget() {
  const [state, setState] = useState({ phase: 'countdown', elapsed: 0, count: 5 })

  useEffect(() => window.recorder.onWidgetState(setState), [])

  const act = (a) => window.recorder.widgetAction(a)

  if (state.phase === 'countdown') {
    return (
      <div className="widget">
        <div className="count">{state.count}</div>
        <div className="label">Recording starts…</div>
        <button className="wbtn" onClick={() => act('cancel')} title="Cancel">
          <X size={16} />
        </button>
      </div>
    )
  }

  const paused = state.phase === 'paused'
  return (
    <div className="widget">
      <span className={`dot ${paused ? 'paused' : ''}`} />
      <div className="time">{fmt(state.elapsed)}</div>
      <div className="spacer" />
      <button className="wbtn" onClick={() => act('pause')} title={paused ? 'Resume' : 'Pause'}>
        {paused ? <Play size={16} /> : <Pause size={16} />}
      </button>
      <button className="wbtn stop" onClick={() => act('stop')} title="Stop & save">
        <Square size={14} fill="currentColor" />
      </button>
    </div>
  )
}