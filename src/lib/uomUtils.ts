import { UomConversion } from '../types'

/**
 * Unit of Measure converter for recipe authoring.
 * Converts between recipe units (cup, tbsp, etc.) and base units (ml, g, etc.).
 */
export class UomConverter {
  private conversions: Map<string, number>; // "from→to" → factor

  constructor(rows: UomConversion[]) {
    this.conversions = new Map(
      rows.map(r => [`${r.fromUnit}→${r.toUnit}`, r.factor])
    );
  }

  convert(quantity: number, fromUnit: string, toUnit: string): number {
    if (fromUnit === toUnit) return quantity;

    const factor = this.conversions.get(`${fromUnit}→${toUnit}`);
    if (factor === undefined) {
      throw new Error(`No conversion from ${fromUnit} to ${toUnit}`);
    }

    return quantity * factor;
  }

  // Convenience: convert recipe quantity to base unit
  toBaseUnit(quantity: number, recipeUnit: string, baseUnit: string): number {
    return this.convert(quantity, recipeUnit, baseUnit);
  }

  // Get all available units
  getAvailableUnits(): string[] {
    const units = new Set<string>();
    for (const key of this.conversions.keys()) {
      const [from, to] = key.split('→');
      units.add(from);
      units.add(to);
    }
    return Array.from(units).sort();
  }

  // Check if a conversion exists
  canConvert(fromUnit: string, toUnit: string): boolean {
    return fromUnit === toUnit || this.conversions.has(`${fromUnit}→${toUnit}`);
  }
}
