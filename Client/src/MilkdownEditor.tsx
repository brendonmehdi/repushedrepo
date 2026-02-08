import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Crepe } from '@milkdown/crepe';
import { replaceAll } from '@milkdown/utils';
import { useMarkdownPersistence } from './hooks/useMarkdownPersistence';

import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/frame-dark.css';
import './MilkdownEditor.css';

interface MilkdownEditorProps {
  initialMarkdown?: string | null;
  onMarkdownChange?: (markdown: string) => void;
}

export const MilkdownEditor: React.FC<MilkdownEditorProps> = ({ initialMarkdown, onMarkdownChange }) => {
  const editorRootRef = useRef<HTMLDivElement>(null);
  const crepeRef = useRef<Crepe | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const syncTimerRef = useRef<number | undefined>(undefined);

  // Drawer state - when open, textarea is completely independent
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerOpenRef = useRef(false); // Ref to track in callbacks
  const hasInitializedRef = useRef(false); // Track if initialMarkdown was applied on mount

  // Persistence hook for markdown content
  const [markdown, setMarkdown] = useMarkdownPersistence();
  const markdownRef = useRef(markdown); // Keep ref in sync for callbacks

  // Keep refs in sync with state
  useEffect(() => {
    drawerOpenRef.current = drawerOpen;
  }, [drawerOpen]);

  useEffect(() => {
    markdownRef.current = markdown;
    onMarkdownChange?.(markdown);
  }, [markdown, onMarkdownChange]);

  // Handle external initialMarkdown changes (from Gemini extraction or note selection)
  // This effect handles BOTH initial mount AND subsequent changes
  useEffect(() => {
    // On mount: if initialMarkdown is provided (including empty string), use it
    // This ensures New Note clears the editor and note selection loads correctly
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      if (initialMarkdown !== null && initialMarkdown !== undefined) {
        // Use initialMarkdown even if empty (for New Note)
        setMarkdown(initialMarkdown);
        // Delay sync to editor until it's created
        setTimeout(() => syncToEditor(initialMarkdown), 100);
        return;
      }
    }

    // After initial mount: only update if initialMarkdown changes
    if (initialMarkdown !== null && initialMarkdown !== undefined && initialMarkdown !== markdownRef.current) {
      setMarkdown(initialMarkdown);
      syncToEditor(initialMarkdown);
    }
  }, [initialMarkdown]);

  // Initialize the Milkdown editor
  useEffect(() => {
    if (!editorRootRef.current || crepeRef.current) return;

    const crepe = new Crepe({
      root: editorRootRef.current,
      defaultValue: markdown,
    });

    crepeRef.current = crepe;

    // Listen for changes from the main editor ONLY when drawer is closed
    crepe.on((listener: any) => {
      listener.markdownUpdated((_: any, nextMd: string) => {
        // CRITICAL: If drawer is open, do NOT update anything
        // The textarea is the source of truth while open
        if (drawerOpenRef.current) return;

        // Only update state when drawer is closed
        setMarkdown(nextMd);
      });
    });

    crepe.create().then(() => {
      console.log('Milkdown Editor Ready');
    }).catch(console.error);

    return () => {
      crepe.destroy();
      crepeRef.current = null;
      clearTimeout(syncTimerRef.current);
    };

  }, []);

  // Sync textarea value when drawer opens
  useEffect(() => {
    if (drawerOpen && textareaRef.current) {
      // Set the current markdown value when opening
      textareaRef.current.value = markdownRef.current;
      textareaRef.current.focus();
    }
  }, [drawerOpen]);

  // Update the Milkdown editor
  const syncToEditor = useCallback((text: string) => {
    const crepe = crepeRef.current;
    if (!crepe) return;

    try {
      if (typeof (crepe as any).action === 'function') {
        (crepe as any).action(replaceAll(text));
      } else if (crepe.editor) {
        crepe.editor.action(replaceAll(text));
      }
    } catch (e) {
      console.warn('Failed to sync to editor:', e);
    }
  }, []);

  // Handle textarea input NO cursor manipulation needed with uncontrolled input
  const handleTextareaInput = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const newText = textarea.value;

    // Update persisted state
    setMarkdown(newText);

    // Debounce sync to Milkdown editor (heavier operation)
    clearTimeout(syncTimerRef.current);
    syncTimerRef.current = window.setTimeout(() => {
      syncToEditor(newText);
    }, 400);
  }, [setMarkdown, syncToEditor]);

  // Handle drawer close - sync final state
  const handleCloseDrawer = useCallback(() => {
    // Clear any pending sync
    clearTimeout(syncTimerRef.current);

    // Sync final textarea content immediately
    if (textareaRef.current) {
      const finalText = textareaRef.current.value;
      setMarkdown(finalText);
      syncToEditor(finalText);
    }

    setDrawerOpen(false);
  }, [setMarkdown, syncToEditor]);

  return (
    <div className="milkdown-editor-container">
      {/* Controls */}
      <div className="milkdown-controls">
        <button
          className="milkdown-open-btn"
          onClick={() => setDrawerOpen(true)}
        >
          Open Markdown Source
        </button>
      </div>

      {/* Main Editor Area */}
      <div className="milkdown-editor-wrapper">
        <div ref={editorRootRef} />
      </div>

      {/* Drawer Overlay */}
      {drawerOpen && (
        <div className="drawer-overlay" onClick={handleCloseDrawer} />
      )}

      {/* Markdown Drawer */}
      <div className={`markdown-drawer ${drawerOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <strong>Markdown Source</strong>
          <button className="drawer-close-btn" onClick={handleCloseDrawer}>
            Close
          </button>
        </div>

        <div className="drawer-content">
          <textarea
            ref={textareaRef}
            className="markdown-textarea"
            onInput={handleTextareaInput}
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
};
