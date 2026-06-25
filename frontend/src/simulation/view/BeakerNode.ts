import { BeakerState } from '../model/types';

// Mock SceneryStack types for demonstration - replace with actual imports
interface Node {
  children: any[];
  addChild(child: any): void;
  removeChild(child: any): void;
  animateTo(props: any, options?: any): void;
  dispose(): void;
}

interface Sprite extends Node {
  image: HTMLImageElement | HTMLCanvasElement;
  scale(factor: number): void;
  center: { x: number; y: number };
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  setWidth(width: number): void;
  setHeight(height: number): void;
  setStroke(color?: string): void;
  setLineWidth(width: number): void;
  setOpacity(opacity: number): void;
  setImage(image: HTMLImageElement | HTMLCanvasElement): void;
}

interface Label extends Node {
  text: string;
  font: string;
  fill: string;
  centerX: number;
  top: number;
  bottom: number;
  maxWidth?: number;
}

interface TProperty<T> {
  link(callback: (value: T) => void): void;
}

// Mock implementations for demonstration
class MockNode implements Node {
  children: any[] = [];
  
  addChild(child: any): void {
    this.children.push(child);
  }
  
  removeChild(child: any): void {
    const index = this.children.indexOf(child);
    if (index > -1) {
      this.children.splice(index, 1);
    }
  }
  
  animateTo(_props: any, _options?: any): void {
    // Mock animation
  }
  
  dispose(): void {
    this.children = [];
  }
}

class MockSprite extends MockNode implements Sprite {
  image: HTMLImageElement | HTMLCanvasElement = new Image();
  center = { x: 0, y: 0 };
  top = 0;
  bottom = 0;
  left = 0;
  right = 0;
  width = 0;
  height = 0;
  centerX = 0;
  centerY = 0;
  
  scale(factor: number): void {
    this.width *= factor;
    this.height *= factor;
  }
  
  setWidth(width: number): void {
    this.width = width;
  }
  
  setHeight(height: number): void {
    this.height = height;
  }
  
  setStroke(_color?: string): void {
    // Mock implementation
  }

  setLineWidth(_width: number): void {
    // Mock implementation
  }

  setOpacity(_opacity: number): void {
    // Mock implementation
  }
  
  setImage(image: HTMLImageElement | HTMLCanvasElement): void {
    this.image = image;
  }
}

class MockLabel extends MockNode implements Label {
  text = '';
  font = '';
  fill = '';
  centerX = 0;
  top = 0;
  bottom = 0;
  maxWidth?: number;
}

export class BeakerNode extends MockNode {
  private beakerState: BeakerState;
  private beakerSprite: MockSprite;
  private liquidSprite: MockSprite;
  private temperatureLabel: MockLabel;
  private volumeLabel: MockLabel;
  private ingredientsLabel: MockLabel;
  
  // Position properties for layout
  public centerX: number = 0;
  public centerY: number = 0;

  constructor(beakerState: BeakerState, beakerImage: HTMLImageElement) {
    super();

    this.beakerState = beakerState;

    // Create beaker container sprite
    this.beakerSprite = new MockSprite();
    this.beakerSprite.image = beakerImage;
    this.beakerSprite.scale(0.5); // Adjust scale as needed
    this.addChild(this.beakerSprite);

    // Create liquid sprite (will be updated based on volume)
    this.liquidSprite = new MockSprite();
    this.liquidSprite.image = this.createLiquidTexture();
    this.liquidSprite.scale(0.5);
    this.liquidSprite.centerX = this.beakerSprite.centerX;
    this.liquidSprite.bottom = this.beakerSprite.bottom - 10; // Offset for beaker bottom
    this.addChild(this.liquidSprite);

    // Create temperature label
    this.temperatureLabel = new MockLabel();
    this.temperatureLabel.text = '';
    this.temperatureLabel.font = '14px Arial';
    this.temperatureLabel.fill = '#333';
    this.temperatureLabel.centerX = this.beakerSprite.centerX;
    this.temperatureLabel.top = this.beakerSprite.top - 25;
    this.addChild(this.temperatureLabel);

    // Create volume label
    this.volumeLabel = new MockLabel();
    this.volumeLabel.text = '';
    this.volumeLabel.font = '12px Arial';
    this.volumeLabel.fill = '#666';
    this.volumeLabel.centerX = this.beakerSprite.centerX;
    this.volumeLabel.bottom = this.beakerSprite.bottom + 20;
    this.addChild(this.volumeLabel);

    // Create ingredients label
    this.ingredientsLabel = new MockLabel();
    this.ingredientsLabel.text = '';
    this.ingredientsLabel.font = '11px Arial';
    this.ingredientsLabel.fill = '#888';
    this.ingredientsLabel.centerX = this.beakerSprite.centerX;
    this.ingredientsLabel.top = this.beakerSprite.bottom + 25;
    this.ingredientsLabel.maxWidth = 150;
    this.addChild(this.ingredientsLabel);

    // Initial update
    this.updateDisplay();
  }

