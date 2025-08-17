/**
 * AudioPlayerUI - Handles player UI creation and management
 * Manages user input and display updates
 * UNIFIED STATE MANAGEMENT: UI automatically updates based on state changes
 */
export class AudioPlayerUI {
  constructor(audioPlayer) {
    this.audioPlayer = audioPlayer;
    this.container = null;
    this.trackNameDisplay = null;
    this.seekBar = null;
    this.timeDisplay = null;
    this.playPauseButton = null;
    this.stopButton = null;
    this.prevButton = null;
    this.nextButton = null;
    this.repeatButton = null;
    this.shuffleButton = null;
    this.closeButton = null;
    this.updateInterval = null;
    
    // State change listeners
    this.stateListeners = [];
    
    // Initialize state monitoring
    this.initStateMonitoring();
  }
  
  /**
   * Initialize state monitoring for automatic UI updates
   */
  initStateMonitoring() {
    if (!this.audioPlayer.stateManager) return;
    
    // Listen to all state changes
    this.audioPlayer.stateManager.addListener('*', (newValue, key, source) => {
      this.handleStateChange(key, newValue, source);
    });
    
    // Listen to specific state changes
    this.audioPlayer.stateManager.addListener('currentTrack', (track) => {
      this.updateTrackDisplay(track);
    });
    
    this.audioPlayer.stateManager.addListener('currentTrackPosition', (position) => {
      requestAnimationFrame(() => {
        this.updateTimeDisplay();
      });
    });
    
    this.audioPlayer.stateManager.addListener('currentTrackDuration', (duration) => {
      this.updateTimeDisplay();
    });
    
    this.audioPlayer.stateManager.addListener('isPlaying', (isPlaying) => {
      this.updatePlayPauseButton();
    });
    
    this.audioPlayer.stateManager.addListener('isPaused', (isPaused) => {
      this.updatePlayPauseButton();
    });
    
    this.audioPlayer.stateManager.addListener('isStopped', (isStopped) => {
      this.updateTimeDisplay();
      this.updatePlayPauseButton();
    });
  }
  
  /**
   * Handle state changes and update UI accordingly
   */
  handleStateChange(key, newValue, source) {
    // UI updates are handled by specific listeners
  }
  
