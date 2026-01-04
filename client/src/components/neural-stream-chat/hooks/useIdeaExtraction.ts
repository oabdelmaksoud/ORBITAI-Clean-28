// useIdeaExtraction Hook
// Extracted from NeuralStreamChat.tsx for handling idea parsing and management

import { useState, useCallback, useRef } from 'react';
import { Idea } from '@src/OrbGraph';
import {
    parseXmlToIdeas,
    parseInlineIdeas,
    mergeIdeas
} from '../utils/xmlParser';
import { recategorizeIdeasWithAI } from '../utils/ideaCategorization';

interface UseIdeaExtractionOptions {
    onIdeasChange?: (ideas: Idea[]) => void;
}

interface UseIdeaExtractionReturn {
    ideas: Idea[];
    setIdeas: React.Dispatch<React.SetStateAction<Idea[]>>;
    extractIdeasFromText: (text: string, parentId?: string | null) => Idea[];
    extractIdeasFromStream: (chunk: string, fullText: string) => void;
    triggerAIRecategorization: () => void;
    clearIdeas: () => void;
    addIdea: (idea: Idea) => void;
    removeIdea: (ideaId: string) => void;
    updateIdea: (ideaId: string, updates: Partial<Idea>) => void;
}

/**
 * Custom hook for managing idea extraction and manipulation
 * Handles both XML and legacy inline formats from AI responses
 */
