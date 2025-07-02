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

export const showFileSelectedToast = (fileName: string, fileSize: string) => {
  toast("File selected", {
    description: `${fileName} (${fileSize})`,
    duration: 3000,
  });
};

export const showFileTooLargeToast = (fileName: string, maxSize: string) => {
  toast("File too large", {
    description: `${fileName} exceeds the ${maxSize} limit`,
    duration: 4000,
  });
};

export const showSettingsSavedToast = () => {
  toast("Settings saved", {
    description: "Your settings have been updated successfully",
    duration: 3000,
  });
};

export const showPasswordUpdatedToast = () => {
  toast("Password updated", {
    description: "Your password has been changed successfully",
    duration: 3000,
  });
};

export const showEmailUpdatedToast = () => {
  toast("Email updated", {
    description: "Your email has been changed successfully",
    duration: 3000,
  });
};

export const showVerificationCodeSentToast = (email: string) => {
  toast("Verification code sent", {
    description: `We've sent a verification code to ${email}`,
    duration: 4000,
  });
};

export const show2FAEnabledToast = () => {
  toast("2FA Enabled", {
    description: "Two-factor authentication has been enabled for your account",
    duration: 4000,
  });
};

export const show2FADisabledToast = () => {
  toast("2FA Disabled", {
    description: "Two-factor authentication has been disabled for your account",
    duration: 4000,
  });
};

export const showErrorToast = (title: string, description: string) => {
  toast(title, {
    description,
    duration: 4000,
  });
};

export const showGoogleDriveToast = () => {
  toast("Google Drive", {
    description: "Google Drive integration is coming soon",
    duration: 3000,
  });
};

export const showOneDriveToast = () => {
  toast("Microsoft OneDrive", {
    description: "OneDrive integration is coming soon",
    duration: 3000,
  });
}; 