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
 * Cambia aquí cualquier valor que Sedapal actualice en el futuro.
 */
const SETTINGS = {
  igvPercent: 18,
  fixedCharge: 6.3,
  lateFee: 2.76,
  rounding: 0.06,

  /**
   * Tarifa efectiva promedio del predio para categoría doméstico.
   * Esto mantiene el recibo total del predio como antes:
   * 77 m3 -> aprox S/ 377.22
   */
  domesticEffectivePotable: 2.4873,
  domesticEffectiveSewage: 1.5515,
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

function calculateProgressiveVariableCharge(consumption: number, blocks: TariffBlock[]) {
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
 * Recibo total del predio:
 * - Doméstico: usa tarifa efectiva promedio para conservar el total esperado
 * - Otras categorías: usa cálculo progresivo normal por bloques
 */
function calculatePropertyVariableCharge(
  consumption: number,
  categoryKey: string,
  blocks: TariffBlock[],
) {
  if (consumption <= 0) {
    return 0
  }

  if (categoryKey === 'domestico') {
    return (
      consumption *
      (SETTINGS.domesticEffectivePotable + SETTINGS.domesticEffectiveSewage)
    )
  }

  return calculateProgressiveVariableCharge(consumption, blocks)
}

/**
 * Bloques desbloqueados por el consumo TOTAL del predio.
 * Ejemplo:
 * - 77 m3 -> 4 bloques desbloqueados
 * - 13 m3 -> 2 bloques desbloqueados
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
 * Cálculo personal:
 * divide el consumo personal entre todos los bloques desbloqueados
 * por el consumo total del predio.
 *
 * Ejemplo:
 * - Predio: 77 m3 -> 4 bloques desbloqueados
 * - Persona: 13.1 m3
 * - 13.1 / 4 = 3.275 m3 por bloque
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

  // Inputs visibles
  const [inputTotal, setInputTotal] = useState('77')
  const [inputPersonal, setInputPersonal] = useState('13.1')

  // Valores aplicados al cálculo
  const [totalConsumption, setTotalConsumption] = useState(77)
  const [personalConsumption, setPersonalConsumption] = useState(13.1)

  const [validationMessage, setValidationMessage] = useState('')

  const selectedCategory = useMemo(
    () => CATEGORIES.find((category) => category.key === categoryKey) ?? CATEGORIES[1],
    [categoryKey],
  )

  const applyCalculation = () => {
    const total = Number(inputTotal)
    const personal = Number(inputPersonal)

    if (!Number.isFinite(total) || !Number.isFinite(personal)) {
      setValidationMessage('Ingresa números válidos.')
      return
    }

    if (total <= 0) {
      setValidationMessage('El consumo total del predio debe ser mayor a 0.')
      return
    }

    if (personal < 0) {
      setValidationMessage('El consumo medido no puede ser negativo.')
      return
    }

    if (personal > total) {
      setValidationMessage('El consumo medido no puede superar el total del predio.')
      return
    }

    setValidationMessage('')
    setTotalConsumption(total)
    setPersonalConsumption(personal)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      applyCalculation()
    }
  }

  const summary = useMemo(() => {
    const IGV = SETTINGS.igvPercent / 100

    const unlockedBlocks = getUnlockedBlocks(totalConsumption, selectedCategory.blocks)

    const variableTotal = calculatePropertyVariableCharge(
      totalConsumption,
      selectedCategory.key,
      selectedCategory.blocks,
    )

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
      totalBase,
      totalIgv,
      totalBill,
      personalPotable,
      personalSewage,
      personalSubtotal,
      personalIgv,
      personalFinal,
    }
  }, [categoryKey, personalConsumption, selectedCategory.blocks, selectedCategory.key, totalConsumption])

  return (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">Calculadora Sedapal</p>
        <h1>Calcula tu pago de agua en segundos</h1>
        <p className="subtitle">
          El consumo total del predio define cuántas escalas quedaron activadas. Luego tu consumo
          medido se divide en partes iguales entre esas escalas desbloqueadas. El I.G.V. se asume
          automáticamente en {SETTINGS.igvPercent}%.
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
              inputMode="decimal"
              value={inputTotal}
              onChange={(event) => setInputTotal(event.target.value)}
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
              onChange={(event) => setInputPersonal(event.target.value)}
              onKeyDown={handleKeyDown}
            />
          </label>
        </div>

        <button className="calculate-btn" onClick={applyCalculation}>
          Calcular
        </button>

        {validationMessage && <p className="validation">{validationMessage}</p>}
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
          Para mantenimiento futuro, modifica únicamente el bloque <strong>SETTINGS</strong> y las
          tarifas dentro de <strong>CATEGORIES</strong>.
        </p>
      </section>

      <section className="explain-card">
        <h2>¿Cómo funciona? Explicado fácil</h2>
        <p>
          Imagina que la casa abre varios caños con precios distintos según cuánto consumió toda la
          vivienda.
        </p>
        <p>
          Si el predio consumió bastante, por ejemplo <strong>77 m³</strong>, entonces se abren las{' '}
          <strong>4 escalas</strong>.
        </p>
        <p>
          Después, si una persona consumió <strong>13.1 m³</strong>, su consumo se reparte por igual
          entre esas 4 escalas:
        </p>
        <p>
          <strong>13.1 ÷ 4 = 3.275 m³</strong> por escala.
        </p>
        <p>
          Luego se suma lo que cuesta el agua, lo que cuesta el saneamiento y finalmente se agrega
          el <strong>I.G.V. del 18%</strong>.
        </p>
      </section>
    </main>
  )
}

export default App