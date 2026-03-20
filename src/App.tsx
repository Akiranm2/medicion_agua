import { useMemo, useState } from 'react'
import './App.css'

type TariffBlock = {
  upTo: number | null
  potable: number
  sewage: number
}

type TariffCategory = {
  key: string
  label: string
  blocks: TariffBlock[]
}

const SETTINGS = {
  igvPercent: 18,
  fixedCharge: 6.3,
  lateFee: 2.76,
  rounding: 0.06,
}

const CATEGORIES: TariffCategory[] = [
  {
    key: 'social',
    label: 'Social',
    blocks: [{ upTo: null, potable: 1.92, sewage: 0.9 }],
  },
  {
    key: 'domestico',
    label: 'Doméstico',
    blocks: [
      { upTo: 10, potable: 2.2, sewage: 1.38 },
      { upTo: 20, potable: 2.36, sewage: 1.48 },
      { upTo: 50, potable: 3.22, sewage: 1.98 },
      { upTo: null, potable: 7.32, sewage: 3.49 },
    ],
  },
  {
    key: 'domestico-sub',
    label: 'Doméstico subsidiado',
    blocks: [
      { upTo: 10, potable: 1.92, sewage: 0.9 },
      { upTo: 20, potable: 2.36, sewage: 1.48 },
      { upTo: 50, potable: 3.22, sewage: 1.98 },
      { upTo: null, potable: 7.32, sewage: 3.49 },
    ],
  },
  {
    key: 'comercial',
    label: 'Comercial y otros',
    blocks: [
      { upTo: 1000, potable: 8.82, sewage: 4.21 },
      { upTo: null, potable: 9.46, sewage: 4.51 },
    ],
  },
  {
    key: 'industrial',
    label: 'Industrial',
    blocks: [{ upTo: null, potable: 9.46, sewage: 4.51 }],
  },
  {
    key: 'estatal',
    label: 'Estatal',
    blocks: [{ upTo: null, potable: 5.8, sewage: 2.68 }],
  },
]

const currency = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const decimal = new Intl.NumberFormat('es-PE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 3,
})

function getUnlockedBlocks(consumption: number, blocks: TariffBlock[]) {
  if (consumption <= 0) return []

  const unlocked: TariffBlock[] = []
  let previousLimit = 0

  for (const block of blocks) {
    const currentLimit = block.upTo ?? Number.POSITIVE_INFINITY
    const blockVolume = Math.max(0, Math.min(consumption, currentLimit) - previousLimit)

    if (blockVolume > 0) unlocked.push(block)

    previousLimit = currentLimit
    if (consumption <= currentLimit) break
  }

  return unlocked
}

function getAverageRate(blocks: TariffBlock[]) {
  if (!blocks.length) return { potable: 0, sewage: 0 }

  const totals = blocks.reduce(
    (acc, block) => {
      acc.potable += block.potable
      acc.sewage += block.sewage
      return acc
    },
    { potable: 0, sewage: 0 },
  )

  return {
    potable: totals.potable / blocks.length,
    sewage: totals.sewage / blocks.length,
  }
}

function calculatePropertyVariableCharge(consumption: number, blocks: TariffBlock[]) {
  if (consumption <= 0) return 0

  const avg = getAverageRate(blocks)
  return consumption * (avg.potable + avg.sewage)
}

function calculatePersonalCharge(personalConsumption: number, unlockedBlocks: TariffBlock[]) {
  if (personalConsumption <= 0 || !unlockedBlocks.length) {
    return { potable: 0, sewage: 0, perBlockVolume: 0 }
  }

  const perBlockVolume = personalConsumption / unlockedBlocks.length

  const potable = unlockedBlocks.reduce(
    (sum, block) => sum + perBlockVolume * block.potable,
    0,
  )

  const sewage = unlockedBlocks.reduce(
    (sum, block) => sum + perBlockVolume * block.sewage,
    0,
  )

  return { potable, sewage, perBlockVolume }
}

