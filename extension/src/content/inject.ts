import { createLogger, generateId, extractMeetingId } from '@shared';
import type { MeetingInfo, Participant } from '@shared';

const log = createLogger('content');

console.log('Content script loaded!');

class MeetInjector {
  private meetingId: string | null = null;
  private meetingInfo: MeetingInfo | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private observer: MutationObserver | null = null;

  constructor() {
    console.log('MeetInjector constructor called');
    this.init();
  }

  private async init(): Promise<void> {
    console.log('MeetInjector init called');
    log('Initializing Meet injector');
    
    // Listen for runtime messages
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
    console.log('Content script listening for runtime messages');
    
    // Wait for page to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  private setup(): void {
    this.meetingId = extractMeetingId(window.location.href);
    if (!this.meetingId) {
      log('Not a valid Meet URL');
      return;
    }

    log(`Setting up for meeting: ${this.meetingId}`);
    
    // Monitor DOM changes to detect when meeting starts
    this.startMeetingObserver();
  }

  private startMeetingObserver(): void {
    this.observer = new MutationObserver((mutations) => {
      // Look for indicators that meeting has started
      const joinButton = document.querySelector('[data-call-ended="false"]');
      const participantCount = document.querySelector('[data-participant-count]');
      
      if (joinButton || participantCount) {
        this.onMeetingStart();
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-call-ended', 'data-participant-count']
    });
  }

  private async onMeetingStart(): Promise<void> {
    if (this.meetingInfo) return; // Already started
    
    log('Meeting started, gathering info...');
    
    const meetingTitle = this.extractMeetingTitle();
    const participants = this.extractParticipants();
    
    this.meetingInfo = {
      id: this.meetingId!,
      title: meetingTitle,
      startTime: new Date(),
      participants,
      language: 'EN' // Default, can be configured
    };

    log('Meeting info:', this.meetingInfo);
    
    // Notify background script
    chrome.runtime.sendMessage({
      type: 'start_recording',
      meetingInfo: this.meetingInfo
    });

    // Start capturing audio/video
    this.startCapture();
  }

  private extractMeetingTitle(): string {
    // Try various selectors for meeting title
    const selectors = [
      '[data-meeting-title]',
      '.u3bW4e', // Google Meet title class (may change)
      'title',
      'h1'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element?.textContent?.trim()) {
        return element.textContent.trim();
      }
    }

    return `Meeting ${this.meetingId}`;
  }

  private extractParticipants(): Participant[] {
    const participants: Participant[] = [];
    
    // Try to find participant elements
    const participantElements = document.querySelectorAll([
      '[data-participant-id]',
      '.ZjFb7c', // Participant name class (may change)
      '.KV1GEc' // Another potential participant class
    ].join(', '));

    participantElements.forEach((element, index) => {
      const name = element.textContent?.trim() || `Participant ${index + 1}`;
      const id = element.getAttribute('data-participant-id') || generateId();
      
      participants.push({
        id,
        name,
        isSelf: element.hasAttribute('data-self') || name.includes('You')
      });
    });

    // If no participants found, add a default entry
    if (participants.length === 0) {
      participants.push({
        id: generateId(),
        name: 'You',
        isSelf: true
      });
    }

    return participants;
  }

  private async startCapture(): Promise<void> {
    try {
      log('Starting media capture...');
      
      // Get display media (tab capture)
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { mediaSource: 'tab' },
        audio: true
      });

      // Set up MediaRecorder
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp8,opus'
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.sendChunkToBackend(event.data);
        }
      };

      this.mediaRecorder.start(5000); // 5-second chunks
      log('Media recording started');

      // Set up separate audio processing for higher quality transcription
      this.setupAudioProcessing(stream);

    } catch (error) {
      log('Failed to start capture:', error);
    }
  }

  private async setupAudioProcessing(stream: MediaStream): Promise<void> {
    try {
      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(stream);
      
      // Create script processor for audio chunks
      const processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      processor.onaudioprocess = (event) => {
        const inputBuffer = event.inputBuffer;
        const audioData = inputBuffer.getChannelData(0);
        
        // Convert to Int16Array for Whisper
        const int16Array = new Int16Array(audioData.length);
        for (let i = 0; i < audioData.length; i++) {
          int16Array[i] = Math.max(-1, Math.min(1, audioData[i])) * 0x7FFF;
        }
        
        this.sendAudioToBackend(int16Array.buffer);
      };

      source.connect(processor);
      processor.connect(this.audioContext.destination);
      
      log('Audio processing pipeline established');
    } catch (error) {
      log('Failed to setup audio processing:', error);
    }
  }

  private async sendChunkToBackend(blob: Blob): Promise<void> {
    if (!this.meetingInfo) return;

    const arrayBuffer = await blob.arrayBuffer();
    
    chrome.runtime.sendMessage({
      type: 'video_chunk',
      payload: {
        meetingId: this.meetingInfo.id,
        chunk: arrayBuffer,
        timestamp: Date.now()
      }
    });
  }

  private sendAudioToBackend(audioBuffer: ArrayBuffer): void {
    if (!this.meetingInfo) return;

    chrome.runtime.sendMessage({
      type: 'audio_chunk',
      payload: {
        meetingId: this.meetingInfo.id,
        chunk: audioBuffer,
        timestamp: Date.now()
      }
    });
  }

  private handleMessage(message: any): void {
    log('Received message:', message);
    console.log('Content script received message:', message);
    
    switch (message.type) {
      case 'transcript':
        console.log('Forwarding transcript message to sidebar');
        this.forwardToSidebar(message);
        break;
      case 'summary':
        console.log('Forwarding summary message to sidebar');
        this.forwardToSidebar(message);
        break;
      case 'status':
        console.log('Forwarding status message to sidebar:', message);
        this.forwardToSidebar(message);
        break;
      case 'error':
        log('Backend error:', message.payload);
        break;
    }
  }

  private forwardToSidebar(message: any): void {
    const sidebar = document.getElementById('meetassist-sidebar') as HTMLIFrameElement;
    if (sidebar?.contentWindow) {
      sidebar.contentWindow.postMessage(message, '*');
    }
  }

  // Cleanup on page unload
  private cleanup(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    
    if (this.audioContext) {
      this.audioContext.close();
    }
    
    if (this.observer) {
      this.observer.disconnect();
    }

    if (this.meetingInfo) {
      chrome.runtime.sendMessage({
        type: 'stop_recording',
        meetingId: this.meetingInfo.id
      });
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new MeetInjector());
} else {
  new MeetInjector();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  // Cleanup will be handled by the injector instance
});