import { TemperatureData } from '../model/types';

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
  centerY = 0;
  top = 0;
  bottom = 0;
  left = 0;
  right = 0;
  maxWidth?: number;
}

export class ThermometerNode extends MockNode {
  private temperatureData: TemperatureData;
  private thermometerSprite: MockSprite;
  private mercurySprite: MockSprite;
  private temperatureLabel: MockLabel;
  private scaleLabels: MockLabel[] = [];

  // Position properties for layout
  public centerX: number = 0;
  public centerY: number = 0;

  constructor(temperatureData: TemperatureData, thermometerImage?: HTMLImageElement) {
    super();

    this.temperatureData = temperatureData;

    // Create thermometer background
    this.thermometerSprite = new MockSprite();
    this.thermometerSprite.image = thermometerImage || this.createThermometerTexture();
    this.thermometerSprite.scale(0.8);
    this.addChild(this.thermometerSprite);

    // Create mercury column
    this.mercurySprite = new MockSprite();
    this.mercurySprite.image = this.createMercuryTexture();
    this.mercurySprite.scale(0.8);
    this.mercurySprite.centerX = this.thermometerSprite.centerX;
    this.mercurySprite.bottom = this.thermometerSprite.bottom - 20;
    this.addChild(this.mercurySprite);

    // Create temperature display label
    this.temperatureLabel = new MockLabel();
    this.temperatureLabel.text = `${this.temperatureData.current.toFixed(1)}°C`;
    this.temperatureLabel.font = 'bold 16px Arial';
    this.temperatureLabel.fill = '#333';
    this.temperatureLabel.centerX = this.thermometerSprite.centerX;
    this.temperatureLabel.top = this.thermometerSprite.top - 30;
    this.addChild(this.temperatureLabel);

    // Create scale labels
    this.createScaleLabels();

    // Initial update
    this.updateDisplay();
  }

  private createThermometerTexture(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 40;
    canvas.height = 250;
    const ctx = canvas.getContext('2d')!;

    // Draw thermometer tube
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(15, 20, 10, 200);
    
    // Draw thermometer bulb
    ctx.beginPath();
    ctx.arc(20, 230, 15, 0, Math.PI * 2);
    ctx.fill();

    // Draw thermometer outline
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.strokeRect(15, 20, 10, 200);
    ctx.beginPath();
    ctx.arc(20, 230, 15, 0, Math.PI * 2);
    ctx.stroke();

    return canvas;
  }

  private createMercuryTexture(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 10;
    canvas.height = 200;
    const ctx = canvas.getContext('2d')!;

    // Draw mercury column
    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, '#ff4444');
    gradient.addColorStop(1, '#cc0000');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 10, 200);

    return canvas;
  }

  private createScaleLabels(): void {
    const scaleMarks = [0, 25, 50, 75, 100];
    
    scaleMarks.forEach(temp => {
      const label = new MockLabel();
      label.text = `${temp}°`;
      label.font = '10px Arial';
      label.fill = '#666';
      label.right = this.thermometerSprite.left - 5;
      
      // Calculate position based on temperature
      const position = this.thermometerSprite.bottom - 20 - ((temp / 100) * 180);
      label.centerY = position;
      
      this.addChild(label);
      this.scaleLabels.push(label);
    });
  }

  private updateDisplay(): void {
    // Update temperature label
    this.temperatureLabel.text = `${this.temperatureData.current.toFixed(1)}°C`;

    // Update mercury height based on temperature
    const mercuryHeight = Math.max(5, (this.temperatureData.current / 100) * 180);
    this.mercurySprite.setHeight(mercuryHeight);

    // Update mercury color based on temperature
    this.updateMercuryColor();

    // Add visual feedback for target temperature
    this.updateTargetIndicator();
  }

  private updateMercuryColor(): void {
    const temp = this.temperatureData.current;
    let color1, color2;

    if (temp < 20) {
      // Cold - blue
      color1 = '#4444ff';
      color2 = '#0000cc';
    } else if (temp < 40) {
      // Cool - green
      color1 = '#44ff44';
      color2 = '#00cc00';
    } else if (temp < 60) {
      // Warm - yellow
      color1 = '#ffff44';
      color2 = '#cccc00';
    } else {
      // Hot - red
      color1 = '#ff4444';
      color2 = '#cc0000';
    }

    const canvas = document.createElement('canvas');
    canvas.width = 10;
    canvas.height = 200;
    const ctx = canvas.getContext('2d')!;

    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, color1);
    gradient.addColorStop(1, color2);
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 10, 200);

    this.mercurySprite.setImage(canvas);
  }

  private targetIndicator: MockSprite | null = null;

  private updateTargetIndicator(): void {
    const targetTemp = this.temperatureData.target;
    
    // Remove existing indicator
    if (this.targetIndicator) {
      this.removeChild(this.targetIndicator);
      this.targetIndicator = null;
    }

    // Add target temperature indicator
    if (targetTemp > 0 && targetTemp <= 100) {
      this.targetIndicator = new MockSprite();
      this.targetIndicator.image = this.createTargetIndicatorTexture();
      this.targetIndicator.centerX = this.thermometerSprite.right + 10;
      
      const targetPosition = this.thermometerSprite.bottom - 20 - ((targetTemp / 100) * 180);
      this.targetIndicator.centerY = targetPosition;
      
      this.addChild(this.targetIndicator);
    }
  }

  private createTargetIndicatorTexture(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 20;
    canvas.height = 3;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#4caf50';
    ctx.fillRect(0, 0, 20, 3);

    return canvas;
  }

  public setTemperatureProperty(temperatureProperty: TProperty<number>): void {
    temperatureProperty.link((temp: number) => {
      this.temperatureData.current = temp;
      this.updateDisplay();
    });
  }

  public setTargetTemperature(target: number): void {
    this.temperatureData.target = target;
    this.updateDisplay();
  }

  public animateToTemperature(targetTemp: number, duration: number = 1000): void {
    const startTemp = this.temperatureData.current;
    const tempDiff = targetTemp - startTemp;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth animation
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      this.temperatureData.current = startTemp + (tempDiff * easeProgress);
      this.updateDisplay();

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }

  public highlight(isHighlighted: boolean): void {
    if (isHighlighted) {
      this.thermometerSprite.setStroke('#ff9800');
      this.thermometerSprite.setLineWidth(3);
      this.temperatureLabel.fill = '#ff9800';
    } else {
      this.thermometerSprite.setStroke(undefined);
      this.thermometerSprite.setLineWidth(0);
      this.temperatureLabel.fill = '#333';
    }
  }

  public setTemperatureRange(_min: number, _max: number): void {
    this.updateDisplay();
  }

  public updateTemperatureData(newData: TemperatureData): void {
    this.temperatureData = newData;
    this.updateDisplay();
  }

  public dispose(): void {
    // Clean up scale labels
    this.scaleLabels.forEach(label => {
      this.removeChild(label);
    });
    this.scaleLabels = [];

    // Clean up target indicator
    if (this.targetIndicator) {
      this.removeChild(this.targetIndicator);
      this.targetIndicator = null;
    }

    super.dispose();
  }
}
