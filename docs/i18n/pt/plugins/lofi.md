# Plugins Lo-Fi

Uma coleção de plugins que adicionam caráter vintage e qualidades nostálgicas à sua música. Esses efeitos podem fazer a música digital moderna soar como se estivesse sendo reproduzida em equipamentos clássicos ou dar aquele popular som "lo-fi" que é relaxante e atmosférico.

## Lista de Plugins

- [Bit Crusher](#bit-crusher) - Cria sons de jogos retrô e digitais vintage
- [Digital Error Emulator](#digital-error-emulator) - Simula vários erros de transmissão de áudio digital
- [Noise Blender](#noise-blender) - Adiciona textura atmosférica de fundo
- [Simple Jitter](#simple-jitter) - Cria imperfeições digitais vintage sutis

## Bit Crusher

Um efeito que recria o som de dispositivos digitais vintage como consoles de jogos antigos e primeiros sampleadores. Perfeito para adicionar caráter retrô ou criar uma atmosfera lo-fi.

### Guia de Caráter Sonoro
- Estilo Jogos Retrô:
  - Cria sons clássicos de console 8-bit
  - Perfeito para nostalgia de música de videogame
  - Adiciona textura pixelada ao som
- Estilo Lo-Fi Hip Hop:
  - Cria aquele som relaxante de study-beats
  - Degradação digital quente e suave
  - Perfeito para audição em segundo plano
- Efeitos Criativos:
  - Crie sons únicos estilo glitch
  - Transforme música moderna em versões retrô
  - Adicione caráter digital a qualquer música

### Parâmetros
- **Bit Depth** - Controla quão "digital" o som se torna (4 a 24 bits)
  - 4-6 bits: Som extremo de jogos retrô
  - 8 bits: Digital vintage clássico
  - 12-16 bits: Caráter lo-fi sutil
  - Valores mais altos: Efeito muito suave
- **TPDF Dither** - Torna o efeito mais suave
  - On: Som mais suave e musical
  - Off: Efeito mais cru e agressivo
- **ZOH Frequency** - Afeta a clareza geral (4000Hz a 96000Hz)
  - Valores mais baixos: Mais retrô, menos claro
  - Valores mais altos: Efeito mais claro e sutil
- **Bit Error** - Adiciona caráter de hardware vintage (0.00% a 10.00%)
  - 0-1%: Calor vintage sutil
  - 1-3%: Imperfeições clássicas de hardware
  - 3-10%: Caráter lo-fi criativo
- **Random Seed** - Controla a unicidade das imperfeições (0 a 1000)
  - Valores diferentes criam diferentes "personalidades" vintage
  - O mesmo valor sempre reproduz o mesmo caráter
  - Perfeito para encontrar e salvar seu som vintage favorito

## Digital Error Emulator

Um efeito que simula o som de vários erros de transmissão de áudio digital, desde glitches sutis de interface profissional até imperfeições de tocadores de CD vintage. Perfeito para adicionar caráter digital vintage ou criar experiências de audição únicas que lembram equipamentos de áudio digital clássicos.

### Guia de Caráter Sonoro
- Glitches de Interface Digital Profissional:
  - Simula artefatos de transmissão S/PDIF, AES3 e MADI
  - Adiciona o caráter de equipamentos profissionais envelhecidos
  - Perfeito para som de estúdio vintage
- Dropouts Digitais de Consumo:
  - Recria o comportamento de correção de erro de tocadores de CD clássicos
  - Simula glitches de interface de áudio USB
  - Ideal para nostalgia de música digital dos anos 90/2000
- Artefatos de Streaming e Áudio Sem Fio:
  - Simula erros de transmissão Bluetooth
  - Dropouts e artefatos de streaming de rede
  - Imperfeições da vida digital moderna
- Texturas Digitais Criativas:
  - Interferência RF e erros de transmissão sem fio
  - Efeitos de corrupção de áudio HDMI/DisplayPort
  - Possibilidades sonoras experimentais únicas

### Parâmetros
- **Bit Error Rate** - Controla a frequência de ocorrência de erros (10^-12 a 10^-2)
  - Muito Raro (10^-10 a 10^-8): Artefatos sutis ocasionais
  - Ocasional (10^-8 a 10^-6): Comportamento clássico de equipamentos de consumo
  - Frequente (10^-6 a 10^-4): Caráter vintage perceptível
  - Extremo (10^-4 a 10^-2): Efeitos experimentais criativos
  - Padrão: 10^-6 (equipamento de consumo típico)
- **Mode** - Seleciona o tipo de transmissão digital a simular
  - AES3/S-PDIF: Erros de bit de interface profissional com retenção de amostra
  - ADAT/TDIF/MADI: Erros de rajada multicanal (retenção ou silêncio)
  - HDMI/DP: Corrupção de linha de áudio de display ou silenciamento
  - USB/FireWire/Thunderbolt: Dropouts de microframe com interpolação
  - Dante/AES67/AVB: Perda de pacotes de áudio de rede (64/128/256 amostras)
  - Bluetooth A2DP/LE: Erros de transmissão sem fio com ocultação
  - WiSA: Erros de blocos FEC de alto-falantes sem fio
  - RF Systems: Silenciamento de radiofrequência e interferência
  - CD Audio: Simulação de correção de erro CIRC
  - Padrão: CD Audio (mais familiar aos ouvintes de música)
- **Reference Fs (kHz)** - Define a taxa de amostragem de referência para cálculos de timing
  - Taxas disponíveis: 44.1, 48, 88.2, 96, 176.4, 192 kHz
  - Afeta a precisão do timing para modos de áudio de rede
  - Padrão: 48 kHz
- **Wet Mix** - Controla a mistura entre áudio original e processado (0-100%)
  - Nota: Para simulação realista de erro digital, manter em 100%
  - Valores mais baixos criam erros "parciais" irreais que não ocorrem em sistemas digitais reais
  - Padrão: 100% (comportamento autêntico de erro digital)

### Detalhes dos Modos

**Interfaces Profissionais:**
- AES3/S-PDIF: Erros de amostra única com retenção da amostra anterior
- ADAT/TDIF/MADI: Erros de rajada de 32 amostras - reter últimas amostras boas ou silenciar
- HDMI/DisplayPort: Corrupção de linha de 192 amostras com erros em nível de bit ou silenciamento completo

**Áudio de Computador:**
- USB/FireWire/Thunderbolt: Dropouts de microframe com ocultação por interpolação
- Áudio de Rede (Dante/AES67/AVB): Perda de pacotes com diferentes opções de tamanho e ocultação

**Sem Fio de Consumo:**
- Bluetooth A2DP: Erros de transmissão pós-codec com artefatos de vibração e decaimento
- Bluetooth LE: Ocultação aprimorada com filtragem de alta frequência e ruído
- WiSA: Silenciamento de blocos FEC de alto-falantes sem fio

**Sistemas Especializados:**
- RF Systems: Eventos de silenciamento de comprimento variável simulando interferência de rádio
- CD Audio: Simulação de correção de erro CIRC com comportamento estilo Reed-Solomon

### Configurações Recomendadas para Diferentes Estilos

1. Caráter Sutil de Equipamento Profissional
   - Modo: AES3/S-PDIF, BER: 10^-8, Fs: 48kHz, Wet: 100%
   - Perfeito para: Adicionar envelhecimento sutil de equipamento profissional

2. Experiência Clássica de Tocador de CD
   - Modo: CD Audio, BER: 10^-7, Fs: 44.1kHz, Wet: 100%
   - Perfeito para: Nostalgia de música digital dos anos 90

3. Glitches de Streaming Moderno
   - Modo: Dante/AES67 (128 samp), BER: 10^-6, Fs: 48kHz, Wet: 100%
   - Perfeito para: Imperfeições da vida digital contemporânea

4. Experiência de Audição Bluetooth
   - Modo: Bluetooth A2DP, BER: 10^-6, Fs: 48kHz, Wet: 100%
   - Perfeito para: Memórias de áudio sem fio

5. Efeitos Experimentais Criativos
   - Modo: RF Systems, BER: 10^-5, Fs: 48kHz, Wet: 100%
   - Perfeito para: Sons experimentais únicos

Nota: Todas as recomendações usam 100% de Wet Mix para comportamento realista de erro digital. Valores de mix úmido mais baixos podem ser usados para efeitos criativos, mas não representam como erros digitais reais realmente ocorrem.

## Noise Blender

Um efeito que adiciona textura atmosférica de fundo à sua música, semelhante ao som de discos de vinil ou equipamentos vintage. Perfeito para criar atmosferas aconchegantes e nostálgicas.

### Guia de Caráter Sonoro
- Som de Equipamento Vintage:
  - Recria o calor de equipamentos de áudio antigos
  - Adiciona "vida" sutil a gravações digitais
  - Cria uma sensação vintage autêntica
- Experiência de Disco de Vinil:
  - Adiciona aquela atmosfera clássica de toca-discos
  - Cria uma sensação aconchegante e familiar
  - Perfeito para audição noturna
- Textura Ambiente:
  - Adiciona fundo atmosférico
  - Cria profundidade e espaço
  - Torna a música digital mais orgânica

### Parâmetros
- **Noise Type** - Escolhe o caráter da textura de fundo
  - White: Textura mais brilhante e presente
  - Pink: Som mais quente e natural
- **Level** - Controla quão perceptível é o efeito (-96dB a 0dB)
  - Muito Sutil (-96dB a -72dB): Apenas uma sugestão
  - Suave (-72dB a -48dB): Textura perceptível
  - Forte (-48dB a -24dB): Caráter vintage dominante
- **Per Channel** - Cria um efeito mais espacial
  - On: Som mais amplo e imersivo
  - Off: Textura mais focada e centralizada

## Simple Jitter

Um efeito que adiciona variações sutis de tempo para criar aquele som digital vintage imperfeito. Pode fazer a música soar como se estivesse tocando em tocadores de CD antigos ou equipamentos digitais vintage.

### Guia de Caráter Sonoro
- Sensação Vintage Sutil:
  - Adiciona instabilidade suave como equipamentos antigos
  - Cria um som mais orgânico e menos perfeito
  - Perfeito para adicionar caráter sutilmente
- Som Clássico de CD Player:
  - Recria o som dos primeiros tocadores digitais
  - Adiciona caráter digital nostálgico
  - Ótimo para apreciação de música dos anos 90
- Efeitos Criativos:
  - Crie efeitos únicos de oscilação
  - Transforme sons modernos em vintage
  - Adicione caráter experimental

### Parâmetros
- **RMS Jitter** - Controla a quantidade de variação de tempo (1ps a 10ms)
  - Sutil (1-10ps): Caráter vintage suave
  - Médio (10-100ps): Sensação clássica de CD player
  - Forte (100ps-1ms): Efeitos criativos de oscilação

### Configurações Recomendadas para Diferentes Estilos

1. Lo-Fi Relaxante
   - Bit Crusher: 12 bits, dither on, erro de bit 1.5%, seed 42
   - Noise Blender: Pink noise, -60dB
   - Jitter: Leve (10ps)
   - Digital Error: CD Audio, BER 10^-8, Wet 25%
   - Perfeito para: Sessões de estudo, relaxamento

2. Jogos Retrô
   - Bit Crusher: 8 bits, dither off, erro de bit 3%, seed 888
   - Noise Blender: White noise, -72dB
   - Jitter: Nenhum
   - Digital Error: AES3/S-PDIF, BER 10^-7, Wet 100%
   - Perfeito para: Apreciação de música de videogame

3. Digital Vintage
   - Bit Crusher: 16 bits, erro de bit 0.8%, seed 123
   - Noise Blender: Pink noise, -66dB
   - Jitter: Médio (50ps)
   - Digital Error: CD Audio, BER 10^-7, Wet 100%
   - Perfeito para: Nostalgia dos anos 90

4. Lo-Fi Ambiente
   - Bit Crusher: 14 bits, dither on, erro de bit 2%, seed 456
   - Noise Blender: Pink noise, -54dB
   - Jitter: Leve (20ps)
   - Digital Error: Bluetooth A2DP, BER 10^-8, Wet 100%
   - Perfeito para: Atmosfera de fundo

5. Ambiente de Streaming Moderno
   - Bit Crusher: Desligado ou 24 bits
   - Noise Blender: Pink noise, -78dB
   - Jitter: Muito leve (5ps)
   - Digital Error: Dante/AES67 (64 samp), BER 10^-7, Wet 100%
   - Perfeito para: Imperfeições digitais contemporâneas

Lembre-se: Esses efeitos são feitos para adicionar caráter e nostalgia à sua música. Comece com configurações sutis e ajuste ao gosto!
