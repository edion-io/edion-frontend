import React from "react";
import { toast } from "sonner";
import { HiTrash } from "react-icons/hi";

export const showChatDeletedToast = (undoDelete?: () => void) => {
  toast("Chat deleted", {
    description: "This conversation has been removed.",
    icon: React.createElement(HiTrash, { className: "h-5 w-5 text-red-600 dark:text-red-300" }),
    action: undoDelete ? {
      label: "Undo",
      onClick: () => undoDelete(), 
    } : undefined,
    duration: 5000,
  });
};

export const showChatCreatedToast = () => {
  toast("New chat created", {
    description: "Ready to start a new conversation.",
    duration: 3000,
  });
};

export const showFileUploadToast = (fileName: string) => {
  toast("File uploaded", {
    description: `${fileName} has been added to the conversation.`,
    duration: 3000,
  });
}; 