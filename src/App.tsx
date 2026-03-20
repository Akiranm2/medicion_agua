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

/**
 * =========================================================
 * CONFIGURACIÓN GENERAL EDITABLE
 * =========================================================
 * Modifica aquí cualquier valor que Sedapal cambie en el futuro.
 */
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

/**
 * Devuelve los bloques desbloqueados por el consumo TOTAL del predio.
 * Ejemplo:
 * - 77 m3 desbloquea 4 bloques
 * - 13 m3 desbloquea 2 bloques
 */
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

/**
 * Reparte el consumo personal en partes iguales entre todos los bloques
 * desbloqueados por el consumo total de la vivienda.
 */
function calculatePersonalByUnlockedBlocks(
  personalConsumptionValue: number,
  unlockedBlocks: TariffBlock[],
) {
  if (personalConsumptionValue <= 0 || unlockedBlocks.length === 0) {
    return {
      personalPotable: 0,
      personalSewage: 0,
      perBlockVolume: 0,
    }
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

  return {
    personalPotable,
    personalSewage,
    perBlockVolume,
  }
}

function App() {
  const [categoryKey, setCategoryKey] = useState(CATEGORIES[1].key)

  // Inputs (lo que el usuario escribe)
  const [inputTotal, setInputTotal] = useState('77')
  const [inputPersonal, setInputPersonal] = useState('13.1')

  // Valores aplicados (solo cambian al presionar Enter o botón)
  const [totalConsumption, setTotalConsumption] = useState(77)
  const [personalConsumption, setPersonalConsumption] = useState(13.1)

  const selectedCategory = useMemo(
    () => CATEGORIES.find((c) => c.key === categoryKey) ?? CATEGORIES[1],
    [categoryKey],
  )

  const applyCalculation = () => {
    const total = Number(inputTotal)
    const personal = Number(inputPersonal)

    if (
      Number.isFinite(total) &&
      Number.isFinite(personal) &&
      total > 0 &&
      personal >= 0 &&
      personal <= total
    ) {
      setTotalConsumption(total)
      setPersonalConsumption(personal)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      applyCalculation()
    }
  }

  const summary = useMemo(() => {
    const IGV = SETTINGS.igvPercent / 100

    const unlockedBlocks = getUnlockedBlocks(totalConsumption, selectedCategory.blocks)
    const variableTotal = calculateVariableCharge(totalConsumption, selectedCategory.blocks)

    const { personalPotable, personalSewage, perBlockVolume } =
      calculatePersonalByUnlockedBlocks(personalConsumption, unlockedBlocks)

    const personalSubtotal = personalPotable + personalSewage
    const personalIgv = personalSubtotal * IGV
    const personalFinal = personalSubtotal + personalIgv

    const totalBase = variableTotal + SETTINGS.fixedCharge
    const totalIgv = totalBase * IGV
    const totalBill = totalBase + totalIgv + SETTINGS.lateFee + SETTINGS.rounding

    return {
      unlockedCount: unlockedBlocks.length,
      perBlockVolume,
      variableTotal,
      totalBill,
      personalPotable,
      personalSewage,
      personalSubtotal,
      personalIgv,
      personalFinal,
    }
  }, [categoryKey, personalConsumption, selectedCategory.blocks, totalConsumption])

  return (
    <main className="app-shell">
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
              value={inputTotal}
              onChange={(e) => setInputTotal(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </label>

          <label className="field">
            <span>Consumo medido (m³)</span>
            <input
              type="number"
              value={inputPersonal}
              onChange={(e) => setInputPersonal(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </label>
        </div>

        <button className="calculate-btn" onClick={applyCalculation}>
          Calcular
        </button>
      </section>

      <section className="results-grid">
        <article className="result-card highlight">
          <p>Tu pago estimado</p>
          <h2>{currency.format(summary.personalFinal)}</h2>
          <small>
            {decimal.format(personalConsumption)} m³ ÷ {summary.unlockedCount} escalas ={' '}
            {decimal.format(summary.perBlockVolume)} m³ por escala
          </small>
        </article>

        <article className="result-card">
          <p>Recibo total del predio</p>
          <h2>{currency.format(summary.totalBill)}</h2>
        </article>

        <article className="result-card">
          <p>Desglose personal</p>
          <h2>{currency.format(summary.personalSubtotal)}</h2>
        </article>
      </section>
    </main>
  )
}

export default App