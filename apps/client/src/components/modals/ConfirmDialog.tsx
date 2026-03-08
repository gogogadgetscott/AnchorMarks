import React, { useState, useEffect, useRef } from "react";
import { useConfirm, type ConfirmOptions, type PromptOptions, type TagPickerOptions } from "@/contexts/ConfirmContext";
import { useBookmarks } from "@/contexts/BookmarksContext";
import { Icon } from "../Icon.tsx";

export function ConfirmDialog() {
    const { state, close } = useConfirm();
    const { tagMetadata } = useBookmarks();

    const [inputValue, setInputValue] = useState("");
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [tagSearch, setTagSearch] = useState("");
    const [autocompleteIndex, setAutocompleteIndex] = useState(-1);

    const inputRef = useRef<HTMLInputElement>(null);
    const tagInputRef = useRef<HTMLInputElement>(null);

    // Reset local state when dialog opens
    useEffect(() => {
        if (state?.type === "prompt") {
            setInputValue((state.options as PromptOptions)?.defaultValue || "");
            setTimeout(() => inputRef.current?.focus(), 50);
        } else if (state?.type === "tag-picker") {
            setSelectedTags([...((state.options as TagPickerOptions)?.initialTags || [])]);
            setTagSearch("");
            setTimeout(() => tagInputRef.current?.focus(), 50);
        }
    }, [state]);

    if (!state) return null;

    const handleConfirm = () => {
        if (state.type === "confirm") state.resolve(true);
        else if (state.type === "prompt") state.resolve(inputValue);
        else if (state.type === "tag-picker") state.resolve(selectedTags.length > 0 ? selectedTags : null);
        close();
    };

    const handleCancel = () => {
        state.resolve(null);
        close();
    };

    // --- Tag Picker Logic ---
    const addTag = (tag: string) => {
        const trimmed = tag.trim();
        if (!trimmed || selectedTags.includes(trimmed)) return;
        setSelectedTags([...selectedTags, trimmed]);
        setTagSearch("");
    };

    const removeTag = (tag: string) => {
        setSelectedTags(selectedTags.filter(t => t !== tag));
    };

    const filteredTags = Object.keys(tagMetadata)
        .filter(t => t.toLowerCase().includes(tagSearch.toLowerCase()) && !selectedTags.includes(t))
        .sort((a, b) => (tagMetadata[b].count || 0) - (tagMetadata[a].count || 0))
        .slice(0, 15);

    const handleTagKeydown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            if (autocompleteIndex >= 0 && filteredTags[autocompleteIndex]) {
                addTag(filteredTags[autocompleteIndex]);
            } else if (tagSearch.trim()) {
                addTag(tagSearch);
            }
        } else if (e.key === "Backspace" && !tagSearch && selectedTags.length > 0) {
            removeTag(selectedTags[selectedTags.length - 1]);
        } else if (e.key === "ArrowDown") {
            e.preventDefault();
            setAutocompleteIndex(prev => Math.min(prev + 1, filteredTags.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setAutocompleteIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === "Escape") {
            handleCancel();
        }
    };

    // --- UI Renderers ---
    const renderConfirm = () => {
        const options = state.options as ConfirmOptions;
        return (
            <div className="modal modal-sm">
                <div className="modal-backdrop" onClick={handleCancel}></div>
                <div className="modal-content">
                    <div className="modal-header" style={{ padding: '1rem 1.5rem', minHeight: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 className="confirm-title" style={{ fontSize: '1.1rem', margin: 0 }}>{options.title || "Confirm"}</h2>
                        <button className="btn-icon" onClick={handleCancel} aria-label="Close" style={{ padding: '4px', opacity: 0.6 }}>
                            <Icon name="x" size={18} />
                        </button>
                    </div>
                    <div className="modal-body" style={{ padding: '1.5rem', paddingBottom: 0 }}>
                        <p className="confirm-message" style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '0.95rem' }}>
                            {state.message}
                        </p>
                    </div>
                    <div className="modal-footer" style={{ padding: '1.25rem 1.5rem', justifyContent: 'flex-end', gap: '0.75rem', borderTop: 'none', marginTop: '0.5rem' }}>
                        <button className="btn btn-ghost" onClick={handleCancel}>{options.cancelText || "Cancel"}</button>
                        <button className={`btn ${options.destructive ? 'btn-danger' : 'btn-primary'}`} onClick={handleConfirm} autoFocus>
                            {options.confirmText || "Confirm"}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const renderPrompt = () => {
        const options = state.options as PromptOptions;
        return (
            <div className="modal modal-sm">
                <div className="modal-backdrop" onClick={handleCancel}></div>
                <div className="modal-content">
                    <div className="modal-header" style={{ padding: '1rem 1.5rem', minHeight: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 className="confirm-title" style={{ fontSize: '1.1rem', margin: 0 }}>{options.title || "Prompt"}</h2>
                        <button className="btn-icon" onClick={handleCancel} aria-label="Close" style={{ padding: '4px', opacity: 0.6 }}>
                            <Icon name="x" size={18} />
                        </button>
                    </div>
                    <div className="modal-body" style={{ padding: '1.5rem', paddingBottom: 0 }}>
                        <p className="confirm-message" style={{ margin: 0, marginBottom: '1rem', color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '0.95rem' }}>
                            {state.message}
                        </p>
                        <input
                            ref={inputRef}
                            type="text"
                            className="form-control"
                            style={{ width: '100%' }}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
                            placeholder={options.placeholder}
                        />
                    </div>
                    <div className="modal-footer" style={{ padding: '1.25rem 1.5rem', justifyContent: 'flex-end', gap: '0.75rem', borderTop: 'none', marginTop: '0.5rem' }}>
                        <button className="btn btn-ghost" onClick={handleCancel}>{options.cancelText || "Cancel"}</button>
                        <button className="btn btn-primary" onClick={handleConfirm}>{options.confirmText || "OK"}</button>
                    </div>
                </div>
            </div>
        );
    };

    const renderTagPicker = () => {
        const options = state.options as TagPickerOptions;
        return (
            <div className="modal modal-tag-picker">
                <div className="modal-backdrop" onClick={handleCancel}></div>
                <div className="modal-content" style={{ overflow: 'visible' }}>
                    <div className="modal-header" style={{ padding: '1rem 1.5rem', minHeight: 'auto' }}>
                        <div>
                            <h2 style={{ fontSize: '1.1rem', margin: 0 }}>{options.title || "Tags"}</h2>
                            {options.selectionCount != null && (
                                <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', margin: '0.2rem 0 0' }}>
                                    {options.selectionCount} bookmark{options.selectionCount !== 1 ? 's' : ''} selected
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="modal-body" style={{ padding: '1rem 1.5rem 0.5rem', overflow: 'visible' }}>
                        <div style={{ position: 'relative' }}>
                            <div className="tags-input-container">
                                <div className="selected-tags">
                                    {selectedTags.map(tag => (
                                        <span key={tag} className="selected-tag" style={{ '--tag-color': tagMetadata[tag]?.color || '#f59e0b' } as any}>
                                            <span className="selected-tag-name">{tag}</span>
                                            <button type="button" className="selected-tag-remove" onClick={() => removeTag(tag)}>
                                                <Icon name="close" size={10} />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                                <input
                                    ref={tagInputRef}
                                    type="text"
                                    placeholder="Search or create tags…"
                                    autoComplete="off"
                                    value={tagSearch}
                                    onChange={(e) => setTagSearch(e.target.value)}
                                    onKeyDown={handleTagKeydown}
                                />
                            </div>
                            {tagSearch && (
                                <div className="tag-autocomplete" style={{ display: 'block', maxHeight: '240px', overflowY: 'auto' }}>
                                    {filteredTags.map((tag, idx) => (
                                        <div
                                            key={tag}
                                            className={`tag-autocomplete-item ${idx === autocompleteIndex ? 'active' : ''}`}
                                            onClick={() => addTag(tag)}
                                        >
                                            <span>{tag}</span>
                                            <span className="tag-autocomplete-count">{tagMetadata[tag].count}</span>
                                        </div>
                                    ))}
                                    {!filteredTags.some(t => t.toLowerCase() === tagSearch.toLowerCase()) && (
                                        <div
                                            className={`tag-autocomplete-item tag-autocomplete-create ${filteredTags.length === 0 ? 'active' : ''}`}
                                            onClick={() => addTag(tagSearch)}
                                        >
                                            <span>Create "<strong>{tagSearch}</strong>"</span>
                                            <span className="tag-autocomplete-count">+</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', margin: '0.5rem 0 0', userSelect: 'none' }}>
                            Press <kbd>Enter</kbd> or <kbd>,</kbd> to add
                        </p>
                    </div>
                    <div className="modal-footer" style={{ padding: '1rem 1.5rem', justifyContent: 'flex-end', gap: '0.75rem', marginTop: 0 }}>
                        <button className="btn btn-ghost" onClick={handleCancel}>{options.cancelText || "Cancel"}</button>
                        <button className="btn btn-primary" onClick={handleConfirm}>{options.confirmText || "Apply"}</button>
                    </div>
                </div>
            </div>
        );
    };

    switch (state.type) {
        case "confirm": return renderConfirm();
        case "prompt": return renderPrompt();
        case "tag-picker": return renderTagPicker();
        default: return null;
    }
}
