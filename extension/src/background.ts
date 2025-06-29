import { createLogger, extractMeetingId } from '@shared';
import type { MeetingInfo, ExtensionConfig } from '@shared';

const log = createLogger('background');

class BackgroundService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    log('Initializing background service');
    
    // Listen for tab updates to detect Meet calls
    chrome.tabs.onUpdated.addListener(this.handleTabUpdate.bind(this));
    
    // Listen for messages from content scripts
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
    
    // Connect to backend WebSocket
    this.connectToBackend();
  }

  private handleTabUpdate(
    tabId: number, 
    changeInfo: chrome.tabs.TabChangeInfo, 
    tab: chrome.tabs.Tab
  ): void {
    if (changeInfo.status === 'complete' && tab.url?.includes('meet.google.com')) {
      const meetingId = extractMeetingId(tab.url);
      if (meetingId) {
        log(`Detected Meet call: ${meetingId}`);
        this.injectSidebar(tabId, meetingId);
      }
    }
  }

  private async injectSidebar(tabId: number, meetingId: string): Promise<void> {
    try {
      // Inject sidebar into the Meet page
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (meetingId: string) => {
          // Check if sidebar already exists
          if (document.getElementById('meetassist-sidebar')) {
            return;
          }

          // Create sidebar iframe
          const sidebar = document.createElement('iframe');
          sidebar.id = 'meetassist-sidebar';
          sidebar.src = chrome.runtime.getURL('dist/sidebar.html');
          sidebar.style.cssText = `
            position: fixed;
            top: 0;
            right: 0;
            width: 380px;
            height: 100vh;
            border: none;
            z-index: 10000;
            background: white;
            box-shadow: -4px 0 12px rgba(0, 0, 0, 0.15);
            transition: transform 0.3s ease-in-out;
          `;
          
          document.body.appendChild(sidebar);
          
          // Post meeting ID to sidebar
          sidebar.onload = () => {
            sidebar.contentWindow?.postMessage({ 
              type: 'init', 
              meetingId 
            }, '*');
          };
        },
        args: [meetingId]
      });
      
      log(`Sidebar injected for meeting: ${meetingId}`);
    } catch (error) {
      log('Failed to inject sidebar:', error);
    }
  }

  private handleMessage(
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ): boolean {
    log('Received message:', message);
    
    switch (message.type) {
      case 'start_recording':
        this.startRecording(message.meetingInfo);
        break;
      case 'stop_recording':
        this.stopRecording(message.meetingId);
        break;
      case 'get_status':
        sendResponse({ connected: this.ws?.readyState === WebSocket.OPEN });
        break;
    }
    
    return true; // Keep message channel open for async response
  }

  private connectToBackend(): void {
    log('Connecting to backend WebSocket...');
    
    try {
      this.ws = new WebSocket('ws://localhost:3001/ws');
      
      this.ws.onopen = () => {
        log('Connected to backend');
        this.reconnectAttempts = 0;
      };
      
      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleBackendMessage(message);
        } catch (error) {
          log('Failed to parse backend message:', error);
        }
      };
      
      this.ws.onclose = () => {
        log('Backend connection closed');
        this.scheduleReconnect();
      };
      
      this.ws.onerror = (error) => {
        log('Backend connection error:', error);
      };
      
    } catch (error) {
      log('Failed to create WebSocket connection:', error);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
      log(`Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);
      
      setTimeout(() => {
        this.reconnectAttempts++;
        this.connectToBackend();
      }, delay);
    } else {
      log('Max reconnect attempts reached');
    }
  }

  private handleBackendMessage(message: any): void {
    log('Backend message:', message);
    
    // Forward relevant messages to content scripts
    chrome.tabs.query({ url: 'https://meet.google.com/*' }, (tabs) => {
      tabs.forEach(tab => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, message).catch(() => {
            // Ignore errors for inactive tabs
          });
        }
      });
    });
  }

  private async startRecording(meetingInfo: MeetingInfo): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'meeting_start',
        payload: meetingInfo
      }));
    }
  }

  private async stopRecording(meetingId: string): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'meeting_end',
        payload: { meetingId }
      }));
    }
  }
}

// Initialize the background service
new BackgroundService();