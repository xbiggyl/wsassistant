import { createLogger, generateId } from '@meetassist/shared';
import type { TranscriptChunk, Summary } from '@meetassist/shared';
import OpenAI from 'openai';

const log = createLogger('summary');

type SummaryProvider = 'local' | 'openai';

export class SummaryService {
  private isInitialized = false;
  private provider: SummaryProvider;
  private openaiClient: OpenAI | null = null;
  private localModel: any = null;

  constructor() {
    this.provider = (process.env.SUMMARY_PROVIDER as SummaryProvider) || 'local';
  }

  async initialize(): Promise<void> {
    log(`Initializing summary service with provider: ${this.provider}`);
    
    try {
      if (this.provider === 'openai') {
        await this.initializeOpenAI();
      } else {
        await this.initializeLocalModel();
      }
      
      this.isInitialized = true;
      log(`Summary service initialized successfully with ${this.provider} provider`);
    } catch (error) {
      log('Failed to initialize summary service:', error);
      throw error;
    }
  }

  private async initializeOpenAI(): Promise<void> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required when using OpenAI provider');
    }

    this.openaiClient = new OpenAI({
      apiKey,
      baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
    });

    // Test the connection
    try {
      await this.openaiClient.models.list();
      log('OpenAI API connection verified');
    } catch (error) {
      log('Failed to verify OpenAI API connection:', error);
      throw new Error('Failed to connect to OpenAI API');
    }
  }

  private async initializeLocalModel(): Promise<void> {
    // In a real implementation, you'd initialize a local LLM here
    // This could be a lightweight model like gpt-4o-mini running locally
    // For now, we'll simulate the service
    log('Initializing local model...');
    
    // Placeholder for local model initialization
    // Example: this.localModel = await LocalLLM.load(process.env.LOCAL_MODEL_PATH);
    
    this.localModel = { initialized: true }; // Mock initialization
    log('Local model initialized');
  }

  async generateSummary(
    transcriptChunks: TranscriptChunk[],
    startTime: number,
    endTime: number
  ): Promise<Summary> {
    if (!this.isInitialized) {
      throw new Error('Summary service not initialized');
    }

    log(`Generating summary for ${transcriptChunks.length} transcript chunks using ${this.provider}`);

    try {
      if (this.provider === 'openai') {
        return await this.generateOpenAISummary(transcriptChunks, startTime, endTime);
      } else {
        return await this.generateLocalSummary(transcriptChunks, startTime, endTime);
      }
    } catch (error) {
      log('Failed to generate summary:', error);
      throw error;
    }
  }

  private async generateOpenAISummary(
    transcriptChunks: TranscriptChunk[],
    startTime: number,
    endTime: number
  ): Promise<Summary> {
    if (!this.openaiClient) {
      throw new Error('OpenAI client not initialized');
    }

    // Combine transcript text
    const fullText = transcriptChunks
      .map(chunk => `[${chunk.speakerName}]: ${chunk.text}`)
      .join('\n');

    const prompt = `
Please analyze this meeting transcript segment and provide a structured summary.

Transcript:
${fullText}

Please respond with a JSON object containing:
- "bullets": An array of 2-4 key bullet points summarizing the main discussion
- "keyPoints": An array of important keywords/topics mentioned (max 6 items)

Keep bullets concise but informative. Focus on decisions, action items, and key discussion points.

Example format:
{
  "bullets": [
    "Team discussed Q4 project timeline and identified potential delays",
    "Decided to implement new authentication system by end of month",
    "Marketing team requested additional resources for campaign launch"
  ],
  "keyPoints": ["Timeline", "Authentication", "Resources", "Campaign"]
}
`;

    try {
      const response = await this.openaiClient.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a professional meeting assistant that creates concise, accurate summaries of meeting discussions. Always respond with valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: parseInt(process.env.SUMMARY_MAX_TOKENS || '500'),
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response content from OpenAI');
      }

      const parsed = JSON.parse(content);
      
      const summary: Summary = {
        id: generateId(),
        startTime: Math.floor(startTime / 1000),
        endTime: Math.floor(endTime / 1000),
        bullets: parsed.bullets || [],
        keyPoints: parsed.keyPoints || [],
        timestamp: new Date()
      };

      log(`OpenAI summary generated with ${summary.bullets.length} bullets and ${summary.keyPoints.length} key points`);
      return summary;

    } catch (error) {
      log('OpenAI API error:', error);
      
      // Fallback to local generation if OpenAI fails
      log('Falling back to local summary generation');
      return await this.generateLocalSummary(transcriptChunks, startTime, endTime);
    }
  }

  private async generateLocalSummary(
    transcriptChunks: TranscriptChunk[],
    startTime: number,
    endTime: number
  ): Promise<Summary> {
    // Combine transcript text
    const fullText = transcriptChunks
      .map(chunk => `[${chunk.speakerName}]: ${chunk.text}`)
      .join('\n');

    // In a real implementation, this would use a local LLM
    // For now, we'll provide intelligent mock summaries based on content analysis
    const mockSummary = this.generateIntelligentMockSummary(fullText, transcriptChunks);

    const summary: Summary = {
      id: generateId(),
      startTime: Math.floor(startTime / 1000),
      endTime: Math.floor(endTime / 1000),
      bullets: mockSummary.bullets,
      keyPoints: mockSummary.keyPoints,
      timestamp: new Date()
    };

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    log(`Local summary generated with ${summary.bullets.length} bullets and ${summary.keyPoints.length} key points`);
    return summary;
  }

  private generateIntelligentMockSummary(fullText: string, chunks: TranscriptChunk[]): { bullets: string[], keyPoints: string[] } {
    // Simple keyword extraction and pattern matching for more realistic summaries
    const text = fullText.toLowerCase();
    const speakers = [...new Set(chunks.map(c => c.speakerName))];
    
    const bullets: string[] = [];
    const keyPoints: string[] = [];

    // Detect common meeting patterns and generate relevant bullets
    if (text.includes('project') || text.includes('timeline')) {
      bullets.push('Team discussed project timeline and upcoming milestones');
      keyPoints.push('Project', 'Timeline');
    }
    
    if (text.includes('decision') || text.includes('decide') || text.includes('agreed')) {
      bullets.push('Key decisions were made regarding implementation approach');
      keyPoints.push('Decisions');
    }
    
    if (text.includes('action') || text.includes('task') || text.includes('todo')) {
      bullets.push('Action items and task assignments were identified');
      keyPoints.push('Action Items');
    }
    
    if (text.includes('budget') || text.includes('cost') || text.includes('resource')) {
      bullets.push('Resource allocation and budget considerations discussed');
      keyPoints.push('Budget', 'Resources');
    }
    
    if (text.includes('technical') || text.includes('architecture') || text.includes('system')) {
      bullets.push('Technical architecture and system design reviewed');
      keyPoints.push('Architecture', 'Technical');
    }

    // Add speaker-based bullet if multiple speakers
    if (speakers.length > 1) {
      bullets.push(`Discussion involved ${speakers.length} participants with active collaboration`);
      keyPoints.push('Collaboration');
    }

    // Fallback bullets if no patterns matched
    if (bullets.length === 0) {
      bullets.push('Team meeting covered various topics and discussion points');
      bullets.push('Participants shared updates and insights on current initiatives');
    }

    // Ensure we have at least 2 bullets and some key points
    while (bullets.length < 2) {
      bullets.push('Additional discussion points and team coordination covered');
    }

    if (keyPoints.length === 0) {
      keyPoints.push('Discussion', 'Updates', 'Coordination');
    }

    return {
      bullets: bullets.slice(0, 4), // Max 4 bullets
      keyPoints: keyPoints.slice(0, 6) // Max 6 key points
    };
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  getProvider(): SummaryProvider {
    return this.provider;
  }

  async cleanup(): Promise<void> {
    log('Cleaning up summary service...');
    this.isInitialized = false;
    this.openaiClient = null;
    this.localModel = null;
  }
}