function App() {
  const [categoryKey, setCategoryKey] = useState('domestico')
  const [inputTotal, setInputTotal] = useState('77')
  const [inputPersonal, setInputPersonal] = useState('13.1')
  const [appliedTotal, setAppliedTotal] = useState(77)
  const [appliedPersonal, setAppliedPersonal] = useState(13.1)
  const [error, setError] = useState('')

  const selectedCategory =
    CATEGORIES.find((category) => category.key === categoryKey) ?? CATEGORIES[1]

  const applyCalculation = () => {
    const total = Number(inputTotal)
    const personal = Number(inputPersonal)

    if (!Number.isFinite(total) || !Number.isFinite(personal)) {
      setError('Ingresa números válidos.')
      return
    }

    if (total <= 0) {
      setError('El consumo total del predio debe ser mayor a 0.')
      return
    }

    if (personal < 0) {
      setError('El consumo medido no puede ser negativo.')
      return
    }

    if (personal > total) {
      setError('El consumo medido no puede superar el total del predio.')
      return
    }

    setError('')
    setAppliedTotal(total)
    setAppliedPersonal(personal)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') applyCalculation()
  }

  const summary = useMemo(() => {
    const igv = SETTINGS.igvPercent / 100
    const unlockedBlocks = getUnlockedBlocks(appliedTotal, selectedCategory.blocks)

    const variableTotal = calculatePropertyVariableCharge(appliedTotal, selectedCategory.blocks)
    const personal = calculatePersonalCharge(appliedPersonal, unlockedBlocks)

    const personalSubtotal = personal.potable + personal.sewage
    const personalIgv = personalSubtotal * igv
    const personalFinal = personalSubtotal + personalIgv

    const totalBase = variableTotal + SETTINGS.fixedCharge
    const totalIgv = totalBase * igv
    const totalBill = totalBase + totalIgv + SETTINGS.lateFee + SETTINGS.rounding

    return {
      unlockedCount: unlockedBlocks.length,
      perBlockVolume: personal.perBlockVolume,
      variableTotal,
      totalIgv,
      totalBill,
      personalPotable: personal.potable,
      personalSewage: personal.sewage,
      personalSubtotal,
      personalIgv,
      personalFinal,
    }
  }, [appliedPersonal, appliedTotal, selectedCategory.blocks])

  return (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">Calculadora Sedapal</p>
        <h1>Calcula tu pago de agua en segundos</h1>
        <p className="subtitle">
          El consumo total del predio define cuántas escalas quedaron activadas. Luego tu consumo
          medido se divide entre esas escalas desbloqueadas. El I.G.V. se asume automáticamente en{' '}
          {SETTINGS.igvPercent}%.
        </p>
      </section>

      <section className="calculator-card">
        <div className="grid">
          <label className="field">
            <span>Estructura tarifaria</span>
            <select value={categoryKey} onChange={(e) => setCategoryKey(e.target.value)}>
              {CATEGORIES.map((category) => (
                <option key={category.key} value={category.key}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Consumo total del predio (m³)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={inputTotal}
              onChange={(e) => setInputTotal(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </label>

          <label className="field">
            <span>Consumo medido (m³)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={inputPersonal}
              onChange={(e) => setInputPersonal(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </label>
        </div>

        <button className="calculate-btn" onClick={applyCalculation}>
          Calcular
        </button>

        {error && <p className="validation">{error}</p>}
      </section>

      <section className="results-grid">
        <article className="result-card highlight">
          <p>Tu pago estimado</p>
          <h2>{currency.format(summary.personalFinal)}</h2>
          <small>
            {decimal.format(appliedPersonal)} m³ ÷ {summary.unlockedCount} escalas ={' '}
            {decimal.format(summary.perBlockVolume)} m³ por escala
          </small>
        </article>

        <article className="result-card">
          <p>Recibo total del predio</p>
          <h2>{currency.format(summary.totalBill)}</h2>
          <small>
            Variable {currency.format(summary.variableTotal)} + fijo{' '}
            {currency.format(SETTINGS.fixedCharge)} + I.G.V. {currency.format(summary.totalIgv)} +
            mora {currency.format(SETTINGS.lateFee)} + redondeo{' '}
            {currency.format(SETTINGS.rounding)}
          </small>
        </article>

        <article className="result-card">
          <p>Desglose personal</p>
          <h2>{currency.format(summary.personalSubtotal)}</h2>
          <small>
            Agua {currency.format(summary.personalPotable)} + saneamiento{' '}
            {currency.format(summary.personalSewage)} + I.G.V.{' '}
            {currency.format(summary.personalIgv)}
          </small>
        </article>
      </section>

      <section className="footnote">
        <p>
          Para mantenimiento futuro, modifica solo <strong>SETTINGS</strong> y{' '}
          <strong>CATEGORIES</strong>.
        </p>
      </section>

      <section className="explain-card">
        <h2>¿Cómo funciona? Explicado fácil</h2>
        <p>
          Si la casa consume bastante agua, se activan más escalas de cobro. Luego tu consumo se
          reparte entre esas escalas activadas.
        </p>
        <p>
          Por ejemplo, si el predio consumió <strong>77 m³</strong> y se activaron{' '}
          <strong>4 escalas</strong>, entonces un consumo personal de <strong>13.1 m³</strong> se
          divide así:
        </p>
        <p>
          <strong>13.1 ÷ 4 = 3.275 m³</strong> por escala.
        </p>
        <p>
          Después se suma agua, saneamiento y finalmente se agrega el <strong>I.G.V.</strong>.
        </p>
      </section>
    </main>
  )
}

export default App