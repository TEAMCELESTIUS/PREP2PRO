const func = async () => {
  const response = await window.versions.ping()
  console.log(response) // prints out 'pong'
}

func()

document.addEventListener('DOMContentLoaded', async () => {
    const dropZone = document.getElementById('drop-zone');
    const videoElement = document.getElementById('main-video');
    const importBtn = document.getElementById('import-btn');
    const removeBtn = document.getElementById('remove-video');
    const videoWrapper = document.querySelector('.video-wrapper');

    // Supported video formats
    const supportedFormats = [
        'video/mp4',
        'video/quicktime',  // MOV
        'video/x-msvideo',  // AVI
        'video/avi',        // Alternative AVI MIME
        'video/divx',       // DIVX (AVI variant)
        'video/x-divx',     // Alternative DIVX MIME
        'video/xvid',       // XVID (AVI variant)
        'video/x-xvid',     // Alternative XVID MIME
        'video/x-ms-wmv',   // WMV
        'video/x-matroska', // MKV
        'video/x-flv',      // FLV
        'video/webm',
        'video/mpeg',
        'video/3gpp',
        'video/x-m4v'
    ];

    let hasError = false; // Track error state

    const videoControls = {
        playPauseBtn: document.getElementById('play-pause'),
        volumeBtn: document.getElementById('volume-btn'),
        volumeSlider: document.getElementById('volume'),
        fullscreenBtn: document.getElementById('fullscreen'),
        progressBar: document.getElementById('progress'),
        progressContainer: document.querySelector('.progress-bar'),
        currentTime: document.getElementById('current-time'),
        duration: document.getElementById('duration')
    };

    // Handle drag and drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');

        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            if (isValidVideoFile(files[0])) {
                handleVideoFile(files[0]);
            } else {
                alert('Please select a valid video file format (MP4, MOV, AVI, WMV, MKV, FLV, etc.)');
                resetVideoDisplay();
            }
        }
    });

    // Handle import button click
    importBtn.addEventListener('click', async () => {
        if (hasError) return;
        
        try {
            importBtn.disabled = true; // Disable button while dialog is open
            const filePath = await window.electronAPI.handleFileOpen();
            
            if (filePath) {
                handleVideoFile(filePath);
            }
        } catch (error) {
            console.error('Error selecting file:', error);
            alert('Error selecting file. Please try again.');
        } finally {
            importBtn.disabled = false; // Re-enable button
        }
    });

    // Add remove video handler
    removeBtn.addEventListener('click', () => {
        resetVideoDisplay();
    });

    function isValidVideoFile(file) {
        // Check if it's a File object (from drag and drop)
        if (file instanceof File) {
            return supportedFormats.includes(file.type) || 
                   /\.(mp4|mov|avi|divx|xvid|wmv|mkv|flv|webm|mpeg|mpg|3gp|m4v)$/i.test(file.name);
        }
        // Check if it's a file path (from dialog)
        return /\.(mp4|mov|avi|divx|xvid|wmv|mkv|flv|webm|mpeg|mpg|3gp|m4v)$/i.test(file);
    }

    // Update the loadSavedState function to be more reliable
    async function loadSavedState() {
        try {
            const savedState = await window.electronAPI.loadState();
            if (savedState && savedState.videoPath) {
                // Check if file exists and is accessible
                try {
                    const response = await fetch('file://' + savedState.videoPath);
                    if (!response.ok) throw new Error('File not accessible');
                    
                    // Load the video
                    handleVideoFile(savedState.videoPath);
                    
                    // Wait for video to load
                    await new Promise((resolve, reject) => {
                        const timeoutId = setTimeout(() => reject(new Error('Video load timeout')), 5000);
                        
                        videoElement.addEventListener('loadedmetadata', () => {
                            clearTimeout(timeoutId);
                            resolve();
                        }, { once: true });
                        
                        videoElement.addEventListener('error', () => {
                            clearTimeout(timeoutId);
                            reject(new Error('Video load failed'));
                        }, { once: true });
                    });

                    // Restore all saved settings
                    if (savedState.currentTime) {
                        videoElement.currentTime = Math.min(savedState.currentTime, videoElement.duration);
                    }
                    
                    if (typeof savedState.volume !== 'undefined') {
                        videoElement.volume = savedState.volume;
                        videoControls.volumeSlider.value = savedState.volume;
                    }
                    
                    if (savedState.muted) {
                        videoElement.muted = savedState.muted;
                        updateVolumeIcon(savedState.muted ? 0 : savedState.volume);
                    }

                    console.log('Restored video state:', {
                        path: savedState.videoPath,
                        time: savedState.currentTime,
                        volume: savedState.volume,
                        muted: savedState.muted
                    });
                } catch (error) {
                    console.warn('Could not restore last video:', error);
                    resetVideoDisplay();
                }
            }
        } catch (error) {
            console.error('Error loading saved state:', error);
        }
    }

    // Update saveCurrentState to be more comprehensive
    function saveCurrentState() {
        if (!videoElement.src) return; // Don't save if no video is loaded
        
        const state = {
            videoPath: videoElement.src.startsWith('file://') ? 
                decodeURI(videoElement.src.replace('file://', '')) : null,
            currentTime: videoElement.currentTime,
            duration: videoElement.duration,
            volume: videoElement.volume,
            muted: videoElement.muted,
            timestamp: Date.now() // Add timestamp for debugging
        };
        
        console.log('Saving state:', state);
        window.electronAPI.saveState(state);
    }

    // Add more frequent state saving for better reliability
    function setupStateSaving() {
        // Save state every 2 seconds while playing
        setInterval(() => {
            if (!videoElement.paused) {
                saveCurrentState();
            }
        }, 2000);

        // Save on various video events
        videoElement.addEventListener('pause', saveCurrentState);
        videoElement.addEventListener('volumechange', saveCurrentState);
        videoElement.addEventListener('seeked', saveCurrentState);
        
        // Save when closing
        window.addEventListener('beforeunload', (e) => {
            saveCurrentState();
        });
    }

    // Update handleVideoFile to work better with state restoration
    function handleVideoFile(file) {
        hasError = false;
        videoElement.onerror = null;
        
        const videoUrl = file instanceof File ? URL.createObjectURL(file) : file;
        
        videoElement.onerror = (e) => {
            console.error('Video error:', e);
            if (!hasError) {
                hasError = true;
                alert('Error: Unable to load video file. Please check if the format is supported.');
                resetVideoDisplay();
            }
        };

        videoElement.onloadeddata = () => {
            console.log('Video loaded successfully');
            hasError = false;
            saveCurrentState(); // Save state immediately after successful load
        };

        try {
            videoElement.src = videoUrl;
            videoWrapper.style.display = 'block';
            dropZone.style.display = 'none';
        } catch (error) {
            console.error('Error handling video file:', error);
            resetVideoDisplay();
        }
    }

    function resetVideoDisplay() {
        videoElement.onerror = null;
        videoElement.pause();
        videoElement.currentTime = 0;
        videoElement.src = '';
        videoElement.load();
        
        // Reset volume to default
        videoElement.volume = 1;
        videoElement.muted = false;
        videoControls.volumeSlider.value = 1;
        updateVolumeIcon(1);
        
        videoWrapper.style.display = 'none';
        dropZone.style.display = 'flex';
        
        // Reset play button
        videoControls.playPauseBtn.querySelector('svg').innerHTML = ICONS.play;
        
        hasError = false;
    }

    // Update the icon changes in the event listeners
    const ICONS = {
        play: '<path d="M8 5v14l11-7z"/>',
        pause: '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>',
        volumeUp: '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>',
        volumeDown: '<path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/>',
        volumeOff: '<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>',
        fullscreenEnter: '<path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>',
        fullscreenExit: '<path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>'
    };

    // Update the play/pause button click handler
    videoControls.playPauseBtn.addEventListener('click', () => {
        if (videoElement.paused) {
            videoElement.play();
            videoControls.playPauseBtn.querySelector('svg').innerHTML = ICONS.pause;
        } else {
            videoElement.pause();
            videoControls.playPauseBtn.querySelector('svg').innerHTML = ICONS.play;
        }
    });

    // Update the volume button click handler
    videoControls.volumeBtn.addEventListener('click', () => {
        const newMuted = !videoElement.muted;
        videoElement.muted = newMuted;
        
        if (newMuted) {
            videoControls.volumeSlider.setAttribute('data-previous-volume', videoControls.volumeSlider.value);
            videoControls.volumeSlider.value = 0;
            videoControls.volumeBtn.querySelector('svg').innerHTML = ICONS.volumeOff;
        } else {
            const previousVolume = videoControls.volumeSlider.getAttribute('data-previous-volume') || 1;
            videoControls.volumeSlider.value = previousVolume;
            videoElement.volume = previousVolume;
            updateVolumeIcon(previousVolume);
        }
    });

    // Update the fullscreen button click handler
    videoControls.fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            videoWrapper.requestFullscreen();
            videoControls.fullscreenBtn.querySelector('svg').innerHTML = ICONS.fullscreenExit;
        } else {
            document.exitFullscreen();
            videoControls.fullscreenBtn.querySelector('svg').innerHTML = ICONS.fullscreenEnter;
        }
    });

    // Progress bar
    videoElement.addEventListener('timeupdate', () => {
        if (!isNaN(videoElement.duration)) {
            const progress = (videoElement.currentTime / videoElement.duration) * 100;
            videoControls.progressBar.style.width = `${progress}%`;
            videoControls.currentTime.textContent = formatTime(videoElement.currentTime);
            videoControls.duration.textContent = formatTime(videoElement.duration);
        }
    });

    videoElement.addEventListener('loadedmetadata', () => {
        videoControls.duration.textContent = formatTime(videoElement.duration);
    });

    videoControls.progressContainer.addEventListener('click', (e) => {
        const rect = videoControls.progressContainer.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        videoElement.currentTime = pos * videoElement.duration;
    });

    // Update the volume icon function
    function updateVolumeIcon(value) {
        const icon = videoControls.volumeBtn.querySelector('svg');
        if (value == 0) {
            icon.innerHTML = ICONS.volumeOff;
        } else if (value < 0.5) {
            icon.innerHTML = ICONS.volumeDown;
        } else {
            icon.innerHTML = ICONS.volumeUp;
        }
    }

    // Volume control
    videoControls.volumeSlider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        videoElement.volume = value;
        videoElement.muted = (value === 0);
        updateVolumeIcon(value);
    });

    // Handle video end
    videoElement.addEventListener('ended', () => {
        videoElement.currentTime = 0; // Reset to start
        videoControls.playPauseBtn.querySelector('svg').innerHTML = ICONS.play;
        videoElement.pause();
    });

    // Initialize with reset display and set initial volume
    resetVideoDisplay();
    videoElement.volume = 1;
    videoControls.volumeSlider.value = 1;
    updateVolumeIcon(1);

    // Add these debug logs to help track volume issues
    videoElement.addEventListener('volumechange', () => {
        console.log('Volume changed:', {
            volume: videoElement.volume,
            muted: videoElement.muted,
            sliderValue: videoControls.volumeSlider.value
        });
    });

    // Add this function near the other utility functions
    function formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '0:00';
        
        const minutes = Math.floor(seconds / 60);
        seconds = Math.floor(seconds % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    setupStateSaving(); // Setup state saving
    await loadSavedState(); // Load saved state
});