import React, { useMemo, useState } from 'react'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend,
} from 'chart.js'
import { Bar, Pie } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend)
ChartJS.defaults.animation = false

const COLORS = ['#3b82f6', '#16a34a', '#f97316', '#a855f7', '#ef4444', '#14b8a6']
const VOWEL_SET = new Set(['a', 'ă', 'â', 'e', 'i', 'î', 'o', 'u'])
const RO_SET = new Set([
  'a', 'ă', 'â', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'î', 'j', 'k', 'l', 'm',
  'n', 'o', 'p', 'q', 'r', 's', 'ș', 't', 'ț', 'u', 'v', 'w', 'x', 'y', 'z',
])
const pct = (x, d = 3) => (x * 100).toFixed(d) + '%'
const smartPct = x => {
  const p = x * 100
  if (p === 0) return '0%'
  if (p >= 0.1) return p.toFixed(2) + '%'
  if (p >= 0.01) return p.toFixed(3) + '%'
  return p.toFixed(4) + '%'
}

function downloadCsv(a) {
  const rows = ['litera,N,f,p']
  a.letters.forEach(l => rows.push(`${l.letter},${l.absolute},${l.relative.toFixed(6)},${l.relative.toFixed(6)}`))
  const url = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }))
  const el = document.createElement('a')
  el.href = url
  el.download = `frecvente_${a.fileName}.csv`
  el.click()
  URL.revokeObjectURL(url)
}

