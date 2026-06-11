import type { FlightGeneratorInput } from '@/types/database'

export interface GeneratedFlight {
  name: string
  platform_order: number
  athlete_ids: string[]  // ordered by platform_order
}

/**
 * Replicates the Google Script flight generation algorithm:
 * 1. For each category group, sort athletes by opener ASC (nulls last)
 * 2. Chain groups in order (Female → -66 → -73 etc.)
 * 3. Slice into flights of flightSize
 */
export function generateFlights(input: FlightGeneratorInput): GeneratedFlight[] {
  const { athletes, flight_size, category_groups } = input

  // Build ordered athlete list by chaining sorted category groups
  const ordered: string[] = []

  for (const group of category_groups) {
    const groupAthletes = athletes
      .filter(a => group.includes(a.category_name))
      .sort((a, b) => {
        const wA = a.opener_weight ?? Infinity
        const wB = b.opener_weight ?? Infinity
        return wA - wB
      })

    for (const a of groupAthletes) {
      ordered.push(a.athlete_id)
    }
  }

  // Slice into flights of flight_size
  const flights: GeneratedFlight[] = []
  const flightNames = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let flightIdx = 0

  for (let i = 0; i < ordered.length; i += flight_size) {
    flights.push({
      name: flightNames[flightIdx] ?? `F${flightIdx + 1}`,
      platform_order: flightIdx,
      athlete_ids: ordered.slice(i, i + flight_size),
    })
    flightIdx++
  }

  return flights
}

/**
 * Given a tournament's category config, build the category_groups array.
 * Categories with same display_order share a group (compete together).
 */
export function buildCategoryGroups(
  categories: Array<{ name: string; display_order: number }>
): string[][] {
  const byOrder = new Map<number, string[]>()

  for (const cat of categories) {
    const existing = byOrder.get(cat.display_order) ?? []
    existing.push(cat.name)
    byOrder.set(cat.display_order, existing)
  }

  return Array.from(byOrder.entries())
    .sort(([a], [b]) => a - b)
    .map(([, names]) => names)
}