  /**
   * Create the player UI
   */
  createPlayerUI() {
    // Create container
    const container = document.createElement('div');
    container.className = 'audio-player';
    
    // Set initial button image based on repeat mode
    let repeatButtonImg = 'repeat_button.png';
    const state = this.audioPlayer.stateManager?.getStateSnapshot();
    if (state?.repeatMode === 'ONE') {
      repeatButtonImg = 'repeat1_button.png';
    }
    
    container.innerHTML = `
     <h2>Player</h2>
     <div class="track-name-container">
       <div class="track-name">No track loaded</div>
     </div>
     <div class="player-controls">
        <input type="range" class="seek-bar" min="0" max="100" value="0" step="0.1">
        <div class="time-display">00:00</div>
        <button class="player-button play-pause-button" title="${window.uiManager ? window.uiManager.t('ui.title.playPause') : 'Play or pause'}"><img src="images/play_button.png" width="16" height="16"></button>
        <button class="player-button stop-button" title="${window.uiManager ? window.uiManager.t('ui.title.stop') : 'Stop'}"><img src="images/stop_button.png" width="16" height="16"></button>
        <button class="player-button prev-button" title="${window.uiManager ? window.uiManager.t('ui.title.prevTrack') : 'Previous track'}"><img src="images/previous_button.png" width="16" height="16"></button>
        <button class="player-button next-button" title="${window.uiManager ? window.uiManager.t('ui.title.nextTrack') : 'Next track'}"><img src="images/next_button.png" width="16" height="16"></button>
        <button class="player-button repeat-button" title="${window.uiManager ? window.uiManager.t('ui.title.repeat') : 'Toggle repeat mode'}"><img src="images/${repeatButtonImg}" width="16" height="16"></button>
        <button class="player-button shuffle-button" title="${window.uiManager ? window.uiManager.t('ui.title.shuffle') : 'Toggle shuffle'}"><img src="images/shuffle_button.png" width="16" height="16"></button>
        <button class="player-button close-button" title="${window.uiManager ? window.uiManager.t('ui.title.closePlayer') : 'Close player'}">✖</button>
      </div>
    `;

    // Store references to UI elements
    this.container = container;
    this.trackNameDisplay = container.querySelector('.track-name');
    this.seekBar = container.querySelector('.seek-bar');
    this.timeDisplay = container.querySelector('.time-display');
    this.playPauseButton = container.querySelector('.play-pause-button');
    this.stopButton = container.querySelector('.stop-button');
    this.prevButton = container.querySelector('.prev-button');
    this.nextButton = container.querySelector('.next-button');
    this.repeatButton = container.querySelector('.repeat-button');
    this.shuffleButton = container.querySelector('.shuffle-button');
    this.closeButton = container.querySelector('.close-button');

    // Add event listeners
    this.playPauseButton.addEventListener('click', () => {
      this.audioPlayer.togglePlayPause();
    });
    this.stopButton.addEventListener('click', () => this.audioPlayer.stop());
    this.prevButton.addEventListener('click', () => this.audioPlayer.playPrevious());
    this.nextButton.addEventListener('click', () => this.audioPlayer.playNext());
    this.closeButton.addEventListener('click', () => this.audioPlayer.close());
    
    // Add repeat button event listener
    this.repeatButton.addEventListener('click', () => this.audioPlayer.playbackManager.toggleRepeatMode());
    
    // Add shuffle button event listener
    this.shuffleButton.addEventListener('click', () => this.audioPlayer.playbackManager.toggleShuffleMode());
    
    // Update UI based on loaded state
    this.updatePlayerUIState();
    
    this.seekBar.addEventListener('input', () => {
      // Check if seeking is enabled
      if (this.audioPlayer.stateManager) {
        const state = this.audioPlayer.stateManager.getStateSnapshot();
        if (!state.seekBarEnabled) {
          return;
        }
      }
      
      // Handle seeking using unified state management
      if (this.audioPlayer.contextManager) {
        const state = this.audioPlayer.contextManager.getCurrentState();
        const duration = state.currentTrackDuration;
        if (duration > 0) {
          const seekTime = (this.seekBar.value / 100) * duration;
          if (isFinite(seekTime)) {
            this.audioPlayer.contextManager.seek(seekTime);
            this.updateTimeDisplay();
          }
        }
      } else if (this.audioPlayer.audioElement) {
        // Check if audio element has valid duration and is not paused
        if (this.audioPlayer.audioElement.duration && 
            isFinite(this.audioPlayer.audioElement.duration) && 
            !this.audioPlayer.audioElement.paused) {
          const seekTime = (this.seekBar.value / 100) * this.audioPlayer.audioElement.duration;
          if (isFinite(seekTime)) {
            this.audioPlayer.contextManager.handleSeek(seekTime, 'user');
            this.updateTimeDisplay();
          }
        }
      }
    });

    // Insert player into DOM
    const mainContainer = document.querySelector('.main-container');
    if (mainContainer) {
      // Insert player before main-container instead of inside it
      mainContainer.parentNode.insertBefore(container, mainContainer);
    }

    // Start update interval for time display
    this.startUpdateInterval();

    return container;
  }

  /**
   * Update player UI based on current state
   */
  updatePlayerUIState() {
    if (!this.repeatButton || !this.shuffleButton) return;
    
    // Get state from StateManager
    const state = this.audioPlayer.stateManager?.getStateSnapshot();
    const repeatMode = state?.repeatMode || 'OFF';
    const shuffleMode = state?.shuffleMode || false;
    
    // Update repeat button state
    switch (repeatMode) {
      case 'ALL':
        this.repeatButton.innerHTML = '<img src="images/repeat_button.png" width="16" height="16">';
        this.repeatButton.style.backgroundColor = '#4a9eff'; // Highlight button when active
        break;
      case 'ONE':
        this.repeatButton.innerHTML = '<img src="images/repeat1_button.png" width="16" height="16">';
        this.repeatButton.style.backgroundColor = '#4a9eff';
        
        // Disable shuffle button in ONE mode
        this.shuffleButton.disabled = true;
        this.shuffleButton.style.opacity = '0.5';
        break;
      case 'OFF':
      default:
        this.repeatButton.innerHTML = '<img src="images/repeat_button.png" width="16" height="16">';
        this.repeatButton.style.backgroundColor = ''; // Reset button color
        
        // Enable shuffle button
        this.shuffleButton.disabled = false;
        this.shuffleButton.style.opacity = '1';
        break;
    }
    
    // Update shuffle button state
    if (shuffleMode && repeatMode !== 'ONE') {
      this.shuffleButton.style.backgroundColor = '#4a9eff'; // Highlight button when active
    } else {
      this.shuffleButton.style.backgroundColor = ''; // Reset button color
    }
  }

