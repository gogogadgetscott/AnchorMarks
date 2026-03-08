import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

export interface ConfirmOptions {
  title?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

export interface PromptOptions extends ConfirmOptions {
  placeholder?: string;
  defaultValue?: string;
}

export interface TagPickerOptions extends ConfirmOptions {
  initialTags?: string[];
  selectionCount?: number;
}

type DialogType = "confirm" | "prompt" | "tag-picker" | null;

interface ConfirmState {
  type: DialogType;
  message: string;
  options: any;
  resolve: (value: any) => void;
}

interface ConfirmContextValue {
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
  prompt: (message: string, options?: PromptOptions) => Promise<string | null>;
  tagPicker: (options?: TagPickerOptions) => Promise<string[] | null>;
  state: ConfirmState | null;
  close: () => void;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

let globalDispatcher:
  | ((type: DialogType, message: string, options: any) => Promise<any>)
  | null = null;

export function registerConfirmDispatcher(
  dispatcher: (type: DialogType, message: string, options: any) => Promise<any>,
) {
  globalDispatcher = dispatcher;
}

export async function showConfirm(
  message: string,
  options?: ConfirmOptions,
): Promise<boolean> {
  if (globalDispatcher) return globalDispatcher("confirm", message, options);
  return window.confirm(message);
}

export async function showPrompt(
  message: string,
  options?: PromptOptions,
): Promise<string | null> {
  if (globalDispatcher) return globalDispatcher("prompt", message, options);
  return window.prompt(message, options?.defaultValue);
}

export async function showTagPicker(
  options?: TagPickerOptions,
): Promise<string[] | null> {
  if (globalDispatcher) return globalDispatcher("tag-picker", "", options);
  return null;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null);

  const openDialog = useCallback(
    (type: DialogType, message: string, options: any) => {
      return new Promise((resolve) => {
        setState({ type, message, options, resolve });
      });
    },
    [],
  );

  const close = useCallback(() => {
    if (state?.resolve) state.resolve(null);
    setState(null);
  }, [state]);

  const confirm = useCallback(
    (message: string, options?: ConfirmOptions) => {
      return openDialog("confirm", message, options) as Promise<boolean>;
    },
    [openDialog],
  );

  const prompt = useCallback(
    (message: string, options?: PromptOptions) => {
      return openDialog("prompt", message, options) as Promise<string | null>;
    },
    [openDialog],
  );

  const tagPicker = useCallback(
    (options?: TagPickerOptions) => {
      return openDialog("tag-picker", "", options) as Promise<string[] | null>;
    },
    [openDialog],
  );

  // Register global dispatcher
  React.useEffect(() => {
    registerConfirmDispatcher(async (type, message, options) => {
      return openDialog(type, message, options);
    });
  }, [openDialog]);

  const value: ConfirmContextValue = {
    confirm,
    prompt,
    tagPicker,
    state,
    close,
  };

  return (
    <ConfirmContext.Provider value={value}>{children}</ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmContextValue {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}
