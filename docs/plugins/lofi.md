# Lo-Fi Audio Plugins

A collection of plugins that add vintage character and nostalgic qualities to your music. These effects can make modern digital music sound like it's being played through classic equipment or give it that popular "lo-fi" sound that's both relaxing and atmospheric.

## Plugin List

- [Bit Crusher](#bit-crusher) - Creates retro gaming and vintage digital sounds
- [Digital Error Emulator](#digital-error-emulator) - Simulates various digital audio transmission errors
- [Noise Blender](#noise-blender) - Adds atmospheric background texture
- [Simple Jitter](#simple-jitter) - Creates subtle vintage digital imperfections

## Bit Crusher

An effect that recreates the sound of vintage digital devices like old gaming consoles and early samplers. Perfect for adding retro character or creating a lo-fi atmosphere.

### Sound Character Guide
- Retro Gaming Style:
  - Creates classic 8-bit console sounds
  - Perfect for video game music nostalgia
  - Adds pixelated texture to the sound
- Lo-Fi Hip Hop Style:
  - Creates that relaxing, study-beats sound
  - Warm, gentle digital degradation
  - Perfect for background listening
- Creative Effects:
  - Create unique glitch-style sounds
  - Transform modern music into retro versions
  - Add digital character to any music

### Parameters
- **Bit Depth** - Controls how "digital" the sound becomes (4 to 24 bits)
  - 4-6 bits: Extreme retro gaming sound
  - 8 bits: Classic vintage digital
  - 12-16 bits: Subtle lo-fi character
  - Higher values: Very gentle effect
- **TPDF Dither** - Makes the effect sound smoother
  - On: Gentler, more musical sound
  - Off: Raw, more aggressive effect
- **ZOH Frequency** - Affects the overall clarity (4000Hz to 96000Hz)
  - Lower values: More retro, less clear
  - Higher values: Clearer, more subtle effect
- **Bit Error** - Adds vintage hardware character (0.00% to 10.00%)
  - 0-1%: Subtle vintage warmth
  - 1-3%: Classic hardware imperfections
  - 3-10%: Creative lo-fi character
- **Random Seed** - Controls the unique character of imperfections (0 to 1000)
  - Different values create different vintage "personalities"
  - Same value always creates the same character
  - Perfect for finding and saving your favorite vintage sound

## Digital Error Emulator

An effect that simulates the sound of various digital audio transmission errors, from subtle professional interface glitches to vintage CD player imperfections. Perfect for adding vintage digital character or creating unique listening experiences that remind you of classic digital audio equipment.

### Sound Character Guide
- Professional Digital Interface Glitches:
  - Simulates S/PDIF, AES3, and MADI transmission artifacts
  - Adds the character of aging professional gear
  - Perfect for vintage studio sound
- Consumer Digital Dropouts:
  - Recreates classic CD player error correction behavior
  - Simulates USB audio interface glitches
  - Great for 90s/2000s digital music nostalgia
- Streaming & Wireless Audio Artifacts:
  - Simulates Bluetooth transmission errors
  - Network streaming dropouts and artifacts
  - Modern digital life imperfections
- Creative Digital Textures:
  - RF interference and wireless transmission errors 
  - HDMI/DisplayPort audio corruption effects
  - Unique experimental sound possibilities

### Parameters
- **Bit Error Rate** - Controls how often errors occur (10^-12 to 10^-2) 
  - Very Rare (10^-10 to 10^-8): Subtle occasional artifacts
  - Occasional (10^-8 to 10^-6): Classic consumer equipment behavior
  - Frequent (10^-6 to 10^-4): Noticeable vintage character
  - Extreme (10^-4 to 10^-2): Creative experimental effects
  - Default: 10^-6 (typical consumer equipment)
- **Mode** - Selects the type of digital transmission to simulate
  - AES3/S-PDIF: Professional interface bit errors with sample hold
  - ADAT/TDIF/MADI: Multi-channel burst errors (hold or mute)
  - HDMI/DP: Display audio row corruption or muting
  - USB/FireWire/Thunderbolt: Micro-frame dropouts with interpolation
  - Dante/AES67/AVB: Network audio packet loss (64/128/256 samples)
  - Bluetooth A2DP/LE: Wireless transmission errors with concealment
  - WiSA: Wireless speaker FEC block errors
  - RF Systems: Radio frequency squelch and interference
  - CD Audio: CIRC error correction simulation
  - Default: CD Audio (most familiar to music listeners)
- **Reference Fs (kHz)** - Sets the reference sample rate for timing calculations
  - Available rates: 44.1, 48, 88.2, 96, 176.4, 192 kHz
  - Affects timing accuracy for network audio modes
  - Default: 48 kHz
- **Wet Mix** - Controls the blend between original and processed audio (0-100%)
  - Note: For realistic digital error simulation, keep at 100%
  - Lower values create unrealistic "partial" errors that don't occur in real digital systems
  - Default: 100% (authentic digital error behavior)

### Mode Details

**Professional Interfaces:**
- AES3/S-PDIF: Single-sample errors with previous sample hold 
- ADAT/TDIF/MADI: 32-sample burst errors - either hold last good samples or mute
- HDMI/DisplayPort: 192-sample row corruption with bit-level errors or complete muting

**Computer Audio:**
- USB/FireWire/Thunderbolt: Micro-frame dropouts with interpolation concealment
- Network Audio (Dante/AES67/AVB): Packet loss with different size options and concealment

**Consumer Wireless:**
- Bluetooth A2DP: Post-codec transmission errors with warble and decay artifacts
- Bluetooth LE: Enhanced concealment with high-frequency filtering and noise
- WiSA: Wireless speaker FEC block muting

**Specialized Systems:**
- RF Systems: Variable-length squelch events simulating radio interference
- CD Audio: CIRC error correction simulation with Reed-Solomon-style behavior

### Recommended Settings for Different Styles

1. Subtle Professional Gear Character
   - Mode: AES3/S-PDIF, BER: 10^-8, Fs: 48kHz, Wet: 100%
   - Perfect for: Adding subtle professional gear aging

2. Classic CD Player Experience
   - Mode: CD Audio, BER: 10^-7, Fs: 44.1kHz, Wet: 100%
   - Perfect for: 90s digital music nostalgia

3. Modern Streaming Glitches
   - Mode: Dante/AES67 (128 samp), BER: 10^-6, Fs: 48kHz, Wet: 100%
   - Perfect for: Contemporary digital life imperfections

4. Bluetooth Listening Experience
   - Mode: Bluetooth A2DP, BER: 10^-6, Fs: 48kHz, Wet: 100%
   - Perfect for: Wireless audio memories

5. Creative Experimental Effects
   - Mode: RF Systems, BER: 10^-5, Fs: 48kHz, Wet: 100%
   - Perfect for: Unique experimental sounds

Note: All recommendations use 100% Wet Mix for realistic digital error behavior. Lower wet mix values can be used for creative effects, but they don't represent how real digital errors actually occur.

## Noise Blender

An effect that adds atmospheric background texture to your music, similar to the sound of vinyl records or vintage equipment. Perfect for creating cozy, nostalgic atmospheres.

### Sound Character Guide
- Vintage Equipment Sound:
  - Recreates the warmth of old audio gear
  - Adds subtle "life" to digital recordings
  - Creates an authentic vintage feel
- Vinyl Record Experience:
  - Adds that classic record player atmosphere
  - Creates a cozy, familiar feeling
  - Perfect for late-night listening
- Ambient Texture:
  - Adds atmospheric background
  - Creates depth and space
  - Makes digital music feel more organic

### Parameters
- **Noise Type** - Chooses the character of the background texture
  - White: Brighter, more present texture
  - Pink: Warmer, more natural sound
- **Level** - Controls how noticeable the effect is (-96dB to 0dB)
  - Very Subtle (-96dB to -72dB): Just a hint
  - Gentle (-72dB to -48dB): Noticeable texture
  - Strong (-48dB to -24dB): Dominant vintage character
- **Per Channel** - Creates a more spacious effect
  - On: Wider, more immersive sound
  - Off: More focused, centered texture

## Simple Jitter

An effect that adds subtle timing variations to create that imperfect, vintage digital sound. It can make music sound like it's playing through old CD players or vintage digital equipment.

### Sound Character Guide
- Subtle Vintage Feel:
  - Adds gentle instability like old equipment
  - Creates a more organic, less perfect sound
  - Perfect for adding character subtly
- Classic CD Player Sound:
  - Recreates the sound of early digital players
  - Adds nostalgic digital character
  - Great for 90s music appreciation
- Creative Effects:
  - Create unique wobble effects
  - Transform modern sounds into vintage ones
  - Add experimental character

### Parameters
- **RMS Jitter** - Controls the amount of timing variation (1ps to 10ms)
  - Subtle (1-10ps): Gentle vintage character
  - Medium (10-100ps): Classic CD player feel
  - Strong (100ps-1ms): Creative wobble effects

### Recommended Settings for Different Styles

1. Relaxing Lo-Fi
   - Bit Crusher: 12 bits, dither on, bit error 1.5%, seed 42
   - Noise Blender: Pink noise, -60dB
   - Jitter: Light (10ps)
   - Digital Error: CD Audio, BER 10^-8, Wet 25%
   - Perfect for: Study sessions, relaxation

2. Retro Gaming
   - Bit Crusher: 8 bits, dither off, bit error 3%, seed 888
   - Noise Blender: White noise, -72dB
   - Jitter: None
   - Digital Error: AES3/S-PDIF, BER 10^-7, Wet 100%
   - Perfect for: Video game music appreciation

3. Vintage Digital
   - Bit Crusher: 16 bits, bit error 0.8%, seed 123
   - Noise Blender: Pink noise, -66dB
   - Jitter: Medium (50ps)
   - Digital Error: CD Audio, BER 10^-7, Wet 100%
   - Perfect for: 90s music nostalgia

4. Ambient Lo-Fi
   - Bit Crusher: 14 bits, dither on, bit error 2%, seed 456
   - Noise Blender: Pink noise, -54dB
   - Jitter: Light (20ps)
   - Digital Error: Bluetooth A2DP, BER 10^-8, Wet 100%
   - Perfect for: Background atmosphere

5. Modern Streaming Vibe
   - Bit Crusher: Off or 24 bits
   - Noise Blender: Pink noise, -78dB
   - Jitter: Very light (5ps)
   - Digital Error: Dante/AES67 (64 samp), BER 10^-7, Wet 100%
   - Perfect for: Contemporary digital imperfections

Remember: These effects are meant to add character and nostalgia to your music. Start with subtle settings and adjust to taste!
