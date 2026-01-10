import React from 'react';
import { RoseConfig } from '../types';

interface UIProps {
  config: RoseConfig;
  onConfigChange: (key: keyof RoseConfig, value: number | string) => void;
}

export const UI: React.FC<UIProps> = ({ config, onConfigChange }) => {
  return (
    <div className="bg-black/60 backdrop-blur-md border border-white/10 p-6 rounded-2xl w-full max-w-sm text-sm shadow-2xl">
      <h1 className="text-2xl font-light mb-1 bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-violet-500">
        Particle Rose
      </h1>
      <p className="text-white/50 mb-6 text-xs">Procedural Point Cloud System</p>

      <div className="space-y-5">
        
        {/* Color Picker */}
        <div className="flex items-center justify-between">
          <label className="text-white/80 font-medium">Color</label>
          <div className="flex items-center gap-2">
             <span className="text-xs text-white/50">{config.color}</span>
             <input
              type="color"
              value={config.color}
              onChange={(e) => onConfigChange('color', e.target.value)}
              className="w-8 h-8 rounded-full border-none cursor-pointer bg-transparent"
            />
          </div>
        </div>

        {/* Sliders */}
        <ControlGroup 
          label="Petal Layers" 
          value={config.petalCount} 
          min={1} 
          max={10} 
          step={0.1}
          onChange={(v) => onConfigChange('petalCount', v)} 
        />

        <ControlGroup 
          label="Twist Factor" 
          value={config.twist} 
          min={0} 
          max={10} 
          step={0.1}
          onChange={(v) => onConfigChange('twist', v)} 
        />

        <ControlGroup 
          label="Bloom Openness" 
          value={config.openness} 
          min={0} 
          max={3} 
          step={0.1}
          onChange={(v) => onConfigChange('openness', v)} 
        />

         <ControlGroup 
          label="Scattering Detail" 
          value={config.detail} 
          min={0} 
          max={5} 
          step={0.1}
          onChange={(v) => onConfigChange('detail', v)} 
        />

        <ControlGroup 
          label="Particle Size" 
          value={config.particleSize} 
          min={0.01} 
          max={0.2} 
          step={0.001}
          onChange={(v) => onConfigChange('particleSize', v)} 
        />

        <ControlGroup 
          label="Animation Speed" 
          value={config.speed} 
          min={0} 
          max={1} 
          step={0.01}
          onChange={(v) => onConfigChange('speed', v)} 
        />

      </div>
    </div>
  );
};

// Helper Component for Sliders
const ControlGroup: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (val: number) => void;
}> = ({ label, value, min, max, step, onChange }) => (
  <div className="space-y-2">
    <div className="flex justify-between">
      <label className="text-white/80">{label}</label>
      <span className="text-white/50 font-mono text-xs">{value.toFixed(3)}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer hover:bg-white/30 transition-colors focus:outline-none focus:ring-2 focus:ring-pink-500/50"
      style={{
        backgroundImage: `linear-gradient(to right, #ec4899 0%, #8b5cf6 ${(value - min) / (max - min) * 100}%, transparent ${(value - min) / (max - min) * 100}%)`,
        backgroundRepeat: 'no-repeat',
      }}
    />
  </div>
);