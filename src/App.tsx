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

const CATEGORIES: TariffCategory[] = [
  {
    key: 'social',
    label: 'Social',
    blocks: [{ upTo: null, potable: 1.92, sewage: 0.9 }],
  },
  {
    key: 'domestico',
    label: 'Doméstico',
    blocks: [{ upTo: null, potable: 2.4873, sewage: 1.5515 }],
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
})

const decimal = new Intl.NumberFormat('es-PE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function calculateVariableCharge(consumption: number, blocks: TariffBlock[]) {
  if (consumption <= 0) {
    return 0
  }

  let cost = 0
  let previousLimit = 0

  for (const block of blocks) {
    const currentLimit = block.upTo ?? Number.POSITIVE_INFINITY
    const blockVolume = Math.max(0, Math.min(consumption, currentLimit) - previousLimit)

    if (blockVolume > 0) {
      cost += blockVolume * (block.potable + block.sewage)
    }

    previousLimit = currentLimit

    if (consumption <= currentLimit) {
      break
    }
  }

  return cost
}

function App() {
  const [categoryKey, setCategoryKey] = useState(CATEGORIES[1].key)
  const [totalConsumption, setTotalConsumption] = useState('25')
  const [personalConsumption, setPersonalConsumption] = useState('7.5')

  const selectedCategory = useMemo(
    () => CATEGORIES.find((category) => category.key === categoryKey) ?? CATEGORIES[1],
    [categoryKey],
  )

  const totalValue = Number(totalConsumption)
  const personalValue = Number(personalConsumption)
  const hasValidValues =
    Number.isFinite(totalValue) &&
    Number.isFinite(personalValue) &&
    totalValue > 0 &&
    personalValue >= 0 &&
    personalValue <= totalValue

  const summary = useMemo(() => {
    if (!hasValidValues) {
      return null
    }

    const variableTotal = calculateVariableCharge(totalValue, selectedCategory.blocks)
    const participation = personalValue / totalValue
    const personalVariable = variableTotal * participation

    return {
      variableTotal,
      personalVariable,
      effectiveRate: variableTotal / totalValue,
      participation,
    }
  }, [hasValidValues, personalValue, selectedCategory.blocks, totalValue])

  return (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">Calculadora Sedapal</p>
        <h1>Calcula tu pago de agua en segundos</h1>
        <p className="subtitle">
          Ingresa el consumo total del predio y tu lectura personal. El sistema estima el monto
          proporcional usando la estructura tarifaria seleccionada.
        </p>
      </section>

      <section className="calculator-card">
        <div className="grid">
          <label className="field">
            <span>Estructura tarifaria</span>
            <select value={categoryKey} onChange={(event) => setCategoryKey(event.target.value)}>
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
              value={totalConsumption}
              onChange={(event) => setTotalConsumption(event.target.value)}
            />
          </label>

          <label className="field">
            <span>Tu consumo medido (m³)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={personalConsumption}
              onChange={(event) => setPersonalConsumption(event.target.value)}
            />
          </label>
        </div>
        {!hasValidValues && (
          <p className="validation">
            Verifica los datos: el consumo total debe ser mayor a 0 y tu consumo no puede superar
            el total.
          </p>
        )}
      </section>

      {summary && (
        <section className="results-grid">
          <article className="result-card highlight">
            <p>Tu pago estimado</p>
            <h2>{currency.format(summary.personalVariable)}</h2>
            <small>
              Participación: {decimal.format(summary.participation * 100)}% del consumo total
            </small>
          </article>

          <article className="result-card">
            <p>Recibo total del predio</p>
            <h2>{currency.format(summary.variableTotal)}</h2>
            <small>Solo consumo variable según bloques tarifarios</small>
          </article>

          <article className="result-card">
            <p>Tu parte variable</p>
            <h2>{currency.format(summary.personalVariable)}</h2>
            <small>Tarifa efectiva: S/ {decimal.format(summary.effectiveRate)} por m³</small>
          </article>

        </section>
      )}

      <section className="footnote">
        <p>
          Referencia usada: Grupo 1 de Sedapal y tarifa por volumen de agua potable +
          saneamiento. Este cálculo es referencial y no incluye IGV.
        </p>
      </section>
    </main>
  )
}

export default App