  /**
   * Update play/pause button state
   */
  updatePlayPauseButton() {
    if (!this.playPauseButton) return;
    
    // Get state from StateManager (single source of truth)
    let isPlaying = false;
    
    if (this.audioPlayer.stateManager) {
      const state = this.audioPlayer.stateManager.getStateSnapshot();
      isPlaying = state.isPlaying;
    } else {
      console.warn('[AudioPlayerUI] StateManager not available for updatePlayPauseButton');
      return;
    }
    
    if (isPlaying) {
      this.playPauseButton.innerHTML = '<img src="images/pause_button.png" width="16" height="16">';
    } else {
      this.playPauseButton.innerHTML = '<img src="images/play_button.png" width="16" height="16">';
    }
  }

  /**
   * Update track display with track name
   */
  updateTrackDisplay(track = null) {
    if (!this.trackNameDisplay) return;
    
    // Get track from state if not provided
    if (!track && this.audioPlayer.stateManager) {
      const state = this.audioPlayer.stateManager.getStateSnapshot();
      track = state.currentTrack;
    }
    
    if (track && track.name) {
      this.trackNameDisplay.textContent = track.name;
    } else {
      this.trackNameDisplay.textContent = 'No track loaded';
    }
  }

  /**
   * Update time display and seek bar
   */
  updateTimeDisplay() {
    if (!this.timeDisplay || !this.seekBar) {
      console.warn('[AudioPlayerUI] Time display or seek bar not available');
      return;
    }
    
    let currentTime = 0;
    let duration = 0;
    
    // Get state from StateManager (single source of truth)
    if (this.audioPlayer.stateManager) {
      const state = this.audioPlayer.stateManager.getStateSnapshot();
      currentTime = state.currentTrackPosition || 0;
      duration = state.currentTrackDuration || 0;
    } else {
      console.warn('[AudioPlayerUI] StateManager not available for updateTimeDisplay');
      return;
    }
    
    // Ensure values are valid numbers
    currentTime = isFinite(currentTime) ? Math.max(0, currentTime) : 0;
    duration = isFinite(duration) ? Math.max(0, duration) : 0;
    
    // Format time display
    const timeText = `${this.formatTime(currentTime)} / ${this.formatTime(duration)}`;
    this.timeDisplay.textContent = timeText;
    
    // Update seek bar position
    if (duration > 0) {
      const seekValue = (currentTime / duration) * 100;
      if (isFinite(seekValue) && seekValue >= 0 && seekValue <= 100) {
        this.seekBar.value = seekValue;
      }
    } else {
      // Reset seek bar when no duration
      this.seekBar.value = 0;
    }
    
    // Force UI update by triggering a reflow
    this.seekBar.style.display = 'none';
    this.seekBar.offsetHeight; // Force reflow
    this.seekBar.style.display = '';
  }

  /**
   * Format time in seconds to MM:SS format
   */
  formatTime(time) {
    if (isNaN(time)) return '00:00';
    
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * Start interval for updating time display
   */
  startUpdateInterval() {
    // Clear any existing interval
    this.stopUpdateInterval();
    
    // Update every 250ms
    this.updateInterval = setInterval(() => {
      this.updateTimeDisplay();
    }, 250);
  }

  /**
   * Stop time display update interval
   */
  stopUpdateInterval() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Remove player UI from DOM
   */
  removeUI() {
    this.stopUpdateInterval();
    
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    
    this.container = null;
    this.trackNameDisplay = null;
    this.seekBar = null;
    this.timeDisplay = null;
    this.playPauseButton = null;
    this.stopButton = null;
    this.prevButton = null;
    this.nextButton = null;
    this.repeatButton = null;
    this.shuffleButton = null;
    this.closeButton = null;
  }
}