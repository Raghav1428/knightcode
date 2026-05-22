export type ToastVariant = "success" | "info" | "error";

export type ToastOptions = {
  message: string;
  variant?: ToastVariant;
  duration?: number;
};

export const DEFAULT_DURATION = 3000;
