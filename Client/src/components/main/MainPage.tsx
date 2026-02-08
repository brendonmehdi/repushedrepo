import { useRef, useState, useCallback, useEffect, type ChangeEvent } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { MilkdownEditor } from '../../MilkdownEditor';
import { useAuth } from '../../context/AuthContext';
import { storage } from '../../firebase';
import { downloadMarkdownAsPdf, EmptyMarkdownError } from '../../utils/pdf';
import NotesSidebar, { type Note } from './NotesSidebar.tsx';
import { getDocuments, fileUpload, createDocument, updateDocument, deleteDocument } from '../../api/auth';
import logo from '../../assets/logo.png';

interface MainPageProps {
    onLoginRequest: () => void;
}

const MainPage = ({ onLoginRequest }: MainPageProps) => {
    const { user, logout } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // State for upload flow
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [extractedMarkdown, setExtractedMarkdown] = useState<string | null>(null);
    const [editorMarkdown, setEditorMarkdown] = useState<string>('');
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    // Sidebar state
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [notes, setNotes] = useState<Note[]>([]);
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

    // Key to force Milkdown editor remount
    const [editorKey, setEditorKey] = useState(0);

    // Helper for date labels
    function nowLabel() {
        return new Date().toLocaleDateString("en-CA", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    }

    // Load documents from backend
    useEffect(() => {
        const fetchDocs = async () => {
            if (user) {
                try {
                    const token = await user.getIdToken();
                    const response = await getDocuments(token);
                    if (response && response.data) {
                        const backendNotes: Note[] = response.data.map((doc: any) => ({
                            id: doc.id,
                            content: doc.markdownContent,
                            updatedAt: new Date(doc.createdAt).toLocaleDateString("en-CA", {
                                year: "numeric",
                                month: "short",
                                day: "numeric"
                            })
                        }));
                        setNotes(backendNotes);
                    }
                } catch (err) {
                    console.error("Failed to fetch documents:", err);
                }
            }
        };
        fetchDocs();
    }, [user]);

    // Callback to receive markdown updates from editor
    const handleMarkdownChange = useCallback((markdown: string) => {
        setEditorMarkdown(markdown);
    }, []);

    // Create new note - clear editor and selection
    const handleNewNote = () => {
        setSelectedNoteId(null);
        setExtractedMarkdown('');
        setEditorMarkdown('');
        setEditorKey(prev => prev + 1);  // Force editor remount
        setSidebarOpen(false);
    };

    // Select existing note - load content into editor
    const handleSelectNote = (note: Note) => {
        setSelectedNoteId(note.id);
        setExtractedMarkdown(note.content);
        setEditorMarkdown(note.content);
        setEditorKey(prev => prev + 1);  // Force editor remount with new content
        setSidebarOpen(false);
    };

    // Save current editor content as note
    const handleSave = async () => {
        const trimmed = editorMarkdown.trim();
        if (!trimmed) return;

        if (!user) {
            onLoginRequest();
            return;
        }

        try {
            const token = await user.getIdToken();

            if (!selectedNoteId) {
                // Create new
                const response = await createDocument(editorMarkdown, token);
                if (response && response.data) {
                    const newNote: Note = {
                        id: response.data.id,
                        content: response.data.markdownContent,
                        updatedAt: nowLabel(),
                    };
                    setNotes((prev) => [newNote, ...prev]);
                    setSelectedNoteId(newNote.id);
                }
            } else {
                // Update existing
                await updateDocument(selectedNoteId, editorMarkdown, token);
                setNotes((prev) => {
                    const updated = prev.map((n) =>
                        n.id === selectedNoteId
                            ? { ...n, content: editorMarkdown, updatedAt: nowLabel() }
                            : n
                    );
                    const updatedNote = updated.find((n) => n.id === selectedNoteId);
                    const rest = updated.filter((n) => n.id !== selectedNoteId);
                    return updatedNote ? [updatedNote, ...rest] : updated;
                });
            }
        } catch (e) {
            console.error("Failed to save:", e);
            setError("Failed to save note");
        }
    };

    // Delete note handler
    const handleDeleteNote = async (noteId: string) => {
        if (!window.confirm("Are you sure you want to delete this note?")) return;

        if (!user) {
            onLoginRequest();
            return;
        }

        try {
            const token = await user.getIdToken();
            await deleteDocument(noteId, token);

            setNotes((prev) => prev.filter((n) => n.id !== noteId));
            if (selectedNoteId === noteId) {
                handleNewNote(); // Clear editor if deleted note was selected
            }
        } catch (e) {
            console.error("Failed to delete:", e);
            setError("Failed to delete note");
        }
    };

    // PDF download handler
    const handleDownloadPDF = useCallback(async () => {
        setError(null);
        setIsGeneratingPdf(true);

        try {
            await downloadMarkdownAsPdf(editorMarkdown, 'vibescribe-notes');
        } catch (err) {
            if (err instanceof EmptyMarkdownError) {
                setError(err.message);
            } else {
                console.error('PDF generation failed:', err);
                setError('Failed to generate PDF. Please try again.');
            }
        } finally {
            setIsGeneratingPdf(false);
        }
    }, [editorMarkdown]);

    const handleUploadClick = () => {
        if (!user) {
            onLoginRequest();
            return;
        }
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!validTypes.includes(file.type)) {
            setError('Please upload a valid image (JPEG, PNG, WebP, or GIF)');
            return;
        }

        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            setError('Image must be smaller than 10MB');
            return;
        }

        setError(null);
        setIsUploading(true);

        try {
            const storageRef = ref(storage, `scans/${user.uid}/${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            const imageUrl = await getDownloadURL(snapshot.ref);
            const token = await user.getIdToken();
            const document = await fileUpload(imageUrl, token);

            if (document && document.data && document.data.markdownContent) {
                const newNote: Note = {
                    id: document.data.id || crypto.randomUUID(),
                    content: document.data.markdownContent,
                    updatedAt: nowLabel(),
                };
                setNotes(prev => [newNote, ...prev]);
                setExtractedMarkdown(document.data.markdownContent);
                setSelectedNoteId(null); // Show new note logic if needed, or select it
                // Actually, let's select the new note
                setSelectedNoteId(newNote.id);
                setEditorMarkdown(newNote.content);
                setEditorKey(prev => prev + 1);
            } else {
                setError('No text could be extracted from the image');
            }
        } catch (err) {
            console.error('Upload failed:', err);
            setError(err instanceof Error ? err.message : 'Failed to process image');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    return (
        <div className="bg-black w-screen min-h-screen flex flex-col text-white relative">
            {/* Sidebar */}
            <NotesSidebar
                open={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                notes={notes}
                selectedNoteId={selectedNoteId}
                onSelect={handleSelectNote}
                onDelete={handleDeleteNote}
                onNewNote={handleNewNote}
            />

            {/* Navbar */}
            <div className="bg-gray-900/80 backdrop-blur w-full h-20 border-b border-gray-700 sticky top-0 z-50">
                <div className="flex flex-row gap-3 items-center justify-between px-4 h-full max-w-6xl mx-auto">
                    <div className="flex flex-row gap-3 items-center">
                        {/* Hamburger menu */}
                        <button
                            onClick={() => setSidebarOpen((s) => !s)}
                            className="mr-2 h-10 w-10 rounded-xl border border-gray-700 bg-gray-900
                                flex items-center justify-center hover:bg-gray-800 active:scale-95 transition
                                focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-black"
                            aria-label="Open notes sidebar"
                            title="Notes"
                        >
                            <span className="text-xl leading-none">☰</span>
                        </button>

                        <img
                            src={logo}
                            alt="VibeScribe Logo"
                            className="h-16 w-auto"
                        />
                        <p className="font-bold text-2xl tracking-wide">VibeScribe</p>
                    </div>

                    {/* Login/Logout */}
                    {user ? (
                        <div className="flex items-center gap-4">
                            <img
                                src={user.photoURL || ''}
                                alt="Profile"
                                className="w-10 h-10 rounded-full border-2 border-emerald-500"
                            />
                            <button
                                onClick={logout}
                                className="px-4 py-2 rounded-lg bg-gray-800 text-white/80 hover:bg-gray-700 transition-colors"
                            >
                                Logout
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={onLoginRequest}
                            className="px-5 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-500 transition-colors"
                        >
                            Login
                        </button>
                    )}
                </div>
            </div>

            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleFileChange}
                className="hidden"
            />

            {/* Page Content */}
            <div className="flex flex-col gap-10 py-10 px-4">
                {/* Hero */}
                <div className="w-full max-w-5xl mx-auto rounded-3xl border border-gray-700 bg-gradient-to-b from-gray-900 to-black px-6 py-12 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
                    <div className="flex flex-col gap-5 items-center text-center">
                        <p className="font-extrabold text-4xl sm:text-6xl leading-tight">
                            Study Smarter, Not Harder
                        </p>
                        <p className="text-white/80 font-medium text-base sm:text-xl max-w-3xl leading-relaxed">
                            Upload images of your notes, convert them into editable Markdown,
                            summarize key points, and export your notes in seconds.
                        </p>
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="w-full max-w-5xl mx-auto">
                        <div className="bg-red-900/50 border border-red-700 rounded-xl px-4 py-3 text-red-200 flex items-center justify-between">
                            <span>{error}</span>
                            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
                                ✕
                            </button>
                        </div>
                    </div>
                )}

                {/* Upload Button */}
                <div className="flex justify-center">
                    <button
                        onClick={handleUploadClick}
                        disabled={isUploading}
                        className={`
                            group flex items-center gap-3
                            bg-gray-900 rounded-2xl
                            border border-emerald-700
                            px-5 py-3
                            font-semibold text-emerald-300
                            shadow-md shadow-emerald-900/20
                            transition-all duration-200
                            hover:bg-gray-800
                            hover:border-emerald-500
                            hover:text-emerald-200
                            active:scale-95
                            focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-black
                            disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
                        `}
                    >
                        {isUploading ? (
                            <>
                                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Processing...
                            </>
                        ) : (
                            <>
                                Click Here to Upload a Photo
                                <span className="text-2xl font-bold leading-none transition-transform duration-200 group-hover:rotate-90">
                                    +
                                </span>
                            </>
                        )}
                    </button>
                </div>

                {/* Save/New Note Buttons */}
                <div className="w-full max-w-5xl mx-auto">
                    <div className="flex justify-end gap-3 mb-3">
                        <button
                            onClick={handleNewNote}
                            className="rounded-2xl px-4 py-3 font-semibold
                                border border-gray-700 bg-gray-900 text-white/90
                                hover:bg-gray-800 active:scale-95 transition"
                        >
                            + New Note
                        </button>

                        <button
                            onClick={handleSave}
                            className="rounded-2xl px-5 py-3 font-semibold
                                bg-emerald-400 text-black
                                hover:brightness-110 active:scale-95 transition
                                focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-2 focus:ring-offset-black"
                        >
                            {selectedNoteId ? "Save Changes" : "Save Note"}
                        </button>
                    </div>
                </div>

                {/* Milkdown Editor */}
                <div className="flex flex-col items-center gap-2">
                    <div className="w-full max-w-5xl">
                        <MilkdownEditor
                            key={editorKey}
                            initialMarkdown={extractedMarkdown}
                            onMarkdownChange={handleMarkdownChange}
                        />
                        <p className="mt-2 text-sm text-white/60 italic text-center">
                            Click anywhere to edit • Use the button above to view raw Markdown
                        </p>
                    </div>
                </div>

                {/* Download PDF Button */}
                <div className="flex justify-center pb-8">
                    <button
                        onClick={handleDownloadPDF}
                        disabled={isGeneratingPdf}
                        className={`
                            flex items-center gap-3
                            bg-gray-900 rounded-2xl
                            border border-emerald-700
                            px-5 py-3
                            font-semibold text-emerald-300
                            shadow-md shadow-emerald-900/20
                            transition-all duration-200
                            hover:bg-gray-800
                            hover:border-emerald-500
                            hover:text-emerald-200
                            active:scale-95
                            focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-black
                            disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
                        `}
                    >
                        {isGeneratingPdf ? (
                            <>
                                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Generating PDF...
                            </>
                        ) : (
                            <>
                                Download Your Notes (PDF)
                                <span className="text-xl leading-none">⤓</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MainPage;
