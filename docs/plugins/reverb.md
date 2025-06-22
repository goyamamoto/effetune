# Reverb Plugins

A collection of plugins that add space and atmosphere to your music. These effects can make your music sound like it's being played in different environments, from intimate rooms to grand concert halls, enhancing your listening experience with natural ambience and depth.

## Plugin List

- [FDN Reverb](#fdn-reverb) - Feedback Delay Network reverb with advanced diffusion matrix
- [RS Reverb](#rs-reverb) - Creates natural room ambience and space

## FDN Reverb

A sophisticated reverb effect based on Feedback Delay Network (FDN) architecture using a Hadamard diffusion matrix. This creates rich, complex reverberation with excellent density and natural decay characteristics, perfect for enhancing your music listening experience with immersive spatial effects.
The algorithm now performs processing in the frequency domain for significantly better performance on modest hardware.

### Listening Experience Guide
- Natural Room Feel:
  - Creates the sensation of listening in real acoustic spaces
  - Adds depth and dimension to your music
  - Makes stereo recordings feel more spacious and alive
- Atmospheric Enhancement:
  - Transforms flat recordings into immersive experiences
  - Adds beautiful tail and sustain to musical notes
  - Creates a sense of being in the performance space
- Customizable Ambience:
  - Adjustable from intimate rooms to grand concert halls
  - Fine control over the character and color of the space
  - Gentle modulation adds natural movement and life

### Parameters
- **Reverb Time** - How long the reverb effect lasts (0.20 to 10.00 s)
  - Short (0.2-1.0s): Quick, controlled decay for clarity
  - Medium (1.0-3.0s): Natural room-like reverberation
  - Long (3.0-10.0s): Expansive, atmospheric tails
- **Density** - Number of echo paths for complexity (4 to 8 lines)
  - 4 lines: Simpler, more defined individual echoes
  - 6 lines: Good balance of complexity and clarity
  - 8 lines: Maximum smoothness and density
- **Pre Delay** - Initial silence before reverb begins (0.0 to 100.0 ms)
  - 0-20ms: Immediate reverb, intimate feeling
  - 20-50ms: Natural sense of room distance
  - 50-100ms: Creates impression of larger spaces
- **Base Delay** - Foundation timing for the reverb network (10.0 to 60.0 ms)
  - Lower values: Tighter, more focused reverb character
  - Higher values: More spacious, open sound quality
  - Affects the fundamental timing relationships
- **Delay Spread** - How much delay times vary between lines (0.0 to 25.0 ms)
  - Implementation: Each delay line gets progressively longer using a power curve (0.8 exponent)
  - 0.0ms: All lines have same base timing (more regular patterns)
  - Higher values: More natural, irregular reflection patterns
  - Adds realistic variation found in real acoustic spaces
- **HF Damp** - How high frequencies fade over time (0.0 to 12.0 dB/s)
  - 0.0: No damping, bright sound throughout decay
  - 3.0-6.0: Natural air absorption simulation
  - 12.0: Heavy damping for warm, mellow character
- **Low Cut** - Removes low frequencies from reverb (20 to 500 Hz)
  - 20-50Hz: Full bass response in reverb
  - 100-200Hz: Controlled bass to avoid muddiness
  - 300-500Hz: Tight, clear low end
- **Mod Depth** - Amount of pitch modulation for chorus effect (0.0 to 10.0 cents)
  - 0.0: No modulation, pure static reverb
  - 2.0-5.0: Subtle movement that adds life and realism
  - 10.0: Noticeable chorus-like effect
- **Mod Rate** - Speed of the modulation (0.10 to 5.00 Hz)
  - 0.1-0.5Hz: Very slow, gentle movement
  - 1.0-2.0Hz: Natural-sounding variation
  - 3.0-5.0Hz: Fast, more obvious modulation
- **Diffusion** - How much the Hadamard matrix mixes signals (0 to 100%)
  - Implementation: Controls the amount of matrix mixing applied
  - 0%: Minimal mixing, more distinct echo patterns
  - 50%: Balanced diffusion for natural sound
  - 100%: Maximum mixing for smoothest density
- **Wet Mix** - Amount of reverb added to the sound (0 to 100%)
  - 10-30%: Subtle spatial enhancement
  - 30-60%: Noticeable reverb presence
  - 60-100%: Dominant reverb effect
- **Dry Mix** - Amount of original signal preserved (0 to 100%)
  - Usually kept at 100% for normal listening
  - Can be reduced for special atmospheric effects
- **Stereo Width** - How wide the reverb spreads in stereo (0 to 200%)
  - Implementation: 0% = mono, 100% = normal stereo, 200% = exaggerated width
  - 0%: Reverb appears in center (mono)
  - 100%: Natural stereo spread
  - 200%: Extra-wide stereo image

### Recommended Settings for Different Listening Experiences

1. Classical Music Enhancement
   - Reverb Time: 2.5-3.5s
   - Density: 8 lines
   - Pre Delay: 30-50ms
   - HF Damp: 4.0-6.0
   - Perfect for: Orchestral recordings, chamber music

2. Jazz Club Atmosphere
   - Reverb Time: 1.2-1.8s
   - Density: 6 lines
   - Pre Delay: 15-25ms
   - HF Damp: 2.0-4.0
   - Perfect for: Acoustic jazz, intimate performances

3. Pop/Rock Enhancement
   - Reverb Time: 1.0-2.0s
   - Density: 6-7 lines
   - Pre Delay: 10-30ms
   - Wet Mix: 20-40%
   - Perfect for: Modern recordings, adding space

4. Ambient Soundscapes
   - Reverb Time: 4.0-8.0s
   - Density: 8 lines
   - Mod Depth: 3.0-6.0
   - Wet Mix: 60-80%
   - Perfect for: Atmospheric music, relaxation

### Quick Start Guide

1. Set the Space Character
   - Start with Reverb Time to match your desired space size
   - Set Density to 6-8 for smooth, natural sound
   - Adjust Pre Delay to control distance perception

2. Shape the Tone
   - Use HF Damp to simulate natural air absorption
   - Set Low Cut to prevent bass buildup
   - Adjust Diffusion for smoothness (try 70-100%)

3. Add Natural Movement
   - Set Mod Depth to 2-4 cents for subtle life
   - Use Mod Rate around 0.3-1.0 Hz for gentle variation
   - Adjust Stereo Width for spatial impression

4. Balance the Effect
   - Start with 30% Wet Mix
   - Keep Dry Mix at 100% for normal listening
   - Fine-tune based on your music and preferences

The FDN Reverb transforms your listening experience by adding realistic acoustic spaces to any recording. Perfect for music lovers who want to enhance their favorite tracks with beautiful, natural-sounding reverberation!

## RS Reverb

An effect that can transport your music into different spaces, from cozy rooms to majestic halls. It adds natural echoes and reflections that make your music feel more three-dimensional and immersive.

### Listening Experience Guide
- Intimate Space:
  - Makes music feel like it's in a warm, cozy room
  - Perfect for up-close, personal listening
  - Adds subtle depth without losing clarity
- Concert Hall Experience:
  - Recreates the grandeur of live performances
  - Adds majestic space to classical and orchestral music
  - Creates an immersive concert experience
- Atmospheric Enhancement:
  - Adds dreamy, ethereal qualities
  - Perfect for ambient and atmospheric music
  - Creates engaging soundscapes

### Parameters
- **Pre-Delay** - Controls how quickly the space effect begins (0 to 50 ms)
  - Lower values: Immediate, intimate feeling
  - Higher values: More sense of distance
  - Start with 10ms for natural sound
- **Room Size** - Sets how large the space feels (2.0 to 50.0 m)
  - Small (2-5m): Cozy room feeling
  - Medium (5-15m): Live room atmosphere
  - Large (15-50m): Concert hall grandeur
- **Reverb Time** - How long the echoes last (0.1 to 10.0 s)
  - Short (0.1-1.0s): Clear, focused sound
  - Medium (1.0-3.0s): Natural room sound
  - Long (3.0-10.0s): Spacious, atmospheric
- **Density** - How rich the space feels (4 to 8)
  - Lower values: More defined echoes
  - Higher values: Smoother atmosphere
  - Start with 6 for natural sound
- **Diffusion** - How the sound spreads out (0.2 to 0.8)
  - Lower values: More distinct echoes
  - Higher values: Smoother blend
  - Try 0.5 for balanced sound
- **Damping** - How the echoes fade away (0 to 100%)
  - Lower values: Brighter, more open sound
  - Higher values: Warmer, more intimate
  - Start around 40% for natural feel
- **High Damp** - Controls brightness of the space (1000 to 20000 Hz)
  - Lower values: Darker, warmer space
  - Higher values: Brighter, more open
  - Start around 8000Hz for natural sound
- **Low Damp** - Controls fullness of the space (20 to 500 Hz)
  - Lower values: Fuller, richer sound
  - Higher values: Clearer, more controlled
  - Start around 100Hz for balanced bass
- **Mix** - Balances the effect with original sound (0 to 100%)
  - 10-30%: Subtle enhancement
  - 30-50%: Notable space
  - 50-100%: Dramatic effect

### Recommended Settings for Different Music Styles

1. Classical Music in Concert Hall
   - Room Size: 30-40m
   - Reverb Time: 2.0-2.5s
   - Mix: 30-40%
   - Perfect for: Orchestral works, piano concertos

2. Intimate Jazz Club
   - Room Size: 8-12m
   - Reverb Time: 1.0-1.5s
   - Mix: 20-30%
   - Perfect for: Jazz, acoustic performances

3. Modern Pop/Rock
   - Room Size: 15-20m
   - Reverb Time: 1.2-1.8s
   - Mix: 15-25%
   - Perfect for: Contemporary music

4. Ambient/Electronic
   - Room Size: 25-40m
   - Reverb Time: 3.0-6.0s
   - Mix: 40-60%
   - Perfect for: Atmospheric electronic music

### Quick Start Guide

1. Choose Your Space
   - Start with Room Size to set basic space
   - Adjust Reverb Time for desired atmosphere
   - Fine-tune Mix for proper balance

2. Shape the Sound
   - Use Damping to control warmth
   - Adjust High/Low Damp for tone
   - Set Density and Diffusion for texture

3. Fine-Tune the Effect
   - Add Pre-Delay for more depth
   - Adjust Mix for final balance
   - Trust your ears and adjust to taste

Remember: The goal is to enhance your music with natural space and atmosphere. Start with subtle settings and adjust until you find the perfect balance for your listening experience!
