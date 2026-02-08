import { useState, useEffect, useCallback, useRef } from 'react';

const STORAGE_KEY = 'vibescribe-markdown-content';
const DEFAULT_MARKDOWN = '# Welcome to VibeScribe\n\nStart typing your notes here...\n\n## Features\n- **Rich text editing** with Markdown support\n- Real-time preview\n- Export to PDF\n';
const SAVE_DELAY = 500; // ms

/**
 * Hook to persist markdown content to localStorage with debounced saving.
 * Returns the current markdown and a function to update it.
 */
export function useMarkdownPersistence(): [string, (value: string) => void] {
    const [markdown, setMarkdown] = useState<string>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            return saved ?? DEFAULT_MARKDOWN;
        } catch {
            return DEFAULT_MARKDOWN;
        }
    });

    const saveTimerRef = useRef<number | undefined>(undefined);

    // Debounced save to localStorage
    const saveToStorage = useCallback((value: string) => {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = window.setTimeout(() => {
            try {
                localStorage.setItem(STORAGE_KEY, value);
            } catch (e) {
                console.warn('Failed to save markdown to localStorage:', e);
            }
        }, SAVE_DELAY);
    }, []);

    // Update both state and trigger debounced save
    const updateMarkdown = useCallback(
        (value: string) => {
            setMarkdown(value);
            saveToStorage(value);
        },
        [saveToStorage]
    );

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            clearTimeout(saveTimerRef.current);
        };
    }, []);

    return [markdown, updateMarkdown];
}
