# 3D Component Harvest Log
**Date**: 2026-06-18  
**Source**: KiCad packages3D (gitlab.com/kicad/libraries/kicad-packages3D)  
**License**: All models CC-BY-SA 4.0 (permissive for derivative use in education)

## Downloaded Models (10/10 targets)

### LED - 5mm Clear (3 variants by lead height)
- **File**: `LED_5mm_clear_tall.step` (48K)
  - Author: Jan Krieger
  - Tool: FreeCAD 0.16
  - Description: D5.0mm cylindrical, Horizontal, Z-lead offset 15.0mm
  - Use: Standard 5mm clear LED, tall leads
  
- **File**: `LED_5mm_clear_mid.step` (48K)
  - Author: Jan Krieger
  - Description: D5.0mm cylindrical, Horizontal, Z-lead offset 9.0mm
  - Use: Mid-height variant for breadboard mounting
  
- **File**: `LED_5mm_clear_short.step` (48K)
  - Author: Jan Krieger
  - Description: D5.0mm cylindrical, Horizontal, Z-lead offset 3.0mm
  - Use: Short leads for compact layouts

### Resistor - Axial Through-Hole
- **File**: `R_Axial_DIN0207_horizontal.step` (24K)
  - Author: grob6000, maurice, hyOzd (script generators)
  - Framework: KiCad cadquery script generator
  - Description: DIN0207 standard, L6.3mm, D2.5mm, P10.16mm
  - Color Bands: Present in geometry (FreeCAD rendering includes bands)
  - Tool: FreeCAD 0.16, CadQuery 1.0.0

### Push Button - 6mm Tactile (2 height variants)
- **File**: `Button_6mm_tactile.step` (176K)
  - Author: KiCad Community
  - Description: Standard 6mm tactile switch, default height
  - Use: Breadboard-friendly push button

- **File**: `Button_6mm_tactile_H5.step` (176K)
  - Author: KiCad Community
  - Description: 6mm tactile switch, H=5mm variant
  - Use: Lower-profile button option

### Potentiometer - Rotary THT
- **File**: `Potentiometer_Bourns_3006P.step` (84K)
  - Author: KiCad Community
  - Model: Bourns 3006P (professional industrial standard)
  - Description: Horizontal mounting, compact
  - Use: Rotary dial for analog input learning

### RGB LED (2 variants: SMD formats)
- **File**: `LED_RGB_5050_6pin.step` (184K)
  - Author: KiCad Community
  - Description: 5050 package, 6-pin (common cathode)
  - Note: SMD footprint, include for 3D learning model
  
- **File**: `LED_RGB_4pin_PLCC4.step` (123K)
  - Author: KiCad Community
  - Description: Wuerth PLCC4, compact 4-pin RGB (common cathode variant)
  - Note: Common anode/cathode versions available

### Piezo Buzzer
- **File**: `Buzzer_12x9.5_piezo.step` (20K)
  - Author: KiCad Community
  - Description: 12x9.5mm piezo element, RM7.6 lead spacing
  - Use: Audio feedback component for circuit tutorials

## Verification

✅ All 10 files downloaded successfully  
✅ All files > 0 bytes  
✅ All files valid STEP (ASCII text format)  
✅ License: CC-BY-SA 4.0 (KiCad libraries)  
✅ No authentication required (git clone worked)  

## For Three.js Integration

**Conversion Pipeline**:
1. STEP → GLB: Use Blender (File > Import .step) → Export GLB
2. OR: Use `three-step-loader` npm package for runtime loading
3. OR: Use `step-to-glb` conversion tool (local CLI)

**Material/Texture Notes**:
- LED models: Need semi-transparent plastic + light emission material
- Resistor: Geometry includes color bands (apply via texture map)
- Button: Black/gray plastic (matte material)
- Potentiometer: Metal knob (shiny) + plastic base
- RGB LED: Dual-color or clear plastic (transparency needed)
- Buzzer: Black plastic body + metal terminals

## Alternative Sources Identified

(Not yet downloaded — require login)
1. **Thingiverse**: Additional 5mm LED diffused + color variants
2. **Sketchfab**: High-detail models (6,500+ "electronics" models tagged)
3. **GrabCAD**: Professional CAD models (403 access blocked)
4. **Free3D**: Generic electronics (403 access blocked)

**Recommendation**: Current KiCad set is sufficient for MVP learning app. Can add diffused LEDs + colors if needed later.

## File Organization

```
/Users/family/jason/codegate/assets/3d/_harvest/passives/
├── led/
│   ├── LED_5mm_clear_tall.step
│   ├── LED_5mm_clear_mid.step
│   └── LED_5mm_clear_short.step
├── resistor/
│   └── R_Axial_DIN0207_horizontal.step
├── button/
│   ├── Button_6mm_tactile.step
│   └── Button_6mm_tactile_H5.step
├── potentiometer/
│   └── Potentiometer_Bourns_3006P.step
├── rgb-led/
│   ├── LED_RGB_5050_6pin.step
│   └── LED_RGB_4pin_PLCC4.step
└── buzzer/
    └── Buzzer_12x9.5_piezo.step
```

**Total**: 936K / 10 files  
**Format**: 100% STEP (ASCII readable, widely compatible)

---

**Status**: ✅ HARVEST COMPLETE — All target components retrieved with permissive CC-BY-SA 4.0 licensing.