function Analysis({ a, color }) {
  const [mode, setMode] = useState('bar')
  const [view, setView] = useState('table') // 'table' | 'grid'
  const [sortBy, setSortBy] = useState('freq') // 'freq' | 'alpha'
  const [hideZero, setHideZero] = useState(true)

  const baseLetters = useMemo(
    () => a.letters.filter(l => RO_SET.has(l.letter)),
    [a],
  )
  const sorted = useMemo(
    () => [...baseLetters].filter(l => l.absolute > 0).sort((x, y) => y.absolute - x.absolute),
    [baseLetters],
  )
  const maxRel = sorted.length ? sorted[0].relative : 1

  const displayedLetters = useMemo(() => {
    const list = hideZero ? baseLetters.filter(l => l.absolute > 0) : [...baseLetters]
    if (sortBy === 'freq') {
      list.sort((x, y) => y.absolute - x.absolute)
    }
    return list
  }, [baseLetters, hideZero, sortBy])

  const data = {
    labels: sorted.map(l => l.letter.toUpperCase()),
    datasets: [{
      label: 'f_X ≈ p_X (frecvență relativă ≈ probabilitate)',
      data: sorted.map(l => l.relative),
      backgroundColor: mode === 'pie'
        ? sorted.map((_, i) => `hsl(${(i * 360) / sorted.length} 65% 55%)`) : color,
    }],
  }
  const singleOptions = {
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: items => `Litera „${items[0].label}”`,
          label: ctx => {
            const l = sorted[ctx.dataIndex]
            return [`${a.fileName}`, `N = ${l.absolute.toLocaleString('ro-RO')}`, `f ≈ p = ${smartPct(l.relative)}`]
          },
        },
      },
    },
  }
  return (
    <div className="card">
      <div className="row"><h2 style={{ margin: 0, color }}>{a.fileName}</h2>
        <button onClick={() => setMode(mode === 'bar' ? 'pie' : 'bar')}>
          {mode === 'bar' ? 'Pie chart' : 'Bar chart'}</button>
        <button onClick={() => downloadCsv(a)}>Export CSV</button>
      </div>
      <div className="stats">
        <div className="stat">N<sub>total</sub> (total litere)<b>{a.totalLetters.toLocaleString('ro-RO')}</b></div>
        <div className="stat">Caractere distincte<b>{baseLetters.filter(l => l.absolute > 0).length} / 31</b></div>
        <div className="stat">Vocale<b>{pct(a.vowelRatio, 2)}</b>{a.vowels.toLocaleString('ro-RO')} litere</div>
        <div className="stat">Consoane<b>{pct(1 - a.vowelRatio, 2)}</b>{a.consonants.toLocaleString('ro-RO')} litere</div>
      </div>
      <div className="alphabet-panel" style={{ borderLeftColor: a.missingRomanianLetters.length ? '#f59e0b' : '#16a34a' }}>
        <div className="alphabet-panel-head">
          <div>
            <b>Inventarul caracterelor distincte (alfabetul de 31 de litere)</b>
            <div className="alphabet-sub">
              Prezente: <b>{baseLetters.filter(l => l.absolute > 0).length} / 31</b>
              {' • '}
              Lipsă (N<sub>X</sub> = 0): <b>{a.missingRomanianLetters.length}</b>
            </div>
          </div>
          <span className={`status-pill ${a.missingRomanianLetters.length ? 'warn' : 'ok'}`}>
            {a.missingRomanianLetters.length
              ? `${a.missingRomanianLetters.length} litere absente`
              : '✓ Toate cele 31 de litere sunt prezente'}
          </span>
        </div>

        <div className="alphabet-chips">
          {baseLetters.map(l => {
            const present = l.absolute > 0
            return (
              <span
                key={l.letter}
                className={`alpha-chip ${present ? 'present' : 'missing'}`}
                style={present ? { borderColor: color, color } : undefined}
                title={present ? `${l.letter.toUpperCase()}: ${l.absolute.toLocaleString('ro-RO')} apariții (${smartPct(l.relative)})` : `${l.letter.toUpperCase()}: 0 apariții (lipsă)`}
              >
                {l.letter.toUpperCase()}
              </span>
            )
          })}
        </div>

        {a.missingRomanianLetters.length > 0 && (
          <div className="missing-row">
            <span>Litere care <b>nu apar deloc</b> în text (N<sub>X</sub> = 0):</span>
            <div className="missing-badges">
              {a.missingRomanianLetters.map(l => (
                <span className="missing-badge" key={l}>{l.toUpperCase()}</span>
              ))}
            </div>
          </div>
        )}
      </div>
      {a.totalLetters < 50000 && (
        <p className="error">Atenție: textul are sub 50.000 de litere </p>
      )}
      <div style={{ maxHeight: 420 }}>
        {mode === 'bar' ? <Bar data={data} options={singleOptions} />
          : <div style={{ maxWidth: 420, margin: 'auto' }}><Pie data={data} /></div>}
      </div>

      <div className="toolbar">
        <div className="row">
          <b>Ordine:</b>
          <button className={sortBy === 'freq' ? 'active' : ''} onClick={() => setSortBy('freq')}>
            Descrescător după frecvență (Top)
          </button>
          <button className={sortBy === 'alpha' ? 'active' : ''} onClick={() => setSortBy('alpha')}>
            Alfabetic (A–Z)
          </button>
        </div>
        <div className="row">
          <b>Afișare:</b>
          <button className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}>
            Tabel cu bare
          </button>
          <button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')}>
            Grid compact (Carduri)
          </button>
          <label className="chk">
            <input type="checkbox" checked={hideZero} onChange={e => setHideZero(e.target.checked)} />
            Ascunde literele cu 0 apariții
          </label>
        </div>
      </div>

      {view === 'grid' ? (
        <div className="letter-grid">
          {displayedLetters.map((l, idx) => {
            const isVowel = VOWEL_SET.has(l.letter)
            const barWidth = maxRel > 0 ? (l.relative / maxRel) * 100 : 0
            return (
              <div className="letter-card" key={l.letter}>
                <div className="letter-card-head">
                  <span className="letter-rank">#{idx + 1}</span>
                  <span className="letter-char" style={{ color }}>{l.letter.toUpperCase()}</span>
                  <span className={`badge ${isVowel ? 'vowel' : 'cons'}`}>
                    {isVowel ? 'Vocală' : 'Cons.'}
                  </span>
                </div>
                <div className="letter-pct">{smartPct(l.relative)}</div>
                <div className="letter-meta">
                  <span>N<sub>{l.letter.toUpperCase()}</sub> = <b>{l.absolute.toLocaleString('ro-RO')}</b></span>
                  <span>f = {l.relative.toFixed(5)}</span>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${barWidth}%`, background: color }} />
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <table className="freq-table">
          <thead><tr>
            <th style={{ width: 48 }}>#</th>
            <th>Literă (X)</th>
            <th>Tip</th>
            <th>N<sub>X</sub> (apariții)</th>
            <th>f<sub>X</sub> = N<sub>X</sub> / N<sub>total</sub></th>
            <th>p<sub>X</sub> ≈ f<sub>X</sub> (%)</th>
            <th style={{ width: '32%', textAlign: 'left' }}>Distribuție vizuală</th>
          </tr></thead>
          <tbody>
            {displayedLetters.map((l, idx) => {
              const isVowel = VOWEL_SET.has(l.letter)
              const barWidth = maxRel > 0 ? (l.relative / maxRel) * 100 : 0
              return (
                <tr key={l.letter} className={l.absolute === 0 ? 'zero-row' : ''}>
                  <td>{idx + 1}</td>
                  <td><b style={{ color, fontSize: '1.05rem' }}>{l.letter.toUpperCase()}</b> ({l.letter})</td>
                  <td>
                    <span className={`badge ${isVowel ? 'vowel' : 'cons'}`}>
                      {isVowel ? 'Vocală' : 'Consoană'}
                    </span>
                  </td>
                  <td><b>{l.absolute.toLocaleString('ro-RO')}</b></td>
                  <td>{l.relative.toFixed(6)}</td>
                  <td><b>{smartPct(l.relative)}</b></td>
                  <td style={{ textAlign: 'left' }}>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${barWidth}%`, background: color }} />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}


function Notations() {
  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Notații</h2>
      <ul className="notations">
        <li><b>N<sub>X</sub></b>: frecvența absolută, numărul de apariții ale literei X în text
          (ex.: N<sub>A</sub> = 4150). <b>N<sub>total</sub></b>: numărul total de litere din text.</li>
        <li><b>f<sub>X</sub> = N<sub>X</sub> / N<sub>total</sub></b>: frecvența relativă de utilizare
          (ex.: 4150 / 50000 = 0,083).</li>
        <li><b>p<sub>X</sub></b>: probabilitatea de apariție a literei X. Conform legii numerelor mari,
          pentru un text suficient de mare (N<sub>total</sub> → ∞), <b>p<sub>X</sub> ≈ f<sub>X</sub></b>.</li>
      </ul>
    </div>
  )
}

function extremes(a) {
  const present = a.letters.filter(l => RO_SET.has(l.letter) && l.absolute > 0)
  if (!present.length) return { top: null, rare: null }
  const top = present.reduce((m, l) => (l.absolute > m.absolute ? l : m))
  const rare = present.reduce((m, l) => (l.absolute < m.absolute ? l : m))
  return { top, rare }
}

/** Rând de comparație: o valoare pentru fiecare text, colorată cu culoarea textului din grafic. */
function Duo({ label, a, b, colorA, colorB }) {
  return (
    <div className="stat">
      {label}
      <div className="duo">
        <b style={{ color: colorA }}>{a}</b>
        <b style={{ color: colorB }}>{b}</b>
      </div>
    </div>
  )
}

function Comparison({ c, colorA, colorB }) {
  const roDiffs = c.diffs.filter(d => RO_SET.has(d.letter))
  const data = {
    labels: roDiffs.map(d => d.letter.toUpperCase()),
    datasets: [
      { label: c.a.fileName, data: roDiffs.map(d => d.relativeA), backgroundColor: colorA },
      { label: c.b.fileName, data: roDiffs.map(d => d.relativeB), backgroundColor: colorB },
    ],
  }
  const diffData = {
    labels: roDiffs.map(d => d.letter.toUpperCase()),
    datasets: [{
      label: `Diferență (puncte procentuale): ${c.b.fileName} − ${c.a.fileName}`,
      data: roDiffs.map(d => d.diffPercentPoints),
      backgroundColor: roDiffs.map(d => (d.diffPercentPoints >= 0 ? colorB : colorA)),
    }],
  }
  const byLetter = (x, letter) => x.letters.find(l => l.letter === letter.toLowerCase())
  const groupedOptions = {
    plugins: {
      tooltip: {
        callbacks: {
          title: items => `Litera „${items[0].label}”`,
          label: ctx => {
            const src = ctx.datasetIndex === 0 ? c.a : c.b
            const l = byLetter(src, ctx.label)
            return `${src.fileName}: f ≈ p = ${smartPct(ctx.parsed.y)}${l ? ` (N = ${l.absolute.toLocaleString('ro-RO')})` : ''}`
          },
        },
      },
    },
  }
  const diffOptions = {
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: items => `Litera „${items[0].label}”`,
          label: ctx => {
            const d = roDiffs[ctx.dataIndex]
            return [
              `${c.a.fileName}: ${smartPct(d.relativeA)}`,
              `${c.b.fileName}: ${smartPct(d.relativeB)}`,
              `Diferență: ${d.diffPercentPoints > 0 ? '+' : ''}${d.diffPercentPoints.toFixed(3)} pp`,
            ]
          },
        },
      },
    },
  }
  const ea = extremes(c.a), eb = extremes(c.b)
  const fmt = l => (l ? `${l.letter.toUpperCase()} — ${l.absolute.toLocaleString('ro-RO')} (${smartPct(l.relative)})` : '—')
  const roOnlyA = c.onlyInA.filter(l => RO_SET.has(l))
  const roOnlyB = c.onlyInB.filter(l => RO_SET.has(l))

  const maxPos = roDiffs.reduce((m, d) => (d.diffPercentPoints > (m?.diffPercentPoints ?? 0) ? d : m), null)
  const maxNeg = roDiffs.reduce((m, d) => (d.diffPercentPoints < (m?.diffPercentPoints ?? 0) ? d : m), null)
  const activeDiffs = roDiffs.filter(d => d.relativeA > 0 || d.relativeB > 0)
  const closest = activeDiffs.length
    ? activeDiffs.reduce((m, d) => (Math.abs(d.diffPercentPoints) < Math.abs(m.diffPercentPoints) ? d : m))
    : null
  return (
    <div className="card">
      <h2>Comparație</h2>
      <div className="legend">
        <span style={{ color: colorA }}>■ {c.a.fileName}</span>
        <span style={{ color: colorB }}>■ {c.b.fileName}</span>
      </div>
      <div className="stats stats-6">
        <Duo label="Vocale (%)" a={pct(c.a.vowelRatio, 2)} b={pct(c.b.vowelRatio, 2)} colorA={colorA} colorB={colorB} />
        <Duo label="Consoane (%)" a={pct(1 - c.a.vowelRatio, 2)} b={pct(1 - c.b.vowelRatio, 2)} colorA={colorA} colorB={colorB} />
        <Duo label="Nr. vocale" a={c.a.vowels.toLocaleString('ro-RO')} b={c.b.vowels.toLocaleString('ro-RO')} colorA={colorA} colorB={colorB} />
        <Duo label="Nr. consoane" a={c.a.consonants.toLocaleString('ro-RO')} b={c.b.consonants.toLocaleString('ro-RO')} colorA={colorA} colorB={colorB} />
        <Duo label="Cea mai frecventă literă" a={fmt(ea.top)} b={fmt(eb.top)} colorA={colorA} colorB={colorB} />
        <Duo label="Cea mai rară literă" a={fmt(ea.rare)} b={fmt(eb.rare)} colorA={colorA} colorB={colorB} />
      </div>
      <div className="exclusive-grid">
        <div className="diff-guide-card" style={{ borderLeftColor: colorA }}>
          <div className="diff-guide-title">
            <span className="diff-pill" style={{ background: colorA }}>Exclusiv în primul text</span>
            <b style={{ color: colorA }}>{c.a.fileName}</b>
          </div>
          <p>Litere care apar în <b>{c.a.fileName}</b>, dar lipsesc complet (0 apariții) din <b>{c.b.fileName}</b>:</p>
          <div className="missing-badges">
            {roOnlyA.length
              ? roOnlyA.map(l => <span className="exclusive-badge" style={{ borderColor: colorA, color: colorA }} key={l}>{l.toUpperCase()}</span>)
              : <span className="none-badge">Niciuna — toate literele apar și în al doilea text</span>}
          </div>
        </div>

        <div className="diff-guide-card" style={{ borderLeftColor: colorB }}>
          <div className="diff-guide-title">
            <span className="diff-pill" style={{ background: colorB }}>Exclusiv în al doilea text</span>
            <b style={{ color: colorB }}>{c.b.fileName}</b>
          </div>
          <p>Litere care apar în <b>{c.b.fileName}</b>, dar lipsesc complet (0 apariții) din <b>{c.a.fileName}</b>:</p>
          <div className="missing-badges">
            {roOnlyB.length
              ? roOnlyB.map(l => <span className="exclusive-badge" style={{ borderColor: colorB, color: colorB }} key={l}>{l.toUpperCase()}</span>)
              : <span className="none-badge">Niciuna — toate literele apar și în primul text</span>}
          </div>
        </div>
      </div>
      <Bar data={data} options={groupedOptions} />

      <div className="diff-section">
        <div className="diff-header">
          <h3 style={{ margin: 0 }}>Diferența dintre frecvențe, pe fiecare literă</h3>
          <div className="diff-formula">
            <span>Formula:</span>
            <code>
              Δ<sub>X</sub> = f<sub>X</sub>(<b style={{ color: colorB }}>{c.b.fileName}</b>) − f<sub>X</sub>(<b style={{ color: colorA }}>{c.a.fileName}</b>)
            </code>
            <span className="diff-unit">în puncte procentuale (pp)</span>
          </div>
        </div>

        <div className="diff-guide">
          <div className="diff-guide-card" style={{ borderLeftColor: colorB }}>
            <div className="diff-guide-title">
              <span className="diff-pill" style={{ background: colorB }}>▲ Bară în SUS (+)</span>
              <span>Mai frecventă în <b style={{ color: colorB }}>{c.b.fileName}</b></span>
            </div>
            <p>
              Valoarea este <b>pozitivă</b>: litera apare mai des în al doilea text decât în primul.
            </p>
            {maxPos && (
              <div className="diff-example">
                Cel mai mare plus: litera <b style={{ color: colorB }}>{maxPos.letter.toUpperCase()}</b>{' '}
                (<b>+{maxPos.diffPercentPoints.toFixed(2)} pp</b>: {smartPct(maxPos.relativeB)} vs. {smartPct(maxPos.relativeA)})
              </div>
            )}
          </div>

          <div className="diff-guide-card" style={{ borderLeftColor: colorA }}>
            <div className="diff-guide-title">
              <span className="diff-pill" style={{ background: colorA }}>▼ Bară în JOS (−)</span>
              <span>Mai frecventă în <b style={{ color: colorA }}>{c.a.fileName}</b></span>
            </div>
            <p>
              Valoarea este <b>negativă</b>: litera apare mai des în primul text decât în al doilea.
            </p>
            {maxNeg && (
              <div className="diff-example">
                Cel mai mare minus: litera <b style={{ color: colorA }}>{maxNeg.letter.toUpperCase()}</b>{' '}
                (<b>{maxNeg.diffPercentPoints.toFixed(2)} pp</b>: {smartPct(maxNeg.relativeB)} vs. {smartPct(maxNeg.relativeA)})
              </div>
            )}
          </div>

          <div className="diff-guide-card" style={{ borderLeftColor: '#64748b' }}>
            <div className="diff-guide-title">
              <span className="diff-pill" style={{ background: '#64748b' }}>↕ Înălțimea barei</span>
              <span>Cât de mult diferă textele</span>
            </div>
            <p>
              <b>Bară înaltă</b> = diferență mare de distribuție la acea literă.<br />
              <b>Bară aproape de 0</b> = litera are frecvență aproape identică în ambele texte.
            </p>
            {closest && (
              <div className="diff-example">
                Cea mai apropiată: litera <b>{closest.letter.toUpperCase()}</b>{' '}
                (diferență de doar <b>{Math.abs(closest.diffPercentPoints).toFixed(3)} pp</b>)
              </div>
            )}
          </div>
        </div>

        <Bar data={diffData} options={diffOptions} />
      </div>
    </div>
  )
}

