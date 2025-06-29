import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Mic, 
  Settings, 
  FileText, 
  Users, 
  Shield,
  ExternalLink,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface PopupState {
  isConnected: boolean;
  activeMeeting: boolean;
  meetingCount: number;
  lastSync: Date | null;
}

const Popup: React.FC = () => {
  const [state, setState] = useState<PopupState>({
    isConnected: false,
    activeMeeting: false,
    meetingCount: 0,
    lastSync: null
  });

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'get_status' });
      setState(prev => ({
        ...prev,
        isConnected: response.connected
      }));
    } catch (error) {
      console.error('Failed to get status:', error);
    }
  };

  const openMeet = () => {
    chrome.tabs.create({ url: 'https://meet.google.com' });
    window.close();
  };

  const openSettings = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
    window.close();
  };

  const handleMessage = (message: any) => {
    console.log('Sidebar received message:', message); // Debug log
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

  return (
    <div className="h-full bg-white flex flex-col">
      {/* Header */}
      <div className="p-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
            <Mic size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">MeetAssist</h1>
            <p className="text-blue-100 text-sm">AI Meeting Assistant</p>
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="p-4 bg-gray-50 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${state.isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-700">
              {state.isConnected ? 'Backend Connected' : 'Backend Disconnected'}
            </span>
          </div>
          {state.isConnected ? (
            <CheckCircle size={16} className="text-green-500" />
          ) : (
            <AlertCircle size={16} className="text-red-500" />
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="flex items-center space-x-2">
              <FileText size={16} className="text-blue-600" />
              <div>
                <div className="text-xs text-blue-600">Meetings</div>
                <div className="text-lg font-semibold text-blue-900">
                  {state.meetingCount}
                </div>
              </div>
            </div>
          </div>
          <div className="bg-green-50 p-3 rounded-lg">
            <div className="flex items-center space-x-2">
              <Shield size={16} className="text-green-600" />
              <div>
                <div className="text-xs text-green-600">Privacy</div>
                <div className="text-sm font-semibold text-green-900">
                  100% Local
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex-1 p-4 space-y-3">
        <button
          onClick={openMeet}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors"
        >
          <ExternalLink size={16} />
          <span>Join Google Meet</span>
        </button>

        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-700">Features</h3>
          <div className="space-y-2 text-xs text-gray-600">
            <div className="flex items-center space-x-2">
              <CheckCircle size={12} className="text-green-500" />
              <span>Real-time transcription</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle size={12} className="text-green-500" />
              <span>Speaker identification</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle size={12} className="text-green-500" />
              <span>Live summaries</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle size={12} className="text-green-500" />
              <span>Meeting minutes export</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle size={12} className="text-green-500" />
              <span>100% offline processing</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500">
            v1.0.0 - Privacy First
          </div>
          <button
            onClick={openSettings}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
          >
            <Settings size={16} className="text-gray-600" />
          </button>
        </div>
      </div>
    </div>
  );
};

// Initialize React app
const container = document.getElementById('popup-root');
if (container) {
  const root = createRoot(container);
  root.render(<Popup />);
}

export default Popup;