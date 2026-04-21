import * as React from "react";
import { toast as sonnerToast } from "sonner";

type ToastInput = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  variant?: "default" | "destructive";
};

function toast({
  title,
  description,
  action,
  variant = "default",
}: ToastInput) {
  const message = title ?? description ?? "";

  const options = {
    description: title && description ? description : undefined,
    action,
  };

  if (variant === "destructive") {
    return sonnerToast.error(message as React.ReactNode, options);
  }

  return sonnerToast(message as React.ReactNode, options);
}

function useToast() {
  return {
    toast,
    dismiss: (toastId?: string | number) => sonnerToast.dismiss(toastId),
    toasts: [],
  };
}

export { useToast, toast };