export default function App() {
  const [analyses, setAnalyses] = useState([])
  const [loading, setLoading] = useState(false)
  const [tasks, setTasks] = useState([])
  const [globalStatus, setGlobalStatus] = useState('')
  const [error, setError] = useState('')
  const [idxA, setIdxA] = useState(0)
  const [idxB, setIdxB] = useState(1)
  const [comparison, setComparison] = useState(null)
  const [cmpIdx, setCmpIdx] = useState({ a: 0, b: 1 })

  function updateTask(id, patch) {
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, ...patch } : t)))
  }

  /** Trimite un FormData cu XMLHttpRequest ca să putem urmări progresul real la upload. */
  function postFormWithProgress(url, fd, onUploadPct) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', url)
      xhr.upload.onprogress = e => {
        if (e.lengthComputable && onUploadPct) {
          onUploadPct(Math.round((e.loaded / e.total) * 100))
        }
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(xhr.responseText ? JSON.parse(xhr.responseText) : null)
        } else {
          let msg = `Eroare ${xhr.status}`
          try { msg = JSON.parse(xhr.responseText).message || msg } catch {}
          reject(new Error(msg))
        }
      }
      xhr.onerror = () => reject(new Error('Eroare de rețea la încărcarea fișierului.'))
      xhr.send(fd)
    })
  }

  function startProcessingTicker(taskId, fileName, startPct) {
    let pct = Math.max(startPct, 58)
    const getStage = p => {
      if (p < 78) return `Se extrage textul din paginile documentului „${fileName}” (Apache Tika)...`
      if (p < 90) return `Se normalizează diacriticele și se contorizează aparițiile N_X în „${fileName}”...`
      return `Se finalizează calculul frecvențelor f_X = N_X / N_total pentru „${fileName}”...`
    }
    updateTask(taskId, { percent: pct, stage: getStage(pct) })
    const timer = setInterval(() => {
      pct = pct < 85 ? pct + 3 : pct < 96 ? pct + 1 : 96
      updateTask(taskId, { percent: pct, stage: getStage(pct) })
    }, 600)
    return () => clearInterval(timer)
  }

  async function analyzeFile(f, taskId) {
    const CHUNK_SIZE = 3 * 1024 * 1024 // 3 MB per cerere (evită 413 Payload Too Large în Codespaces)
    if (f.size <= CHUNK_SIZE) {
      const fd = new FormData()
      fd.append('file', f)
      let stopTicker = null
      try {
        const res = await postFormWithProgress('/api/analyze', fd, upPct => {
          if (upPct < 100) {
            const scaled = Math.max(5, Math.round(upPct * 0.55))
            updateTask(taskId, {
              percent: scaled,
              stage: `Se încarcă fișierul „${f.name}” (${upPct}%)...`,
            })
          } else if (!stopTicker) {
            stopTicker = startProcessingTicker(taskId, f.name, 60)
          }
        })
        if (stopTicker) stopTicker()
        updateTask(taskId, {
          percent: 100,
          done: true,
          stage: `✓ Analiză finalizată: ${res.totalLetters.toLocaleString('ro-RO')} litere contorizate`,
        })
        return res
      } finally {
        if (stopTicker) stopTicker()
      }
    }

    const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const total = Math.ceil(f.size / CHUNK_SIZE)
    let completedChunks = 0
    updateTask(taskId, {
      percent: 5,
      stage: `Se încarcă „${f.name}” în paralel (0 / ${total} fragmente)...`,
    })

    const firstChunks = []
    for (let i = 0; i < total - 1; i++) {
      const slice = f.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
      const fd = new FormData()
      fd.append('uploadId', uploadId)
      fd.append('fileName', f.name)
      fd.append('index', String(i))
      fd.append('total', String(total))
      fd.append('chunk', slice, f.name)
      firstChunks.push(
        postFormWithProgress('/api/analyze/chunk', fd).then(() => {
          completedChunks++
          const pct = Math.round((completedChunks / total) * 58)
          updateTask(taskId, {
            percent: Math.max(8, pct),
            stage: `Se încarcă „${f.name}” (${completedChunks} / ${total} fragmente transferate)...`,
          })
        }),
      )
    }
    await Promise.all(firstChunks)

    const lastSlice = f.slice((total - 1) * CHUNK_SIZE, total * CHUNK_SIZE)
    const lastFd = new FormData()
    lastFd.append('uploadId', uploadId)
    lastFd.append('fileName', f.name)
    lastFd.append('index', String(total - 1))
    lastFd.append('total', String(total))
    lastFd.append('chunk', lastSlice, f.name)

    let stopTicker = null
    try {
      const res = await postFormWithProgress('/api/analyze/chunk', lastFd, upPct => {
        if (upPct >= 100 && !stopTicker) {
          stopTicker = startProcessingTicker(taskId, f.name, 65)
        }
      })
      if (stopTicker) stopTicker()
      updateTask(taskId, {
        percent: 100,
        done: true,
        stage: `✓ Analiză finalizată: ${res.totalLetters.toLocaleString('ro-RO')} litere contorizate`,
      })
      return res
    } finally {
      if (stopTicker) stopTicker()
    }
  }

  async function upload(e) {
    const files = [...e.target.files]
    e.target.value = ''
    if (!files.length) return
    setError('')
    const baseIdx = analyses.length
    const initialTasks = files.map((f, i) => ({
      id: i,
      fileName: f.name,
      sizeMb: (f.size / (1024 * 1024)).toFixed(2),
      color: COLORS[(baseIdx + i) % COLORS.length],
      percent: 2,
      done: false,
      stage: `Se pregătește fișierul „${f.name}”...`,
    }))
    setTasks(initialTasks)
    setGlobalStatus(
      files.length > 1
        ? `Se procesează ${files.length} fișiere în paralel...`
        : `Se analizează fișierul „${files[0].name}”...`,
    )
    setLoading(true)
    try {
      const added = await Promise.all(files.map((f, i) => analyzeFile(f, i)))
      const nextAnalyses = [...analyses, ...added]
      let nextComparison = comparison
      let nextA = idxA, nextB = idxB, nextCmpIdx = cmpIdx
      if (nextAnalyses.length >= 2) {
        nextA = nextAnalyses.length - 2
        nextB = nextAnalyses.length - 1
        setGlobalStatus(
          `Se procesează comparația statistică între „${nextAnalyses[nextA].fileName}” și „${nextAnalyses[nextB].fileName}”...`,
        )
        const cr = await fetch('/api/compare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ a: nextAnalyses[nextA], b: nextAnalyses[nextB] }),
        })
        if (cr.ok) {
          nextComparison = await cr.json()
          nextCmpIdx = { a: nextA, b: nextB }
        }
      }
      setAnalyses(nextAnalyses)
      setIdxA(nextA)
      setIdxB(nextB)
      setComparison(nextComparison)
      setCmpIdx(nextCmpIdx)
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  async function compare() {
    setError('')
    const a = analyses[idxA], b = analyses[idxB]
    if (!a || !b || idxA === idxB) { setError('Alege două fișiere diferite.'); return }
    setTasks([
      {
        id: 0,
        fileName: `${a.fileName} vs. ${b.fileName}`,
        sizeMb: null,
        color: COLORS[idxB % COLORS.length],
        percent: 70,
        done: false,
        stage: `Se calculează diferențele Δ_X (pp) și statisticile comparative...`,
      },
    ])
    setGlobalStatus(`Se compară „${a.fileName}” cu „${b.fileName}”...`)
    setLoading(true)
    try {
      const r = await fetch('/api/compare', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ a, b }),
      })
      if (!r.ok) { setError(`Eroare ${r.status}`); return }
      setComparison(await r.json())
      setCmpIdx({ a: idxA, b: idxB })
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  const overallPct = tasks.length
    ? Math.round(tasks.reduce((s, t) => s + t.percent, 0) / tasks.length)
    : 0

  return (
    <main>
      <h1>Statistica literelor</h1>
      <Notations />
      <div className="card drop">
        <p>Încarcă unul sau mai multe fișiere (.txt, .pdf, .doc, .docx, ...)</p>
        <input type="file" multiple onChange={upload} disabled={loading}
          accept=".txt,.pdf,.doc,.docx,.rtf,.odt,.html" />
        {error && <p className="error">{error}</p>}
      </div>

      {loading ? (
        <div className="card progress-panel">
          <div className="progress-global-head">
            <div className="row">
              <div className="spinner-sm" />
              <b>{globalStatus || 'Se procesează...'}</b>
            </div>
            <span className="progress-pct-badge">{overallPct}%</span>
          </div>
          <div className="progress-track-lg">
            <div className="progress-fill-lg" style={{ width: `${overallPct}%` }} />
          </div>

          <div className="progress-tasks">
            {tasks.map(t => (
              <div className="progress-task" key={t.id} style={{ borderLeftColor: t.color }}>
                <div className="progress-task-top">
                  <span>
                    <b style={{ color: t.color }}>{t.fileName}</b>
                    {t.sizeMb && <span className="progress-size"> ({t.sizeMb} MB)</span>}
                  </span>
                  <b style={{ color: t.color }}>{t.percent}%</b>
                </div>
                <div className="progress-track">
                  <div
                    className={`progress-fill ${t.done ? '' : 'animated'}`}
                    style={{ width: `${t.percent}%`, background: t.color }}
                  />
                </div>
                <div className="progress-stage">{t.stage}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {analyses.length >= 2 && (
            <div className="card row">
              Compară:
              <select value={idxA} onChange={e => setIdxA(+e.target.value)}>
                {analyses.map((a, i) => <option key={i} value={i}>{a.fileName}</option>)}
              </select>
              cu
              <select value={idxB} onChange={e => setIdxB(+e.target.value)}>
                {analyses.map((a, i) => <option key={i} value={i}>{a.fileName}</option>)}
              </select>
              <button onClick={compare}>Compară</button>
              <button onClick={() => { setAnalyses([]); setComparison(null) }}>Șterge tot</button>
            </div>
          )}

          {comparison && <Comparison c={comparison}
            colorA={COLORS[cmpIdx.a % COLORS.length]} colorB={COLORS[cmpIdx.b % COLORS.length]} />}
          {analyses.map((a, i) => <Analysis key={i} a={a} color={COLORS[i % COLORS.length]} />)}
        </>
      )}
    </main>
  )
}
