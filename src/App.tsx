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
})

const decimal = new Intl.NumberFormat('es-PE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const DOMESTIC_EFFECTIVE_POTABLE = 2.4873
const DOMESTIC_EFFECTIVE_SEWAGE = 1.5515

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

function getUnlockedBlocks(consumption: number, blocks: TariffBlock[]) {
  if (consumption <= 0) {
    return []
  }

  const unlocked: TariffBlock[] = []
  let previousLimit = 0

  for (const block of blocks) {
    const currentLimit = block.upTo ?? Number.POSITIVE_INFINITY
    const blockVolume = Math.max(0, Math.min(consumption, currentLimit) - previousLimit)

    if (blockVolume > 0) {
      unlocked.push(block)
    }

    previousLimit = currentLimit

    if (consumption <= currentLimit) {
      break
    }
  }

  return unlocked
}

function calculatePersonalByUnlockedBlocks(
  personalConsumptionValue: number,
  unlockedBlocks: TariffBlock[],
) {
  if (personalConsumptionValue <= 0 || unlockedBlocks.length === 0) {
    return { personalPotable: 0, personalSewage: 0, perBlockVolume: 0 }
  }

  const perBlockVolume = personalConsumptionValue / unlockedBlocks.length
  const personalPotable = unlockedBlocks.reduce(
    (sum, block) => sum + perBlockVolume * block.potable,
    0,
  )
  const personalSewage = unlockedBlocks.reduce(
    (sum, block) => sum + perBlockVolume * block.sewage,
    0,
  )

  return { personalPotable, personalSewage, perBlockVolume }
}

function calculatePropertyVariableCharge(consumption: number, categoryKey: string, blocks: TariffBlock[]) {
  if (categoryKey === 'domestico') {
    return consumption * (DOMESTIC_EFFECTIVE_POTABLE + DOMESTIC_EFFECTIVE_SEWAGE)
  }

  return calculateVariableCharge(consumption, blocks)
}

function App() {
  const [categoryKey, setCategoryKey] = useState(CATEGORIES[1].key)
  const [totalConsumption, setTotalConsumption] = useState('25')
  const [personalConsumption, setPersonalConsumption] = useState('7.5')
  const [igvPercent, setIgvPercent] = useState('18')
  const [fixedCharge, setFixedCharge] = useState('6.30')
  const [lateFee, setLateFee] = useState('2.76')
  const [rounding, setRounding] = useState('0.06')

  const selectedCategory = useMemo(
    () => CATEGORIES.find((category) => category.key === categoryKey) ?? CATEGORIES[1],
    [categoryKey],
  )

  const totalValue = Number(totalConsumption)
  const personalValue = Number(personalConsumption)
  const igvPercentValue = Number(igvPercent)
  const fixedChargeValue = Number(fixedCharge)
  const lateFeeValue = Number(lateFee)
  const roundingValue = Number(rounding)
  const hasValidValues =
    Number.isFinite(totalValue) &&
    Number.isFinite(personalValue) &&
    Number.isFinite(igvPercentValue) &&
    Number.isFinite(fixedChargeValue) &&
    Number.isFinite(lateFeeValue) &&
    Number.isFinite(roundingValue) &&
    totalValue > 0 &&
    personalValue >= 0 &&
    igvPercentValue >= 0 &&
    fixedChargeValue >= 0 &&
    lateFeeValue >= 0 &&
    personalValue <= totalValue

  const summary = useMemo(() => {
    if (!hasValidValues) {
      return null
    }

    const variableTotal = calculatePropertyVariableCharge(
      totalValue,
      selectedCategory.key,
      selectedCategory.blocks,
    )
    const unlockedBlocks = getUnlockedBlocks(totalValue, selectedCategory.blocks)
    const { personalPotable, personalSewage, perBlockVolume } = calculatePersonalByUnlockedBlocks(
      personalValue,
      unlockedBlocks,
    )
    const personalSubtotal = personalPotable + personalSewage
    const personalIgv = personalSubtotal * (igvPercentValue / 100)
    const personalFinal = personalSubtotal + personalIgv
    const totalBase = variableTotal + fixedChargeValue
    const totalIgv = totalBase * (igvPercentValue / 100)
    const totalBill = totalBase + totalIgv + lateFeeValue + roundingValue

    return {
      variableTotal,
      fixedCharge: fixedChargeValue,
      totalIgv,
      lateFee: lateFeeValue,
      rounding: roundingValue,
      totalBill,
      personalPotable,
      personalSewage,
      personalSubtotal,
      personalIgv,
      personalFinal,
      effectiveRate: variableTotal / totalValue,
      unlockedCount: unlockedBlocks.length,
      perBlockVolume,
    }
  }, [
    fixedChargeValue,
    hasValidValues,
    igvPercentValue,
    lateFeeValue,
    roundingValue,
    selectedCategory.key,
    selectedCategory.blocks,
    totalValue,
  ])

  return (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">Calculadora Sedapal</p>
        <h1>Calcula tu pago de agua en segundos</h1>
        <p className="subtitle">
          Ingresa el consumo total del predio y tu lectura personal. El consumo total se calcula
          por tramos tarifarios y tu consumo se divide en partes iguales entre los bloques
          desbloqueados por el consumo total. Luego se suma agua + saneamiento y se aplica I.G.V.
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

          <label className="field">
            <span>I.G.V. (%)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={igvPercent}
              onChange={(event) => setIgvPercent(event.target.value)}
            />
          </label>

          <label className="field">
            <span>Cargo fijo mensual (S/)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={fixedCharge}
              onChange={(event) => setFixedCharge(event.target.value)}
            />
          </label>

          <label className="field">
            <span>Mora (S/)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={lateFee}
              onChange={(event) => setLateFee(event.target.value)}
            />
          </label>

          <label className="field">
            <span>Redondeo (S/)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={rounding}
              onChange={(event) => setRounding(event.target.value)}
            />
          </label>
        </div>
        {!hasValidValues && (
          <p className="validation">
            Verifica los datos: valores positivos, consumo total mayor a 0 y tu consumo no puede
            superar el total.
          </p>
        )}
      </section>

      {summary && (
        <section className="results-grid">
          <article className="result-card highlight">
            <p>Tu pago estimado</p>
            <h2>{currency.format(summary.personalFinal)}</h2>
            <small>
              {decimal.format(personalValue)} m³ ÷ {summary.unlockedCount} bloques ={' '}
              {decimal.format(summary.perBlockVolume)} m³ por bloque
            </small>
          </article>

          <article className="result-card">
            <p>Recibo total del predio</p>
            <h2>{currency.format(summary.totalBill)}</h2>
            <small>
              Variable {currency.format(summary.variableTotal)} + fijo{' '}
              {currency.format(summary.fixedCharge)} + I.G.V. {currency.format(summary.totalIgv)} +
              mora {currency.format(summary.lateFee)} + redondeo {currency.format(summary.rounding)}
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
      )}

      <section className="footnote">
        <p>
          Referencia usada: Grupo 1 de Sedapal y tarifa por volumen de agua potable +
          saneamiento. El cálculo personal divide m³ en bloques desbloqueados y aplica I.G.V.
        </p>
      </section>
    </main>
  )
}

export default App
