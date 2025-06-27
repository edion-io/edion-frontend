import { useState, useRef, useEffect, forwardRef } from 'react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Toggle } from '../ui/toggle';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Paintbrush, Check } from 'lucide-react';

interface ColorPickerProps {
  onSelectColor: (color: string) => void;
  triggerIcon: React.ReactNode;
  label: string;
  className?: string;
  initialColor?: string;
  showTransparentOption?: boolean;
  recentColors?: string[];
}

interface HSV {
  h: number; // 0-360
  s: number; // 0-100
  v: number; // 0-100
}

interface RGB {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
}

export const ColorPicker = forwardRef<HTMLButtonElement, ColorPickerProps>(
  ({ onSelectColor, triggerIcon, label, className = "", initialColor, showTransparentOption = false, recentColors = [] }, ref) => {
    
    const [showCustom, setShowCustom] = useState(false);
    const [customColor, setCustomColor] = useState('#ff0000');
    const [selectedColor, setSelectedColor] = useState<string | null>(null);
    const [open, setOpen] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [isDraggingHue, setIsDraggingHue] = useState(false);
    const [hsv, setHsv] = useState<HSV>({ h: 0, s: 100, v: 100 });
    
    const gradientRef = useRef<HTMLDivElement>(null);
    const hueSliderRef = useRef<HTMLDivElement>(null);
    const colorIndicatorRef = useRef<HTMLDivElement>(null);
    const hueIndicatorRef = useRef<HTMLDivElement>(null);
    
    // Sync with initialColor when it changes or component mounts
    useEffect(() => {
      if (initialColor && selectedColor === null) {
        // Only set selectedColor from initialColor if selectedColor is null
        // This ensures user's selection persists between opens
        setSelectedColor(initialColor);
      }
    }, [initialColor, selectedColor]);
    
    // Reset to default view when popover closes
    const handleOpenChange = (newOpen: boolean) => {
      setOpen(newOpen);
      
      // If closing the popover, reset to default view
      if (!newOpen) {
        setShowCustom(false);
      }
    };
    
    // Handle opening the custom view
    const handleShowCustom = () => {
      setShowCustom(true);
      
      // Initialize HSV from current selected color or default
      const colorToUse = selectedColor || customColor;
      const rgb = hexToRgb(colorToUse);
      if (rgb) {
        const newHsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
        setHsv(newHsv);
        setCustomColor(colorToUse);
      }
    };
    
    // Color palette in organized format - each column represents shades of the same hue
    const colorPalette = [
      // Row 1: Vibrant colors - main color spectrum
      ['#ff0000', '#ff8000', '#ffff00', '#80ff00', '#00ff00', '#00ff80', '#00ffff', '#0080ff', '#0000ff', '#8000ff'],
      
      // Rows 2-6: Shades of the colors above (moving from lighter to darker)
      
      // Row 2: Very light shades
      ['#ffcccc', '#ffeacc', '#ffffcc', '#eaffcc', '#ccffcc', '#ccffea', '#ccffff', '#cceaff', '#ccccff', '#eaccff'],
      
      // Row 3: Light shades
      ['#ff9999', '#ffd699', '#ffff99', '#d6ff99', '#99ff99', '#99ffd6', '#99ffff', '#99d6ff', '#9999ff', '#d699ff'],
      
      // Row 4: Medium shades
      ['#ff6666', '#ffc266', '#ffff66', '#c2ff66', '#66ff66', '#66ffc2', '#66ffff', '#66c2ff', '#6666ff', '#c266ff'],
      
      // Row 5: Darker shades
      ['#cc0000', '#cc6600', '#cccc00', '#66cc00', '#00cc00', '#00cc66', '#00cccc', '#0066cc', '#0000cc', '#6600cc'],
      
      // Row 6: Darkest shades
      ['#990000', '#994c00', '#999900', '#4c9900', '#009900', '#00994c', '#009999', '#004c99', '#000099', '#4c0099'],
      
      // Row 7: Grayscale - Black to White (moved to bottom)
      ['#000000', '#222222', '#444444', '#666666', '#888888', '#aaaaaa', '#cccccc', '#dddddd', '#eeeeee', '#ffffff'],
    ];

    // Color conversion utilities
    const hsvToRgb = (h: number, s: number, v: number): RGB => {
      s = s / 100;
      v = v / 100;
      
      const c = v * s;
      const x = c * (1 - Math.abs((h / 60) % 2 - 1));
      const m = v - c;
      
      let r = 0, g = 0, b = 0;
      
      if (h >= 0 && h < 60) {
        r = c; g = x; b = 0;
      } else if (h >= 60 && h < 120) {
        r = x; g = c; b = 0;
      } else if (h >= 120 && h < 180) {
        r = 0; g = c; b = x;
      } else if (h >= 180 && h < 240) {
        r = 0; g = x; b = c;
      } else if (h >= 240 && h < 300) {
        r = x; g = 0; b = c;
      } else if (h >= 300 && h < 360) {
        r = c; g = 0; b = x;
      }
      
      return {
        r: Math.round((r + m) * 255),
        g: Math.round((g + m) * 255),
        b: Math.round((b + m) * 255)
      };
    };
    
    const rgbToHex = (r: number, g: number, b: number): string => {
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    };
    
    const hexToRgb = (hex: string): RGB | null => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : null;
    };
    
    const rgbToHsv = (r: number, g: number, b: number): HSV => {
      r /= 255;
      g /= 255;
      b /= 255;
      
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const diff = max - min;
      
      let h = 0;
      
      if (diff === 0) {
        h = 0;
      } else if (max === r) {
        h = 60 * (((g - b) / diff) % 6);
      } else if (max === g) {
        h = 60 * ((b - r) / diff + 2);
      } else if (max === b) {
        h = 60 * ((r - g) / diff + 4);
      }
      
      // Normalize hue to positive value
      if (h < 0) h += 360;
      
      const s = max === 0 ? 0 : diff / max;
      const v = max;
      
      return {
        h: Math.round(h),
        s: Math.round(s * 100),
        v: Math.round(v * 100)
      };
    };
    
    // Update color from HSV values
    const updateColorFromHsv = (newHsv: HSV) => {
      const rgb = hsvToRgb(newHsv.h, newHsv.s, newHsv.v);
      const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
      setCustomColor(hex);
      setHsv(newHsv);
      updateColorIndicatorPosition(newHsv);
    };
    
    // Update indicator positions based on HSV
    const updateColorIndicatorPosition = (newHsv: HSV) => {
      if (gradientRef.current && colorIndicatorRef.current) {
        const rect = gradientRef.current.getBoundingClientRect();
        const x = (newHsv.s / 100) * rect.width;
        const y = ((100 - newHsv.v) / 100) * rect.height;
        
        colorIndicatorRef.current.style.left = `${x}px`;
        colorIndicatorRef.current.style.top = `${y}px`;
      }
      
      if (hueSliderRef.current && hueIndicatorRef.current) {
        const rect = hueSliderRef.current.getBoundingClientRect();
        const x = (newHsv.h / 360) * rect.width;
        
        hueIndicatorRef.current.style.left = `${x}px`;
      }
    };
    
    // Handle color selection in gradient
    const handleSaturationValueChange = (clientX: number, clientY: number) => {
      if (!gradientRef.current) return;
      
      const rect = gradientRef.current.getBoundingClientRect();
      
      // Constrain position within the gradient area
      let x = Math.max(0, Math.min(rect.width, clientX - rect.left));
      let y = Math.max(0, Math.min(rect.height, clientY - rect.top));
      
      // Calculate saturation and value from position
      const s = Math.round((x / rect.width) * 100);
      const v = Math.round((1 - y / rect.height) * 100);
      
      // Update HSV with new saturation and value, keeping current hue
      updateColorFromHsv({ h: hsv.h, s, v });
    };
    
    // Handle hue selection in slider
    const handleHueChange = (clientX: number) => {
      if (!hueSliderRef.current) return;
      
      const rect = hueSliderRef.current.getBoundingClientRect();
      
      // Constrain position within the slider area
      let x = Math.max(0, Math.min(rect.width, clientX - rect.left));
      
      // Calculate hue from position
      const h = Math.round((x / rect.width) * 360);
      
      // Update HSV with new hue, keeping current saturation and value
      updateColorFromHsv({ h, s: hsv.s, v: hsv.v });
    };
    
    // Event handlers for mouse interactions
    const handleGradientClick = (e: React.MouseEvent<HTMLDivElement>) => {
      handleSaturationValueChange(e.clientX, e.clientY);
    };
    
    const handleHueClick = (e: React.MouseEvent<HTMLDivElement>) => {
      handleHueChange(e.clientX);
    };
    
    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(true);
      handleSaturationValueChange(e.clientX, e.clientY);
    };
    
    const handleHueMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDraggingHue(true);
      handleHueChange(e.clientX);
    };
    
    // Handle mouse events for dragging
    useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
        if (isDragging) {
          handleSaturationValueChange(e.clientX, e.clientY);
        } else if (isDraggingHue) {
          handleHueChange(e.clientX);
        }
      };
      
      const handleMouseUp = () => {
        setIsDragging(false);
        setIsDraggingHue(false);
      };
      
      if (isDragging || isDraggingHue) {
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      }
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }, [isDragging, isDraggingHue]);
    
    // Initialize HSV when custom color changes
    useEffect(() => {
      if (showCustom) {
        const rgb = hexToRgb(customColor);
        if (rgb) {
          const newHsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
          setHsv(newHsv);
          updateColorIndicatorPosition(newHsv);
        }
      }
    }, [showCustom, customColor]);
    
    // Handle manual input changes
    const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      // Allow only valid hex characters
      const value = e.target.value.replace(/[^0-9A-Fa-f]/g, '');
      if (value.length <= 6) {
        const hex = `#${value.padStart(6, '0')}`;
        setCustomColor(hex);
        
        const rgb = hexToRgb(hex);
        if (rgb) {
          const newHsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
          setHsv(newHsv);
        }
      }
    };

    const handleRGBChange = (component: 'r' | 'g' | 'b', value: string) => {
      const numValue = Math.min(255, Math.max(0, parseInt(value || '0', 10)));
      
      // Parse current RGB
      const rgb = hexToRgb(customColor) || { r: 0, g: 0, b: 0 };
      
      // Update the specific component
      const newRgb = {
        r: component === 'r' ? numValue : rgb.r,
        g: component === 'g' ? numValue : rgb.g,
        b: component === 'b' ? numValue : rgb.b
      };
      
      // Convert back to hex
      const hex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
      setCustomColor(hex);
      
      // Update HSV
      const newHsv = rgbToHsv(newRgb.r, newRgb.g, newRgb.b);
      setHsv(newHsv);
    };

    const handleSelectColor = (color: string) => {
      // First update the internal state
      setSelectedColor(color);
      
      // Then call the parent callback
      onSelectColor(color);
      
      // Auto-close after delay
      setTimeout(() => {
        setOpen(false);
      }, 300);
    };

    const handleCustomAccept = () => {
      handleSelectColor(customColor);
      setShowCustom(false);
    };

    const handleCustomCancel = () => {
      setShowCustom(false);
    };

    return (
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Toggle 
            ref={ref}
            aria-label={label}
            className={`relative ${className}`}
          >
            {triggerIcon}
            {(selectedColor || initialColor) && (
              <div 
                className="absolute bottom-1 left-1/2 w-5 h-1 rounded-sm transform -translate-x-1/2" 
                style={{ 
                  backgroundColor: selectedColor || initialColor,
                  // For transparent colors, show a checkerboard pattern or light border
                  boxShadow: (selectedColor || initialColor) === 'transparent' ? 'inset 0 0 0 1px rgba(0,0,0,0.2)' : 'none',
                }} 
              />
            )}
          </Toggle>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="start">
          {!showCustom ? (
            <div className="flex flex-col gap-2">
              {/* Transparent option - only show if showTransparentOption is true */}
              {showTransparentOption && (
                <div className="flex mb-1">
                  <button
                    className="w-6 h-6 rounded-md border border-gray-300 cursor-pointer 
                             hover:scale-110 transition-transform flex items-center justify-center"
                    style={{ 
                      backgroundImage: 'linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc)',
                      backgroundSize: '6px 6px',
                      backgroundPosition: '0 0, 3px 3px'
                    }}
                    onClick={() => handleSelectColor('transparent')}
                    aria-label="Transparent"
                  >
                    {(selectedColor === 'transparent' || (!selectedColor && initialColor === 'transparent')) && 
                      <Check className="h-3 w-3 text-black drop-shadow-sm" />
                    }
                  </button>
                  <span className="ml-2 text-xs text-muted-foreground self-center">Transparent</span>
                </div>
              )}
              
              {/* Recent colors - only show if there are recent colors */}
              {recentColors.length > 0 && (
                <div className="mb-2">
                  <div className="text-xs text-muted-foreground mb-1.5">Recent</div>
                  <div className="flex gap-1">
                    {recentColors.map((color, index) => (
                      <button
                        key={`recent-${index}-${color}`}
                        className="w-6 h-6 rounded-md border border-gray-200 cursor-pointer 
                                hover:scale-110 transition-transform flex items-center justify-center"
                        style={{ backgroundColor: color }}
                        onClick={() => handleSelectColor(color)}
                        aria-label={`Recent color: ${color}`}
                      >
                        {selectedColor === color && <Check className="h-3 w-3 text-white drop-shadow-sm" />}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 border-t border-gray-200 dark:border-gray-700"></div>
                </div>
              )}
              
              {/* Color grid */}
              <div className="grid grid-flow-row gap-1">
                {colorPalette.map((row, rowIdx) => (
                  <div key={`row-${rowIdx}`} className="flex gap-1">
                    {row.map((color, colIdx) => (
                      <button
                        key={`color-${rowIdx}-${colIdx}`}
                        className="w-6 h-6 rounded-md border border-gray-200 cursor-pointer 
                                 hover:scale-110 transition-transform flex items-center justify-center"
                        style={{ backgroundColor: color }}
                        onClick={() => handleSelectColor(color)}
                        aria-label={`Color: ${color}`}
                      >
                        {selectedColor === color && <Check className="h-3 w-3 text-white drop-shadow-sm" />}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
              
              {/* Custom color button */}
              <button
                className="w-full text-sm font-medium mt-2 py-1 rounded-md border border-gray-300
                        hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                onClick={handleShowCustom}
              >
                Custom
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3" style={{ width: '280px' }}>
              {/* Title */}
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-medium">Custom color</h3>
              </div>
              
              {/* Saturation/Value gradient picker */}
              <div 
                ref={gradientRef}
                className="h-36 w-full rounded-md cursor-crosshair relative shadow-sm border border-gray-200"
                style={{ 
                  background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h}, 100%, 50%))`,
                }}
                onClick={handleGradientClick}
                onMouseDown={handleMouseDown}
              >
                <div 
                  ref={colorIndicatorRef}
                  className="absolute h-4 w-4 rounded-full border-2 border-white shadow-sm -translate-x-1/2 -translate-y-1/2 cursor-move"
                  style={{ 
                    backgroundColor: customColor,
                    top: '0px',
                    left: '0px'
                  }}
                />
              </div>

              {/* Hue slider */}
              <div className="flex items-center gap-2">
                <div 
                  ref={hueSliderRef}
                  className="h-8 flex-1 rounded-md cursor-pointer relative shadow-sm border border-gray-200"
                  style={{ 
                    background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
                  }}
                  onClick={handleHueClick}
                  onMouseDown={handleHueMouseDown}
                >
                  <div 
                    ref={hueIndicatorRef}
                    className="absolute top-0 bottom-0 w-1 -translate-x-1/2 cursor-move"
                    style={{ 
                      left: '0px',
                      background: 'white',
                      borderLeft: '1px solid rgba(0,0,0,0.2)',
                      borderRight: '1px solid rgba(0,0,0,0.2)'
                    }}
                  />
                </div>
              </div>
              
              {/* Color preview and inputs */}
              <div className="flex flex-col gap-3 mt-1">
                {/* Hex input with preview circle */}
                <div className="mb-1">
                  <label className="text-xs text-muted-foreground mb-1 block">Hex</label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">#</span>
                    <Input 
                      value={customColor.replace('#', '')} 
                      onChange={handleHexChange} 
                      className="pl-6 pr-12 h-8 text-sm font-mono w-full"
                    />
                    <div 
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full border border-gray-200 flex-shrink-0 shadow-sm"
                      style={{ backgroundColor: customColor }}
                    />
                  </div>
                </div>
                
                {/* RGB inputs */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">R</label>
                    <Input 
                      type="number" 
                      min="0" 
                      max="255" 
                      value={hexToRgb(customColor)?.r || 0}
                      onChange={(e) => handleRGBChange('r', e.target.value)}
                      className="h-8 text-sm w-full"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">G</label>
                    <Input 
                      type="number" 
                      min="0" 
                      max="255" 
                      value={hexToRgb(customColor)?.g || 0}
                      onChange={(e) => handleRGBChange('g', e.target.value)}
                      className="h-8 text-sm w-full"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">B</label>
                    <Input 
                      type="number" 
                      min="0" 
                      max="255" 
                      value={hexToRgb(customColor)?.b || 0}
                      onChange={(e) => handleRGBChange('b', e.target.value)}
                      className="h-8 text-sm w-full"
                    />
                  </div>
                </div>
              </div>
              
              {/* Action buttons */}
              <div className="flex justify-end gap-2 mt-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleCustomCancel}
                >
                  Cancel
                </Button>
                <Button 
                  variant="default" 
                  size="sm"
                  onClick={handleCustomAccept}
                >
                  OK
                </Button>
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>
    );
  }
);

export default ColorPicker; 