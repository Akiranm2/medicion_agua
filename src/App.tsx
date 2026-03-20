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

  // Tarifas efectivas para el RECIBO TOTAL DEL PREDIO
  // Ajusta estos valores si Sedapal cambia el esquema.
  effectiveRates: {
    social: { potable: 1.92, sewage: 0.9 },
    domestico: { potable: 2.4873, sewage: 1.5515 }, // mantiene ~S/ 377.22 con 77 m³
    'domestico-sub': { potable: 2.20, sewage: 1.38 },
    comercial: { potable: 8.82, sewage: 4.21 },
    industrial: { potable: 9.46, sewage: 4.51 },
    estatal: { potable: 5.8, sewage: 2.68 },
  },
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
    const volume = Math.max(0, Math.min(consumption, currentLimit) - previousLimit)

    if (volume > 0) unlocked.push(block)

    previousLimit = currentLimit
    if (consumption <= currentLimit) break
  }

  return unlocked
}

function calculatePersonalCharge(personalConsumption: number, unlockedBlocks: TariffBlock[]) {
  if (personalConsumption <= 0 || unlockedBlocks.length === 0) {
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

function calculatePropertyVariableCharge(
  totalConsumption: number,
  categoryKey: keyof typeof SETTINGS.effectiveRates,
) {
  if (totalConsumption <= 0) return 0

  const rate = SETTINGS.effectiveRates[categoryKey]
  return totalConsumption * (rate.potable + rate.sewage)
}

function App() {
  const [categoryKey, setCategoryKey] = useState('domestico')
  const [inputTotal, setInputTotal] = useState('77')
  const [inputPersonal, setInputPersonal] = useState('13')
  const [appliedTotal, setAppliedTotal] = useState(77)
  const [appliedPersonal, setAppliedPersonal] = useState(13)
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
    if (event.key === 'Enter') {
      applyCalculation()
    }
  }

  const summary = useMemo(() => {
    const igv = SETTINGS.igvPercent / 100
    const unlockedBlocks = getUnlockedBlocks(appliedTotal, selectedCategory.blocks)

    const variableTotal = calculatePropertyVariableCharge(
      appliedTotal,
      selectedCategory.key as keyof typeof SETTINGS.effectiveRates,
    )

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
  }, [appliedPersonal, appliedTotal, selectedCategory])

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
          En esta casa se consumieron <strong>{decimal.format(appliedTotal)} m³</strong> en total.
          Eso activa <strong>{summary.unlockedCount} escalas</strong> de cobro.
        </p>

        <p>
          Tu consumo fue de <strong>{decimal.format(appliedPersonal)} m³</strong>, así que se divide
          entre esas escalas:
        </p>

        <p>
          <strong>
            {decimal.format(appliedPersonal)} ÷ {summary.unlockedCount} ={' '}
            {decimal.format(summary.perBlockVolume)} m³ por escala
          </strong>
        </p>

        <hr />

        <h3> Explicación </h3>

        <p>
          Imagina que hay <strong>{summary.unlockedCount} salidas de agua</strong>, como si fueran{' '}
          <strong>cañitos</strong>.
        </p>

        <p>
          La casa usó tanta agua que tuvo que abrir todos esos cañitos al mismo tiempo.
        </p>

        <ul>
          {Array.from({ length: summary.unlockedCount }).map((_, i) => (
            <li key={i}>🚰 Cañito {i + 1} abierto</li>
          ))}
        </ul>

        <p>
          Ahora imagina que tú eres un niñito con un baldecito y llevas{' '}
          <strong>{decimal.format(appliedPersonal)} m³</strong> de agua.
        </p>

        <p>
          Como no se sabe exactamente en cuál cañito cayó más tu agua, el sistema hace algo
          sencillo: reparte tu agua en partes iguales entre todos los cañitos abiertos.
        </p>

        <p>
          Entonces cada cañito recibe{' '}
          <strong>{decimal.format(summary.perBlockVolume)} m³</strong>.
        </p>

        <p>⚠️ Pero aquí viene la parte importante:</p>

        <p>
          Aunque cada cañito recibe la misma cantidad de agua, <strong>no todos cobran igual</strong>.
          Unos son más baratos y otros más caros.
        </p>

        <ul>
          {selectedCategory.blocks.slice(0, summary.unlockedCount).map((block, i) => (
            <li key={i}>
              💧 Cañito {i + 1}: S/ {(block.potable + block.sewage).toFixed(2)} por m³
            </li>
          ))}
        </ul>

        <p>
          Es como si tuvieras <strong>3 salidas de agua</strong>: una azul, una verde y una roja.
        </p>

        <p>
          El niñito de 3 años pone un poquito de agua en cada una, pero la salida azul cobra barato,
          la verde cobra más y la roja cobra caro.
        </p>

        <p>
          Entonces, aunque el agua se reparta parejita, el precio final no sale igual en todas,
          porque cada salida tiene su propio precio.
        </p>

        <p>
          👉 Por eso tu pago no usa un solo precio. Es una mezcla de varios precios al mismo tiempo.
        </p>

        <div style={{ marginTop: '12px', fontSize: '12px', opacity: 0.8 }}>
          {selectedCategory.blocks.slice(0, summary.unlockedCount).map((block, i) => (
            <div key={i}>
              Cañito {i + 1}: {decimal.format(summary.perBlockVolume)} m³ × S/{' '}
              {(block.potable + block.sewage).toFixed(2)}
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}

export default App