/**
 * Chat API Service
 * Handles chat conversation persistence
 */

import { apiRequest } from './api';
import { ChatMessage, Idea } from '@orbitai/shared';

// Re-export Idea for backwards compatibility with existing imports
export type { Idea } from '@orbitai/shared';

/**
 * Check if the current user is a guest (has guest token)
 */
function isGuestUser(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    const token = localStorage.getItem('authToken');
    if (!token) return false;
    // Guest tokens start with 'guest-token-' or are not valid JWTs
    return token.startsWith('guest-token-') || !token.includes('.') || token.split('.').length !== 3;
  } catch (error) {
    return false;
  }
}

export interface ChatConversation {
  _id?: string;
  id?: string;
  userId?: string;
  projectId?: string;
  type: 'setup' | 'workspace' | 'agent' | 'neural-chat';
  messages: ChatMessage[];
  answers?: Record<string, any>;
  summary?: string;
  metadata?: {
    flowId?: string;
    currentQuestionId?: string;
    completed?: boolean;
    topic?: string;
    ideas?: Idea[];
    keyInsights?: string[];
    nextSteps?: string[];
    [key: string]: any;
  };
  createdAt?: string;
  updatedAt?: string;
  // For compatibility with NeuralStreamChat format
  title?: string;
  preview?: string;
  timestamp?: number;
  topic?: string;
  ideas?: Idea[];
  keyInsights?: string[];
  nextSteps?: string[];
  currentPhase?: number; // 0-3: Exploration, Definition, Prototyping, Launch
  projectPreview?: {
    summary?: string;
    techStack?: string[];
    wireframeCode?: string;
    architectureDiagram?: string;
    risks?: string[];
    recommendedMethodology?: 'V-Model' | 'Agile' | 'Waterfall' | 'LangGraph';
    recommendedStandards?: string[];
    estimatedSprints?: number;
    projectName?: string;
    mobileCode?: {
      reactNative?: string;
      flutter?: string;
      iosSwift?: string;
      androidKotlin?: string;
    };
  };
  activeIdeaId?: string | null;
  glassPanelActiveView?: 'context' | 'history' | 'maturity';
  prototypingStage?: 'ideation' | 'prototyping';
  folderId?: string;
}

export interface CreateConversationRequest {
  projectId?: string;
  folderId?: string;
  type: 'setup' | 'workspace' | 'agent' | 'neural-chat';
  initialMessage?: ChatMessage;
  messages?: ChatMessage[];
}

export interface AddMessageRequest {
  message: ChatMessage;
  answers?: Record<string, any>;
  summary?: string;
  metadata?: Record<string, any>;
}

export interface UpdateAnswersRequest {
  answers: Record<string, any>;
  summary?: string;
  metadata?: Record<string, any>;
}