/*
Real local model implementation would look like this:

import { LLM } from 'local-llm'; // Hypothetical local LLM library

export class SummaryService {
  private localModel: any = null;

  private async initializeLocalModel(): Promise<void> {
    const modelPath = process.env.LOCAL_MODEL_PATH;
    const modelType = process.env.LOCAL_MODEL_TYPE || 'gguf';
    
    if (!modelPath) {
      throw new Error('LOCAL_MODEL_PATH is required when using local provider');
    }

    this.localModel = await LLM.load(modelPath, {
      type: modelType,
      contextSize: 4096,
      threads: 4
    });
  }

  private async generateLocalSummary(
    transcriptChunks: TranscriptChunk[],
    startTime: number,
    endTime: number
  ): Promise<Summary> {
    const fullText = transcriptChunks
      .map(chunk => `[${chunk.speakerName}]: ${chunk.text}`)
      .join('\n');

    const prompt = `
      Please analyze this meeting transcript segment and provide:
      1. 2-4 key bullet points summarizing the main discussion
      2. Important keywords/topics mentioned
      
      Transcript:
      ${fullText}
      
      Response format: JSON with bullets, keyPoints arrays
    `;

    const response = await this.localModel.generate(prompt, {
      maxTokens: parseInt(process.env.SUMMARY_MAX_TOKENS || '500'),
      temperature: 0.3,
      stopSequences: ['\n\n']
    });

    const parsed = JSON.parse(response);

    return {
      id: generateId(),
      startTime: Math.floor(startTime / 1000),
      endTime: Math.floor(endTime / 1000),
      bullets: parsed.bullets,
      keyPoints: parsed.keyPoints,
      timestamp: new Date()
    };
  }
}
*/