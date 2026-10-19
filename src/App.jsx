import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AppWindow, Circle, FolderOpen, Mic, MicOff, Monitor, Pause, Play, RefreshCw, Square, Volume2, VolumeX,
} from 'lucide-react'
import './App.css'

const fmt = (s) => {
  const h = String(Math.floor(s / 3600)).padStart(2, '0')
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const sec = String(s % 60).padStart(2, '0')
  return `${h}:${m}:${sec}`
}

function pickMimeType() {
  const options = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
  return options.find((t) => MediaRecorder.isTypeSupported(t))
}

export default function App() {
  const [sources, setSources] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [systemAudio, setSystemAudio] = useState(true)
  const [micOn, setMicOn] = useState(false)
  const [status, setStatus] = useState('idle') // idle | recording | paused
  const [elapsed, setElapsed] = useState(0)
  const [savedPath, setSavedPath] = useState(null)
  const [error, setError] = useState(null)

  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamsRef = useRef([])
  const audioCtxRef = useRef(null)

  const refreshSources = useCallback(async () => {
    const list = await window.recorder.getSources()
    setSources(list)
    setSelectedId((cur) => cur ?? list.find((s) => s.type === 'screen')?.id ?? list[0]?.id ?? null)
  }, [])

  useEffect(() => {
    let active = true
    window.recorder.getSources().then((list) => {
      if (!active) return
      setSources(list)
      setSelectedId(list.find((s) => s.type === 'screen')?.id ?? list[0]?.id ?? null)
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (status !== 'recording') return
    const t = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(t)
  }, [status])

  const cleanup = () => {
    streamsRef.current.forEach((s) => s.getTracks().forEach((t) => t.stop()))
    streamsRef.current = []
    audioCtxRef.current?.close()
    audioCtxRef.current = null
  }

  const start = async () => {
    setError(null)
    setSavedPath(null)
    try {
      await window.recorder.selectSource(selectedId)
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: systemAudio,
      })
      const mic = micOn ? await navigator.mediaDevices.getUserMedia({ audio: true }) : null
      streamsRef.current = [display, mic].filter(Boolean)

      // Mix system audio + microphone into a single track.
      const tracks = [...display.getVideoTracks()]
      const withAudio = streamsRef.current.filter((s) => s.getAudioTracks().length)
      if (withAudio.length) {
        const ctx = new AudioContext()
        const dest = ctx.createMediaStreamDestination()
        withAudio.forEach((s) => ctx.createMediaStreamSource(new MediaStream(s.getAudioTracks())).connect(dest))
        audioCtxRef.current = ctx
        tracks.push(...dest.stream.getAudioTracks())
      }

      const recorder = new MediaRecorder(new MediaStream(tracks), {
        mimeType: pickMimeType(),
        videoBitsPerSecond: 8_000_000,
      })
      chunksRef.current = []
      recorder.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data)
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' })
        cleanup()
        try {
          setSavedPath(await window.recorder.saveRecording(await blob.arrayBuffer()))
        } catch (e) {
          setError(e.message)
        }
        setStatus('idle')
      }
      display.getVideoTracks()[0].onended = () => recorder.state !== 'inactive' && recorder.stop()

      recorder.start(1000)
      recorderRef.current = recorder
      setElapsed(0)
      setStatus('recording')
    } catch (e) {
      cleanup()
      setError(e.message)
    }
  }

  const togglePause = () => {
    const r = recorderRef.current
    if (status === 'recording') { r.pause(); setStatus('paused') }
    else if (status === 'paused') { r.resume(); setStatus('recording') }
  }

  const stop = () => recorderRef.current?.stop()

  const idle = status === 'idle'

  return (
    <div className="app">
      <header>
        <h1>Screen Recorder</h1>
        <button className="ghost" onClick={refreshSources} disabled={!idle} title="Refresh sources">
          <RefreshCw size={16} /> Refresh
        </button>
      </header>

      <main className="grid">
        {sources.map((s) => (
          <button
            key={s.id}
            className={`source ${s.id === selectedId ? 'selected' : ''}`}
            onClick={() => setSelectedId(s.id)}
            disabled={!idle}
          >
            <img src={s.thumbnail} alt="" />
            <span>{s.type === 'screen' ? <Monitor size={14} /> : <AppWindow size={14} />} {s.name}</span>
          </button>
        ))}
      </main>

      <footer>
        <div className="toggles">
          <button className={`toggle ${systemAudio ? 'on' : ''}`} onClick={() => setSystemAudio((v) => !v)} disabled={!idle}>
            {systemAudio ? <Volume2 size={16} /> : <VolumeX size={16} />} System audio
          </button>
          <button className={`toggle ${micOn ? 'on' : ''}`} onClick={() => setMicOn((v) => !v)} disabled={!idle}>
            {micOn ? <Mic size={16} /> : <MicOff size={16} />} Microphone
          </button>
        </div>

        <div className="timer">
          {status !== 'idle' && <span className={`dot ${status}`} />}
          {fmt(elapsed)}
        </div>

        <div className="controls">
          {idle ? (
            <button className="record" onClick={start} disabled={!selectedId}>
              <Circle size={16} fill="currentColor" /> Record
            </button>
          ) : (
            <>
              <button className="ghost" onClick={togglePause}>
                {status === 'paused' ? <Play size={16} /> : <Pause size={16} />}
                {status === 'paused' ? 'Resume' : 'Pause'}
              </button>
              <button className="stop" onClick={stop}><Square size={16} fill="currentColor" /> Stop</button>
            </>
          )}
        </div>
      </footer>

      {(savedPath || error) && (
        <div className={`toast ${error ? 'error' : ''}`}>
          {error ? error : (
            <>
              Saved: {savedPath}
              <button className="ghost" onClick={() => window.recorder.showInFolder(savedPath)}>
                <FolderOpen size={14} /> Show
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