export const chatApi = {
  /**
   * Create a new conversation
   * For guest users, creates a local conversation stored in localStorage
   */
  async createConversation(data: CreateConversationRequest): Promise<ChatConversation> {
    // For guest users, return a local conversation object without API call
    if (isGuestUser()) {
      const localId = `guest_conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const localConversation: ChatConversation = {
        _id: localId,
        id: localId,
        type: data.type,
        messages: data.messages || (data.initialMessage ? [data.initialMessage] : []),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {}
      };

      // Store in localStorage for persistence within session
      try {
        const existingConvs = JSON.parse(localStorage.getItem('guestConversations') || '[]');
        existingConvs.push(localConversation);
        localStorage.setItem('guestConversations', JSON.stringify(existingConvs));
        console.log('📝 [ChatApi] Created local guest conversation:', localId);
      } catch (e) {
        console.warn('Failed to save guest conversation to localStorage:', e);
      }

      return localConversation;
    }
    const response = await apiRequest<{ success: boolean; data: { conversation: ChatConversation } }>(
      '/api/chat/conversations',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
    return response.data.conversation;
  },

  /**
   * Get conversations
   */
  async getConversations(params?: { projectId?: string; type?: string }): Promise<ChatConversation[]> {
    const queryParams = new URLSearchParams();
    if (params?.projectId) queryParams.append('projectId', params.projectId);
    if (params?.type) queryParams.append('type', params.type);

    const response = await apiRequest<{ success: boolean; data: { conversations: ChatConversation[] } }>(
      `/api/chat/conversations?${queryParams.toString()}`,
      {
        method: 'GET',
      }
    );
    return response.data.conversations;
  },

  /**
   * Get a specific conversation
   */
  async getConversation(id: string): Promise<ChatConversation> {
    const response = await apiRequest<{ success: boolean; data: { conversation: ChatConversation } }>(
      `/api/chat/conversations/${id}`,
      {
        method: 'GET',
      }
    );
    return response.data.conversation;
  },

  /**
   * Add a message to a conversation
   */
  async addMessage(conversationId: string, data: AddMessageRequest): Promise<ChatConversation> {
    const response = await apiRequest<{ success: boolean; data: { conversation: ChatConversation } }>(
      `/api/chat/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
    return response.data.conversation;
  },

  /**
   * Update answers and summary (for guided chat wizard)
   */
  async updateAnswers(conversationId: string, data: UpdateAnswersRequest): Promise<ChatConversation> {
    const response = await apiRequest<{ success: boolean; data: { conversation: ChatConversation } }>(
      `/api/chat/conversations/${conversationId}/answers`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );
    return response.data.conversation;
  },

  /**
   * Update full NeuralStreamChat conversation state
   * For guest users, updates are stored in localStorage
   */
  async updateNeuralChat(
    conversationId: string,
    data: {
      messages?: ChatMessage[];
      topic?: string;
      ideas?: Idea[];
      keyInsights?: string[];
      nextSteps?: string[];
      currentPhase?: number; // 0-3: Exploration, Definition, Prototyping, Launch
      projectPreview?: {
        summary?: string;
        techStack?: string[];
        wireframeCode?: string;
        architectureDiagram?: string;
        risks?: string[];
        recommendedMethodology?: 'V-Model' | 'Agile' | 'Waterfall' | 'LangGraph' | string;
        recommendedStandards?: string[];
        estimatedSprints?: number;
        projectName?: string;
        mobileCode?: {
          reactNative?: string;
          flutter?: string;
          iosSwift?: string;
          androidKotlin?: string;
        };
      };
      activeIdeaId?: string | null;
      glassPanelActiveView?: 'context' | 'history' | 'maturity';
      prototypingStage?: 'ideation' | 'prototyping';
      folderId?: string;
      projectId?: string; // Link conversation to project
    }
  ): Promise<ChatConversation> {
    // For guest users, update in localStorage
    if (isGuestUser()) {
      try {
        const existingConvs: ChatConversation[] = JSON.parse(localStorage.getItem('guestConversations') || '[]');
        const convIndex = existingConvs.findIndex(c => c._id === conversationId || c.id === conversationId);

        if (convIndex >= 0) {
          // Update existing conversation
          existingConvs[convIndex] = {
            ...existingConvs[convIndex],
            messages: data.messages || existingConvs[convIndex].messages,
            topic: data.topic,
            ideas: data.ideas,
            metadata: {
              ...existingConvs[convIndex].metadata,
              topic: data.topic,
              ideas: data.ideas,
              keyInsights: data.keyInsights,
              nextSteps: data.nextSteps,
              currentPhase: data.currentPhase,
              projectPreview: data.projectPreview,
              activeIdeaId: data.activeIdeaId,
              glassPanelActiveView: data.glassPanelActiveView,
              prototypingStage: data.prototypingStage
            },
            updatedAt: new Date().toISOString()
          };
          localStorage.setItem('guestConversations', JSON.stringify(existingConvs));
          console.log('📝 [ChatApi] Updated guest conversation:', conversationId);
          return existingConvs[convIndex];
        } else {
          // Create new if not found
          const newConv: ChatConversation = {
            _id: conversationId,
            id: conversationId,
            type: 'neural-chat',
            messages: data.messages || [],
            topic: data.topic,
            ideas: data.ideas,
            metadata: {
              topic: data.topic,
              ideas: data.ideas,
              keyInsights: data.keyInsights,
              nextSteps: data.nextSteps,
              currentPhase: data.currentPhase,
              projectPreview: data.projectPreview,
              activeIdeaId: data.activeIdeaId,
              glassPanelActiveView: data.glassPanelActiveView,
              prototypingStage: data.prototypingStage
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          existingConvs.push(newConv);
          localStorage.setItem('guestConversations', JSON.stringify(existingConvs));
          console.log('📝 [ChatApi] Created new guest conversation:', conversationId);
          return newConv;
        }
      } catch (e) {
        console.warn('Failed to update guest conversation in localStorage:', e);
        // Return a minimal conversation object to prevent errors
        return {
          _id: conversationId,
          id: conversationId,
          type: 'neural-chat',
          messages: data.messages || [],
          updatedAt: new Date().toISOString()
        } as ChatConversation;
      }
    }

    const response = await apiRequest<{ success: boolean; data: { conversation: ChatConversation } }>(
      `/api/chat/conversations/${conversationId}/neural-chat`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );
    return response.data.conversation;
  },

  /**
   * Delete a conversation
   */
  async deleteConversation(id: string): Promise<void> {
    await apiRequest(`/api/chat/conversations/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Get quick suggestions based on user input
   */
  async getQuickSuggestions(input: string, history?: any[]): Promise<Array<{ label: string; prompt: string }>> {
    try {
      const response = await apiRequest<{ success: boolean; data: Array<{ label: string; prompt: string }> }>(
        '/api/llm/quick-suggestions',
        {
          method: 'POST',
          body: JSON.stringify({ input, history }),
        }
      );
      return response.data || [];
    } catch (error) {
      console.error('Failed to get suggestions:', error);
      return [];
    }
  },
};




