import React from "react";

export type Note = {
    id: string;
    content: string;
    updatedAt: string;
};

type Props = {
    open: boolean;
    onClose: () => void;

    notes: Note[];
    selectedNoteId: string | null;
    onSelect: (note: Note) => void;
    onDelete: (noteId: string) => void;

    onNewNote: () => void;
};

function previewTitle(content: string) {
    const firstLine =
        content
            .split("\n")
            .map((l) => l.trim())
            .find((l) => l.length > 0) || "Untitled";

    return firstLine.replace(/^#+\s*/, "").split(/\s+/).slice(0, 6).join(" ");
}

export default function NotesSidebar({
    open,
    onClose,
    notes,
    selectedNoteId,
    onSelect,
    onDelete,
}: Props) {
    return (
        <>
            {open && (
                <button
                    onClick={onClose}
                    className="fixed inset-0 bg-black/60 z-40 cursor-default"
                    aria-label="Close sidebar overlay"
                />
            )}

            <aside
                className={`
          fixed top-0 left-0 h-full w-80
          bg-gray-950 border-r border-gray-800 z-50
          transform transition-transform duration-200
          ${open ? "translate-x-0" : "-translate-x-full"}
        `}
                aria-hidden={!open}
            >
                <div className="h-20 border-b border-gray-800 flex items-center justify-between px-4">
                    <p className="font-semibold text-lg">Notes</p>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={onClose}
                            className="
                h-9 w-9 rounded-xl border border-gray-800
                hover:bg-gray-900 transition active:scale-95
                focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-black
              "
                            aria-label="Close sidebar"
                            title="Close"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                <div className="p-4">
                    {notes.length === 0 ? (
                        <div className="rounded-2xl border border-gray-800 bg-gray-900/30 p-4">
                            <p className="text-white/80 font-semibold">No previous notes</p>
                            <p className="text-white/60 text-sm mt-1">
                                Save a note and it will show up here.
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {notes.map((n) => (
                                <div
                                    key={n.id}
                                    className={`
                    relative rounded-2xl border p-4 transition
                    ${n.id === selectedNoteId
                                            ? "border-emerald-500 bg-emerald-500/10"
                                            : "border-gray-800 bg-gray-900/30 hover:bg-gray-900/60 hover:border-gray-700"
                                        }
                  `}
                                >
                                    {/* Delete button */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDelete(n.id);
                                        }}
                                        className="absolute top-2 right-2 h-7 w-7 rounded-lg
                                            bg-gray-800/80 hover:bg-red-600 text-white/60 hover:text-white
                                            flex items-center justify-center transition
                                            focus:outline-none focus:ring-2 focus:ring-red-500"
                                        aria-label="Delete note"
                                        title="Delete note"
                                    >
                                        🗑
                                    </button>

                                    {/* Note content (clickable) */}
                                    <button
                                        onClick={() => onSelect(n)}
                                        className="text-left w-full pr-8
                                            focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-lg"
                                    >
                                        <p className="font-semibold">{previewTitle(n.content)}</p>
                                        <p className="text-xs text-white/60 mt-1">
                                            Last updated • {n.updatedAt}
                                        </p>
                                        <p className="text-sm text-white/70 mt-2 line-clamp-2">
                                            {n.content}
                                        </p>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </aside>
        </>
    );
}
