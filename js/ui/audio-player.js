/**
 * Audio Player class for music file playback
 * Handles playback of audio files and integration with the effect pipeline
 * This is the main entry point that coordinates between specialized modules
 */
import { PlaybackManager } from './audio-player/playback-manager.js';
import { AudioPlayerUI } from './audio-player/audio-player-ui.js';
import { AudioContextManager } from './audio-player/audio-context-manager.js';
import { StateManager } from './audio-player/state-manager.js';

export class AudioPlayer {
  constructor(audioManager) {
    this.audioManager = audioManager;
    this.audioContext = audioManager.audioContext;
    this.audioElement = null;
    
    // Initialize centralized state manager first
    this.stateManager = new StateManager(this);
    
    // Initialize sub-modules with state manager reference
    this.playbackManager = new PlaybackManager(this);
    this.ui = new AudioPlayerUI(this);
    this.contextManager = new AudioContextManager(this, audioManager);
    
    // Set up state manager listeners
    this.setupStateManagerListeners();
    
    // Load saved player state
    this.playbackManager.loadPlayerState().then(() => {
      if (this.ui.container) {
        this.ui.updatePlayerUIState();
      }
    });
  }
  
  /**
   * Enhanced loadFiles with seamless playback support
   * @param {(string[]|File[])} files - Array of file paths or File objects to load
   * @param {boolean} append - Whether to append to existing playlist or replace it
   */
  async loadFiles(files, append = false) {
    this.playbackManager.loadFiles(files, append);
    if (!this.ui.container) {
      this.ui.createPlayerUI();
    }
    await this.loadTrack(this.stateManager.getCurrentTrackIndex());
    await this.play();
  }
  
  /**
   * Enhanced loadTrack with unified state management
   * @param {number} index - Index of the track to load
   */
  async loadTrack(index) {
    const track = this.playbackManager.getTrack(index);
    if (track) {
      // UNIFIED STATE: Use context manager's loadTrack method
      await this.contextManager.loadTrack(track);
    }
  }
  
  /**
   * Play the current track
   */
  async play() {
    await this.playbackManager.play();
  }
  
  /**
   * Pause the current track
   */
  pause() {
    this.playbackManager.pause();
  }
  
  /**
   * Toggle between play and pause
   */
  async togglePlayPause() {
    await this.playbackManager.togglePlayPause();
  }
  
  /**
   * Stop playback and reset position
   */
  async stop() {
    await this.playbackManager.stop();
  }
  
  /**
   * Play the previous track
   */
  async playPrevious() {
    this.playbackManager.playPrevious();
  }
  
  /**
   * Play the next track
   * @param {boolean} userInitiated - Whether this was initiated by user action (default: true)
   */
  async playNext(userInitiated = true) {
    this.playbackManager.playNext(userInitiated);
  }
  
  /**
   * Fast forward the current track by 10 seconds
   */
  fastForward() {
    this.playbackManager.fastForward();
  }
  
  /**
   * Rewind the current track by 10 seconds
   */
  rewind() {
    this.playbackManager.rewind();
  }
  
  /**
   * Set up state manager listeners for UI updates
   * Note: Most UI updates are now handled automatically by AudioPlayerUI's state monitoring
   */
  setupStateManagerListeners() {
    // Listen for UI state changes that require special handling
    this.stateManager.addListener('seekBarEnabled', (enabled) => {
      if (this.ui && this.ui.seekBar) {
        this.ui.seekBar.disabled = !enabled;
      }
    });
    
    this.stateManager.addListener('controlsEnabled', (enabled) => {
      if (this.ui) {
        const controls = [
          this.ui.playPauseButton,
          this.ui.stopButton,
          this.ui.prevButton,
          this.ui.nextButton,
          this.ui.repeatButton,
          this.ui.shuffleButton
        ];
        
        controls.forEach(control => {
          if (control) {
            control.disabled = !enabled;
          }
        });
      }
    });
  }
  
  /**
   * NEW: Enhanced close method with proper cleanup
   */
  close() {
    console.log('[AudioPlayer] Closing audio player');
    
    // Save player state
    this.playbackManager.savePlayerState();
    
    // Disconnect audio context
    this.contextManager.disconnect();
    this.contextManager.clearNextTrackBuffer();
    
    // Remove UI
    this.ui.removeUI();
    
    // Clear playback manager
    this.playbackManager.clear();
    
    // Clear state manager
    this.stateManager.clearStateHistory();
    
    // Clean up references
    this.audioElement = null;
    if (window.uiManager) {
      window.uiManager.audioPlayer = null;
    }
    
    console.log('[AudioPlayer] Audio player closed');
  }
  
  /**
   * Get debug information
   * @returns {Object} Debug info
   */
  getDebugInfo() {
    return {
      stateManager: this.stateManager.getDebugInfo(),
      playbackManager: {
        currentTrackIndex: this.stateManager.getCurrentTrackIndex(),
        playlistLength: this.playbackManager.playlist.length,
        state: this.stateManager.getStateSnapshot()
      },
      contextManager: {
        currentPlaybackMode: this.contextManager.currentPlaybackMode,
        isUsingBufferPlayback: this.contextManager.isUsingBufferPlayback(),
        hasNextTrackBuffer: !!this.contextManager.nextTrackBuffer,
        isTransitioning: this.contextManager.isTransitioning
      }
    };
  }
}