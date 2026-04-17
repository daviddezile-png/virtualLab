import { AxonProperty, TemperatureData } from './types';

export class AxonProperties {
  private properties: Map<string, AxonProperty> = new Map();
  private temperatureHistory: Map<string, TemperatureData[]> = new Map();

  constructor() {
    this.initializeDefaultProperties();
  }

  private initializeDefaultProperties(): void {
    // Temperature properties for different phases
    this.createProperty('oil_phase_temp', 'Oil Phase Temperature', 25, 'temperature', {
      min: 0,
      max: 100,
      tolerance: 5
    });

    this.createProperty('water_phase_temp', 'Water Phase Temperature', 25, 'temperature', {
      min: 0,
      max: 100,
      tolerance: 5
    });

    this.createProperty('emulsion_temp', 'Emulsion Temperature', 25, 'temperature', {
      min: 0,
      max: 100
    });

    // pH property
    this.createProperty('ph_level', 'pH Level', 7.0, 'ph', {
      min: 3,
      max: 9
    });

    // Viscosity property
    this.createProperty('viscosity', 'Viscosity (cP)', 1000, 'viscosity', {
      min: 100,
      max: 10000
    });

    // Process state properties
    this.createProperty('is_heating', 'Is Heating', false, 'boolean');
    this.createProperty('is_cooling', 'Is Cooling', false, 'boolean');
    this.createProperty('is_mixing', 'Is Mixing', false, 'boolean');
  }

  private createProperty<T>(
    id: string,
    name: string,
    initialValue: T,
    type: AxonProperty['type'],
    constraints?: AxonProperty['constraints']
  ): void {
    const property: AxonProperty<T> = {
      id,
      name,
      value: initialValue,
      type,
      constraints,
      lastModified: new Date()
    };
    this.properties.set(id, property);
  }

  getProperty<T>(id: string): AxonProperty<T> | undefined {
    return this.properties.get(id) as AxonProperty<T>;
  }

  setProperty<T>(id: string, value: T): boolean {
    const property = this.properties.get(id);
    if (!property) {
      return false;
    }

    // Validate constraints
    if (property.type === 'temperature' || property.type === 'ph' || property.type === 'viscosity') {
      if (typeof value === 'number' && property.constraints) {
        if (property.constraints.min !== undefined && value < property.constraints.min) {
          return false;
        }
        if (property.constraints.max !== undefined && value > property.constraints.max) {
          return false;
        }
      }
    }

    property.value = value;
    property.lastModified = new Date();

    // Track temperature history
    if (property.type === 'temperature') {
      this.recordTemperatureHistory(id, value as number);
    }

    return true;
  }

  private recordTemperatureHistory(propertyId: string, temperature: number): void {
    if (!this.temperatureHistory.has(propertyId)) {
      this.temperatureHistory.set(propertyId, []);
    }

    const history = this.temperatureHistory.get(propertyId)!;
    history.push({
      current: temperature,
      target: this.getTargetTemperature(propertyId),
      heatingRate: this.getHeatingRate(propertyId),
      coolingRate: this.getCoolingRate(propertyId),
      lastUpdated: new Date()
    });

    // Keep only last 100 records
    if (history.length > 100) {
      history.shift();
    }
  }

  private getTargetTemperature(propertyId: string): number {
    // Default target temperatures based on phase
    const targets: Record<string, number> = {
      'oil_phase_temp': 75,
      'water_phase_temp': 75,
      'emulsion_temp': 45
    };
    return targets[propertyId] || 25;
  }

  private getHeatingRate(propertyId: string): number {
    // Different heating rates for different phases
    const rates: Record<string, number> = {
      'oil_phase_temp': 2.5, // 2.5°C per second
      'water_phase_temp': 3.0, // 3.0°C per second
      'emulsion_temp': 1.5 // 1.5°C per second
    };
    return rates[propertyId] || 2.0;
  }

  private getCoolingRate(propertyId: string): number {
    // Cooling rates
    const rates: Record<string, number> = {
      'oil_phase_temp': 1.5,
      'water_phase_temp': 2.0,
      'emulsion_temp': 1.0
    };
    return rates[propertyId] || 1.5;
  }

  validateTemperatureDifference(phase1Id: string, phase2Id: string): {
    isValid: boolean;
    difference: number;
    tolerance: number;
  } {
    const phase1 = this.getProperty(phase1Id);
    const phase2 = this.getProperty(phase2Id);

    if (!phase1 || !phase2 || typeof phase1.value !== 'number' || typeof phase2.value !== 'number') {
      return { isValid: false, difference: 0, tolerance: 5 };
    }

    const difference = Math.abs(phase1.value - phase2.value);
    const tolerance = phase1.constraints?.tolerance || 5;

    return {
      isValid: difference <= tolerance,
      difference,
      tolerance
    };
  }

  getTemperatureHistory(propertyId: string): TemperatureData[] {
    return this.temperatureHistory.get(propertyId) || [];
  }

  getAllProperties(): AxonProperty[] {
    return Array.from(this.properties.values());
  }

  reset(): void {
    this.properties.clear();
    this.temperatureHistory.clear();
    this.initializeDefaultProperties();
  }
}
