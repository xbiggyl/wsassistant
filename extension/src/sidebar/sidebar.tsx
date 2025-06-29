import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Mic, 
  MicOff, 
  Users, 
  Clock, 
  FileText, 
  Settings,
  Minimize2,
  Maximize2
} from 'lucide-react';
import type { 
  MeetingInfo, 
  TranscriptChunk, 
  Summary, 
  WSMessage 
} from '@shared';
import { createLogger, formatTime } from '@shared';
import './styles.css';

const log = createLogger('sidebar');

interface SidebarState {
  meetingInfo: MeetingInfo | null;
  transcript: TranscriptChunk[];
  summaries: Summary[];
  isRecording: boolean;
  isConnected: boolean;
  isMinimized: boolean;
  currentTime: number;
}

const Sidebar: React.FC = () => {
  const [state, setState] = useState<SidebarState>({
    meetingInfo: null,
    transcript: [],
    summaries: [],
    isRecording: false,
    isConnected: false,
    isMinimized: false,
    currentTime: 0
  });

  const summaryContainerRef = useRef<HTMLDivElement>(null);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    log('Sidebar initialized');
    
    // Listen for messages from content script
    const messageHandler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      
      const message = event.data;
      log('Received message:', message);
      
      handleMessage(message);
    };

    window.addEventListener('message', messageHandler);
    
    // Set up timer
    const timer = setInterval(() => {
      setState(prev => ({
        ...prev,
        currentTime: prev.currentTime + 1
      }));
    }, 1000);

    return () => {
      window.removeEventListener('message', messageHandler);
      clearInterval(timer);
    };
  }, []);

  const handleMessage = (message: any) => {
    switch (message.type) {
      case 'init':
        log(`Initializing sidebar for meeting: ${message.meetingId}`);
        break;
        
      case 'meeting_start':
        setState(prev => ({
          ...prev,
          meetingInfo: message.payload,
          isRecording: true,
          isConnected: true
        }));
        break;
        
      case 'transcript':
        setState(prev => ({
          ...prev,
          transcript: [...prev.transcript, message.payload]
        }));
        scrollToBottom(transcriptContainerRef);
        break;
        
      case 'summary':
        setState(prev => ({
          ...prev,
          summaries: [...prev.summaries, message.payload]
        }));
        scrollToBottom(summaryContainerRef);
        break;
        
      case 'status':
        setState(prev => ({
          ...prev,
          isRecording: message.payload.recording,
          isConnected: message.payload.connected
        }));
        break;
    }
  };

  const scrollToBottom = (ref: React.RefObject<HTMLDivElement>) => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  };

  const toggleMinimize = () => {
    setState(prev => ({ ...prev, isMinimized: !prev.isMinimized }));
  };

  if (state.isMinimized) {
    return (
      <div className="h-full bg-white border-l border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${state.isRecording ? 'bg-red-500' : 'bg-gray-400'}`}></div>
            <span className="text-sm font-medium text-gray-700">MeetAssist</span>
          </div>
          <button
            onClick={toggleMinimize}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <Maximize2 size={16} />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <Clock size={24} className="mx-auto mb-2 opacity-50" />
            <div className="text-sm">{formatTime(state.currentTime)}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-white border-l border-gray-200 flex flex-col animate-fade-in">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
              <Mic size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-gray-900">MeetAssist</h1>
              <div className="flex items-center space-x-1 text-xs text-gray-500">
                <div className={`w-1.5 h-1.5 rounded-full ${state.isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span>{state.isConnected ? 'Connected' : 'Disconnected'}</span>
              </div>
            </div>
          </div>
          <button
            onClick={toggleMinimize}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
          >
            <Minimize2 size={16} />
          </button>
        </div>
        
        {state.meetingInfo && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">Meeting</span>
              <span className="text-xs font-medium text-gray-900 truncate max-w-48">
                {state.meetingInfo.title}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">Duration</span>
              <span className="text-xs font-mono text-gray-900">
                {formatTime(state.currentTime)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">Participants</span>
              <div className="flex items-center space-x-1">
                <Users size={12} />
                <span className="text-xs font-medium text-gray-900">
                  {state.meetingInfo.participants.length}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recording Status */}
      <div className={`px-4 py-2 border-b border-gray-100 ${state.isRecording ? 'bg-red-50' : 'bg-gray-50'}`}>
        <div className="flex items-center space-x-2">
          {state.isRecording ? (
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-xs font-medium text-red-700">Recording & Transcribing</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <MicOff size={12} className="text-gray-400" />
              <span className="text-xs text-gray-600">Not Recording</span>
            </div>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {/* Summaries Section */}
        <div className="h-1/2 border-b border-gray-100">
          <div className="p-3 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center space-x-2">
              <FileText size={14} className="text-gray-600" />
              <h2 className="text-sm font-medium text-gray-900">Live Summary</h2>
              <span className="text-xs text-gray-500">
                ({state.summaries.length} updates)
              </span>
            </div>
          </div>
          
          <div 
            ref={summaryContainerRef}
            className="h-full overflow-y-auto p-3 space-y-3"
          >
            {state.summaries.length === 0 ? (
              <div className="text-center text-gray-500 text-xs py-8">
                <FileText size={24} className="mx-auto mb-2 opacity-50" />
                <p>Summaries will appear here as the meeting progresses</p>
              </div>
            ) : (
              state.summaries.map((summary) => (
                <div key={summary.id} className="animate-slide-up">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-700">
                      {formatTime(summary.startTime)} - {formatTime(summary.endTime)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(summary.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="bg-blue-50 rounded-md p-2">
                    <ul className="space-y-1">
                      {summary.bullets.map((bullet, index) => (
                        <li key={index} className="text-xs text-gray-700 flex items-start">
                          <span className="text-blue-500 mr-2 mt-0.5">•</span>
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {summary.keyPoints.length > 0 && (
                    <div className="mt-2">
                      <div className="text-xs font-medium text-gray-600 mb-1">Key Points:</div>
                      <div className="flex flex-wrap gap-1">
                        {summary.keyPoints.map((point, index) => (
                          <span 
                            key={index}
                            className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded"
                          >
                            {point}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Transcript Section */}
        <div className="h-1/2">
          <div className="p-3 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center space-x-2">
              <Mic size={14} className="text-gray-600" />
              <h2 className="text-sm font-medium text-gray-900">Live Transcript</h2>
              <span className="text-xs text-gray-500">
                ({state.transcript.length} segments)  
              </span>
            </div>
          </div>
          
          <div 
            ref={transcriptContainerRef}
            className="h-full overflow-y-auto p-3 space-y-2"
          >
            {state.transcript.length === 0 ? (
              <div className="text-center text-gray-500 text-xs py-8">
                <Mic size={24} className="mx-auto mb-2 opacity-50" />
                <p>Transcript will appear here once speech is detected</p>
              </div>
            ) : (
              state.transcript.map((chunk) => (
                <div key={chunk.id} className="animate-slide-up">
                  <div className="flex items-start space-x-2">
                    <div className="flex-shrink-0">
                      <span className="text-xs text-gray-500 font-mono">
                        {formatTime(chunk.startTime)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-1 mb-1">
                        <span className="text-xs font-medium text-gray-700 truncate">
                          {chunk.speakerName}
                        </span>
                        {chunk.confidence && (
                          <span className="text-xs text-gray-400">
                            ({Math.round(chunk.confidence * 100)}%)
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-800 leading-relaxed">
                        {chunk.text}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-100 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500">
            MeetAssist v1.0 - Privacy First
          </div>
          <button className="p-1 hover:bg-gray-200 rounded transition-colors">
            <Settings size={14} className="text-gray-600" />
          </button>
        </div>
      </div>
    </div>
  );
};

// Initialize React app
const container = document.getElementById('sidebar-root');
if (container) {
  const root = createRoot(container);
  root.render(<Sidebar />);
}

export default Sidebar;