export const useIdeaExtraction = (
    options: UseIdeaExtractionOptions = {}
): UseIdeaExtractionReturn => {
    const { onIdeasChange } = options;
    const [ideas, setIdeasInternal] = useState<Idea[]>([]);
    const extractionInProgressRef = useRef(false);

    // Wrapper for setIdeas that also calls the onChange callback
    const setIdeas: React.Dispatch<React.SetStateAction<Idea[]>> = useCallback((action) => {
        setIdeasInternal(prev => {
            const next = typeof action === 'function' ? action(prev) : action;
            if (onIdeasChange && next !== prev) {
                onIdeasChange(next);
            }
            return next;
        });
    }, [onIdeasChange]);

    /**
     * Extract all ideas from text using XML or inline format
     */
    const extractIdeasFromText = useCallback((
        text: string,
        parentId: string | null = null
    ): Idea[] => {
        const allIdeas: Idea[] = [];

        // Try XML parsing first (new format)
        const xmlIdeas = parseXmlToIdeas(text);
        if (xmlIdeas.length > 0) {
            // Set parent IDs for top-level ideas if parentId provided
            const ideasWithParent = parentId
                ? xmlIdeas.map(idea => ({
                    ...idea,
                    parentId: idea.parentId || parentId
                }))
                : xmlIdeas;
            return ideasWithParent;
        }

        // Fallback to inline format (legacy)
        const inlineIdeas = parseInlineIdeas(text);
        if (inlineIdeas.length > 0) {
            return inlineIdeas.map(idea => ({
                ...idea,
                parentId: parentId || idea.parentId
            }));
        }

        // Also try to extract from simple XML patterns
        const ideaBlocks = text.match(/<idea>[\s\S]*?<\/idea>/g) || [];

        for (const block of ideaBlocks) {
            const nestedCount = (block.match(/<idea>/g) || []).length;

            if (nestedCount > 1) {
                // Parent block with children
                const beforeChildren = block.split('<children>')[0];
                const titleMatch = /<title>(.*?)<\/title>/s.exec(beforeChildren);
                const descMatch = /<description>(.*?)<\/description>/s.exec(beforeChildren);
                const categoryMatch = /<category>(.*?)<\/category>/s.exec(beforeChildren);

                if (titleMatch) {
                    const label = titleMatch[1].trim();
                    const description = descMatch ? descMatch[1].trim() : '';
                    const categoryRaw = categoryMatch ? categoryMatch[1].trim().toLowerCase() : 'feature';

                    const category = mapCategory(categoryRaw);

                    if (label.length > 2) {
                        const parentIdeaId = `idea-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                        allIdeas.push({
                            id: parentIdeaId,
                            label,
                            description,
                            category,
                            parentId,
                        });

                        // Extract children
                        const childrenMatch = /<children>([\s\S]*?)<\/children>/s.exec(block);
                        if (childrenMatch) {
                            const childIdeas = extractIdeasFromText(childrenMatch[1], parentIdeaId);
                            allIdeas.push(...childIdeas);
                        }
                    }
                }
            } else {
                // Single idea
                const titleMatch = /<title>(.*?)<\/title>/s.exec(block);
                const descMatch = /<description>(.*?)<\/description>/s.exec(block);
                const categoryMatch = /<category>(.*?)<\/category>/s.exec(block);

                if (titleMatch) {
                    const label = titleMatch[1].trim();
                    const description = descMatch ? descMatch[1].trim() : '';
                    const categoryRaw = categoryMatch ? categoryMatch[1].trim().toLowerCase() : 'feature';

                    if (label.length > 2) {
                        allIdeas.push({
                            id: `idea-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                            label,
                            description,
                            category: mapCategory(categoryRaw),
                            parentId,
                        });
                    }
                }
            }
        }

        return allIdeas;
    }, []);

    /**
     * Handle streaming text and extract ideas incrementally
     */
    const extractIdeasFromStream = useCallback((chunk: string, fullText: string) => {
        if (extractionInProgressRef.current) return;

        const newIdeas = extractIdeasFromText(fullText);

        if (newIdeas.length > 0) {
            setIdeas(prev => mergeIdeas(prev, newIdeas));
        }
    }, [extractIdeasFromText, setIdeas]);

    /**
     * Trigger AI-powered recategorization for ideas with generic categories
     */
    const triggerAIRecategorization = useCallback(() => {
        setIdeas(currentIdeas => {
            // Trigger AI categorization after a short delay
            setTimeout(() => {
                recategorizeIdeasWithAI(currentIdeas, setIdeas);
            }, 500);
            return currentIdeas;
        });
    }, [setIdeas]);

    /**
     * Clear all ideas
     */
    const clearIdeas = useCallback(() => {
        setIdeas([]);
    }, [setIdeas]);

    /**
     * Add a single idea
     */
    const addIdea = useCallback((idea: Idea) => {
        setIdeas(prev => {
            // Avoid duplicates by label
            if (prev.some(p => p.label.toLowerCase() === idea.label.toLowerCase())) {
                return prev;
            }
            return [...prev, idea];
        });
    }, [setIdeas]);

    /**
     * Remove an idea by ID
     */
    const removeIdea = useCallback((ideaId: string) => {
        setIdeas(prev => prev.filter(idea => idea.id !== ideaId));
    }, [setIdeas]);

    /**
     * Update an existing idea
     */
    const updateIdea = useCallback((ideaId: string, updates: Partial<Idea>) => {
        setIdeas(prev => prev.map(idea =>
            idea.id === ideaId ? { ...idea, ...updates } : idea
        ));
    }, [setIdeas]);

    return {
        ideas,
        setIdeas,
        extractIdeasFromText,
        extractIdeasFromStream,
        triggerAIRecategorization,
        clearIdeas,
        addIdea,
        removeIdea,
        updateIdea,
    };
};

/**
 * Map raw category string to valid category type
 */
function mapCategory(categoryRaw: string): Idea['category'] {
    const cat = categoryRaw.toLowerCase();
    if (cat.includes('risk')) return 'risk';
    if (cat.includes('opportun')) return 'opportunity';
    if (cat.includes('business')) return 'business';
    if (cat.includes('tech')) return 'technology';
    if (cat.includes('ux') || cat.includes('experience')) return 'ux';
    if (cat.includes('data') || cat.includes('analytic')) return 'data';
    if (cat.includes('communit')) return 'community';
    if (cat.includes('platform')) return 'platform';
    if (cat.includes('constraint')) return 'constraint';
    if (cat.includes('require')) return 'requirement';
    return 'feature';
}

export default useIdeaExtraction;
