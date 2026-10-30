import React, { useMemo, useState } from 'react'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend,
} from 'chart.js'
import { Bar, Pie } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend)
ChartJS.defaults.animation = false

const COLORS = ['#3b82f6', '#16a34a', '#f97316', '#a855f7', '#ef4444', '#14b8a6']
const pct = (x, d = 3) => (x * 100).toFixed(d) + '%'

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
  const sorted = useMemo(() => [...a.letters].filter(l => l.absolute > 0)
    .sort((x, y) => y.absolute - x.absolute), [a])
  const data = {
    labels: sorted.map(l => l.letter),
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
            return [`${a.fileName}`, `N = ${l.absolute.toLocaleString('ro-RO')}`, `f ≈ p = ${pct(l.relative, 3)}`]
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
        <div className="stat">Caractere distincte<b>{a.distinctLetters}</b></div>
        <div className="stat">Vocale<b>{pct(a.vowelRatio, 2)}</b>{a.vowels.toLocaleString('ro-RO')} litere</div>
        <div className="stat">Consoane<b>{pct(1 - a.vowelRatio, 2)}</b>{a.consonants.toLocaleString('ro-RO')} litere</div>
      </div>
      <p>
        Litere din alfabetul românesc (31) lipsă:{' '}
        {a.missingRomanianLetters.length
          ? a.missingRomanianLetters.map(l => <span className="tag" key={l}>{l}</span>)
          : 'niciuna, toate cele 31 apar'}
        <br />
        Litere în plus (non-alfabet românesc):{' '}
        {a.extraLetters.length ? a.extraLetters.map(l => <span className="tag" key={l}>{l}</span>) : 'niciuna'}
      </p>
      {a.totalLetters < 50000 && (
        <p className="error">Atenție: textul are sub 50.000 de litere </p>
      )}
      <div style={{ maxHeight: 420 }}>
        {mode === 'bar' ? <Bar data={data} options={singleOptions} />
          : <div style={{ maxWidth: 420, margin: 'auto' }}><Pie data={data} /></div>}
      </div>
      <div className="tablewrap">
        <table>
          <thead><tr>
            <th>Literă (X)</th>
            <th>N<sub>X</sub></th>
            <th>f<sub>X</sub> = N<sub>X</sub> / N<sub>total</sub></th>
            <th>p<sub>X</sub> ≈ f<sub>X</sub></th>
          </tr></thead>
          <tbody>
            {a.letters.map(l => (
              <tr key={l.letter}>
                <td>{l.letter}</td><td>{l.absolute}</td>
                <td>{l.relative.toFixed(6)}</td><td>{pct(l.relative, 4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
  const present = a.letters.filter(l => l.absolute > 0)
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
  const data = {
    labels: c.diffs.map(d => d.letter),
    datasets: [
      { label: c.a.fileName, data: c.diffs.map(d => d.relativeA), backgroundColor: colorA },
      { label: c.b.fileName, data: c.diffs.map(d => d.relativeB), backgroundColor: colorB },
    ],
  }
  const diffData = {
    labels: c.diffs.map(d => d.letter),
    datasets: [{
      label: `Diferență (puncte procentuale): ${c.b.fileName} − ${c.a.fileName}`,
      data: c.diffs.map(d => d.diffPercentPoints),
      backgroundColor: c.diffs.map(d => (d.diffPercentPoints >= 0 ? colorB : colorA)),
    }],
  }
  const byLetter = (x, letter) => x.letters.find(l => l.letter === letter)
  const groupedOptions = {
    plugins: {
      tooltip: {
        callbacks: {
          title: items => `Litera „${items[0].label}”`,
          label: ctx => {
            const src = ctx.datasetIndex === 0 ? c.a : c.b
            const l = byLetter(src, ctx.label)
            return `${src.fileName}: f ≈ p = ${pct(ctx.parsed.y, 3)}${l ? ` (N = ${l.absolute.toLocaleString('ro-RO')})` : ''}`
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
            const d = c.diffs[ctx.dataIndex]
            return [
              `${c.a.fileName}: ${pct(d.relativeA, 3)}`,
              `${c.b.fileName}: ${pct(d.relativeB, 3)}`,
              `Diferență: ${d.diffPercentPoints > 0 ? '+' : ''}${d.diffPercentPoints.toFixed(3)} pp`,
            ]
          },
        },
      },
    },
  }
  const ea = extremes(c.a), eb = extremes(c.b)
  const fmt = l => (l ? `${l.letter.toUpperCase()} (${pct(l.relative, 2)})` : '—')
  return (
    <div className="card">
      <h2>Comparație</h2>
      <div className="legend">
        <span style={{ color: colorA }}>■ {c.a.fileName}</span>
        <span style={{ color: colorB }}>■ {c.b.fileName}</span>
      </div>
      <div className="stats">
        <Duo label="Vocale (%)" a={pct(c.a.vowelRatio, 2)} b={pct(c.b.vowelRatio, 2)} colorA={colorA} colorB={colorB} />
        <Duo label="Consoane (%)" a={pct(1 - c.a.vowelRatio, 2)} b={pct(1 - c.b.vowelRatio, 2)} colorA={colorA} colorB={colorB} />
        <Duo label="Nr. vocale" a={c.a.vowels.toLocaleString('ro-RO')} b={c.b.vowels.toLocaleString('ro-RO')} colorA={colorA} colorB={colorB} />
        <Duo label="Nr. consoane" a={c.a.consonants.toLocaleString('ro-RO')} b={c.b.consonants.toLocaleString('ro-RO')} colorA={colorA} colorB={colorB} />
        <Duo label="Cea mai frecventă literă" a={fmt(ea.top)} b={fmt(eb.top)} colorA={colorA} colorB={colorB} />
        <Duo label="Cea mai rară literă" a={fmt(ea.rare)} b={fmt(eb.rare)} colorA={colorA} colorB={colorB} />
      </div>
      <p>
        Doar în <span style={{ color: colorA }}>{c.a.fileName}</span>:{' '}
        {c.onlyInA.length ? c.onlyInA.map(l => <span className="tag" key={l}>{l}</span>) : '—'}
        <br />
        Doar în <span style={{ color: colorB }}>{c.b.fileName}</span>:{' '}
        {c.onlyInB.length ? c.onlyInB.map(l => <span className="tag" key={l}>{l}</span>) : '—'}
      </p>
      <Bar data={data} options={groupedOptions} />
      <h3>Diferența dintre frecvențe, pe literă</h3>
      <p style={{ marginTop: 0 }}>
        Pentru fiecare literă: f<sub>X</sub> din <span style={{ color: colorB }}>{c.b.fileName}</span> minus
        f<sub>X</sub> din <span style={{ color: colorA }}>{c.a.fileName}</span>, în puncte procentuale (pp).
        Bara în sus (culoarea <span style={{ color: colorB }}>celui de-al doilea text</span>) înseamnă că litera
        e mai frecventă în al doilea text; bara în jos (culoarea <span style={{ color: colorA }}>primului</span>),
        că e mai frecventă în primul. Cu cât bara e mai înaltă, cu atât distribuțiile diferă mai mult la acea literă.
      </p>
      <Bar data={diffData} options={diffOptions} />
    </div>
  )
}

export default function App() {
  const [analyses, setAnalyses] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [idxA, setIdxA] = useState(0)
  const [idxB, setIdxB] = useState(1)
  const [comparison, setComparison] = useState(null)
  const [cmpIdx, setCmpIdx] = useState({ a: 0, b: 1 })

  async function upload(e) {
    const files = [...e.target.files]
    e.target.value = ''
    if (!files.length) return
    setError(''); setLoading(true)
    try {
      const added = []
      for (const f of files) {
        const fd = new FormData()
        fd.append('file', f)
        const r = await fetch('/api/analyze', { method: 'POST', body: fd })
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || `Eroare ${r.status}`)
        added.push(await r.json())
      }
      const nextAnalyses = [...analyses, ...added]
      let nextComparison = comparison
      let nextA = idxA, nextB = idxB, nextCmpIdx = cmpIdx
      if (nextAnalyses.length >= 2) {
        nextA = nextAnalyses.length - 2
        nextB = nextAnalyses.length - 1
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

  return (
    <main>
      <h1>Statistica literelor în limba română</h1>
      <Notations />
      <div className="card drop">
        <p>Încarcă unul sau mai multe fișiere (.txt, .pdf, .doc, .docx, ...)</p>
        <input type="file" multiple onChange={upload} disabled={loading}
          accept=".txt,.pdf,.doc,.docx,.rtf,.odt,.html" />
        {error && <p className="error">{error}</p>}
      </div>

      {loading ? (
        <div className="card loading-card">
          <div className="spinner" />
          <p>Se procesează fișierele și se calculează toate statisticile...</p>
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