  private createLiquidTexture(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext('2d')!;

    // Create gradient for liquid appearance
    const gradient = ctx.createLinearGradient(0, 0, 0, 100);
    
    // Color based on phase and temperature
    let color1, color2;

    if (this.beakerState.id === 'oil_phase') {
      // Yellowish for oil phase
      color1 = `rgba(255, 220, 100, ${this.getOpacity()})`;
      color2 = `rgba(255, 200, 50, ${this.getOpacity()})`;
    } else if (this.beakerState.id === 'water_phase') {
      // Bluish for water phase
      color1 = `rgba(100, 150, 255, ${this.getOpacity()})`;
      color2 = `rgba(50, 100, 200, ${this.getOpacity()})`;
    } else {
      // White/cream for emulsion
      color1 = `rgba(255, 250, 240, ${this.getOpacity()})`;
      color2 = `rgba(245, 235, 220, ${this.getOpacity()})`;
    }

    gradient.addColorStop(0, color1);
    gradient.addColorStop(1, color2);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 100, 100);

    return canvas;
  }

  private getOpacity(): number {
    // Opacity based on volume (more volume = more opaque)
    return Math.min(0.9, 0.3 + (this.beakerState.volume / 200) * 0.6);
  }

  private updateDisplay(): void {
    // Update temperature label
    this.temperatureLabel.text = `${this.beakerState.temperature.current.toFixed(1)}°C`;
    
    // Update volume label
    this.volumeLabel.text = `${this.beakerState.volume.toFixed(1)} mL`;
    
    // Update ingredients label
    if (this.beakerState.ingredients.length > 0) {
      const ingredientNames = this.beakerState.ingredients.map(i => i.name).join(', ');
      this.ingredientsLabel.text = ingredientNames;
    } else {
      this.ingredientsLabel.text = 'Empty';
    }

    // Update liquid sprite
    this.liquidSprite.setImage(this.createLiquidTexture());
    
    // Adjust liquid height based on volume
    const liquidHeight = Math.max(10, Math.min(80, this.beakerState.volume * 0.4));
    this.liquidSprite.setHeight(liquidHeight);

    // Update beaker appearance based on temperature
    this.updateTemperatureAppearance();
  }

  private updateTemperatureAppearance(): void {
    const temp = this.beakerState.temperature.current;
    
    // Add visual feedback for temperature
    if (temp > 70) {
      // Hot - add red tint
      this.beakerSprite.setOpacity(1);
      this.temperatureLabel.fill = '#d32f2f';
    } else if (temp < 30) {
      // Cold - add blue tint
      this.beakerSprite.setOpacity(0.9);
      this.temperatureLabel.fill = '#1976d2';
    } else {
      // Normal temperature
      this.beakerSprite.setOpacity(1);
      this.temperatureLabel.fill = '#333';
    }

    // Add boiling effect if very hot
    if (temp > 80) {
      this.addBubbles();
    } else {
      this.removeBubbles();
    }
  }

  private bubbles: MockNode[] = [];

  private addBubbles(): void {
    if (this.bubbles.length > 0) return; // Already have bubbles

    for (let i = 0; i < 5; i++) {
      const bubble = new MockNode();

      // Position bubble randomly in liquid area (mock implementation)
      (bubble as any).centerX = this.liquidSprite.centerX + (Math.random() - 0.5) * 40;
      (bubble as any).bottom = this.liquidSprite.bottom + Math.random() * 20;

      this.addChild(bubble);
      this.bubbles.push(bubble);

      // Animate bubble rising
      this.animateBubble(bubble);
    }
  }

  private animateBubble(bubble: MockNode): void {
    const duration = 2000 + Math.random() * 1000;
    const startY = (bubble as any).y || 0;
    const endY = startY - 40;

    bubble.animateTo({
      y: endY,
      opacity: 0
    }, {
      duration: duration,
      easing: 'linear',
      callback: () => {
        // Reset bubble
        (bubble as any).y = startY;
        (bubble as any).opacity = 1;
        (bubble as any).centerX = this.liquidSprite.centerX + (Math.random() - 0.5) * 40;
        
        // Continue animation
        if (this.beakerState.temperature.current > 80) {
          this.animateBubble(bubble);
        }
      }
    });
  }

  private removeBubbles(): void {
    this.bubbles.forEach(bubble => {
      this.removeChild(bubble);
    });
    this.bubbles = [];
  }

  public updateBeakerState(newState: BeakerState): void {
    this.beakerState = newState;
    this.updateDisplay();
  }

  public setTemperatureProperty(temperatureProperty: TProperty<number>): void {
    temperatureProperty.link(temp => {
      this.beakerState.temperature.current = temp;
      this.updateDisplay();
    });
  }

  public setVolumeProperty(volumeProperty: TProperty<number>): void {
    volumeProperty.link(volume => {
      this.beakerState.volume = volume;
      this.updateDisplay();
    });
  }

  public highlight(isHighlighted: boolean): void {
    if (isHighlighted) {
      this.beakerSprite.setStroke('#4caf50');
      this.beakerSprite.setLineWidth(3);
    } else {
      this.beakerSprite.setStroke(undefined);
      this.beakerSprite.setLineWidth(0);
    }
  }

  public dispose(): void {
    this.removeBubbles();
    // Clean up any animations or listeners
    super.dispose();
  }
}
