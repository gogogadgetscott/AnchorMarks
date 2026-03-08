import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react";
import { Icon } from "@components/Icon.tsx";

export type ToastType = "success" | "error" | "info" | "warning" | "";

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextValue {
    showToast: (message: string, type?: ToastType) => void;
    hideToast: (id: string) => void;
}

let showToastDispatcher: (message: string, type?: ToastType) => void = () => {
    console.warn("Toast dispatcher not registered");
};

export const registerToastDispatcher = (
    dispatcher: (message: string, type?: ToastType) => void,
) => {
    showToastDispatcher = dispatcher;
};

export const showToast = (message: string, type?: ToastType) => {
    showToastDispatcher(message, type);
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const hideToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const showToastLocal = useCallback((message: string, type: ToastType = "info") => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts((prev) => [...prev, { id, message, type }]);

        // Auto-hide after 3 seconds
        setTimeout(() => hideToast(id), 3000);
    }, [hideToast]);

    useEffect(() => {
        registerToastDispatcher(showToastLocal);
    }, [showToastLocal]);

    return (
        <ToastContext.Provider value={{ showToast: showToastLocal, hideToast }}>
            {children}
            <div className="toast-container">
                {toasts.map((toast) => (
                    <div key={toast.id} className={`toast ${toast.type}`}>
                        <span className="toast-message">{toast.message}</span>
                        <button className="toast-close" onClick={() => hideToast(toast.id)}>
                            <Icon name="x" size={14} />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return context;
}
