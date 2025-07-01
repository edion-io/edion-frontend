import React, { useState, useEffect, useCallback } from 'react';
import { X, Lock, Mail, Shield, Check, RefreshCw } from 'lucide-react';
import ImageCropper from './ImageCropper';
import { UserSettings as UserSettingsType } from '../types';
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface UserSettingsProps {
  settings: UserSettingsType;
  onClose: () => void;
  onSave: (settings: UserSettingsType) => void;
}

type VerificationMethod = 'email' | 'sms' | 'authenticator';

const UserSettings: React.FC<UserSettingsProps> = ({ settings, onClose, onSave }) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<string>("profile");
  const [username, setUsername] = useState(settings.username);
  const [fullName, setFullName] = useState(settings.fullName);
  const [email, setEmail] = useState(settings.email);
  const [profilePicture, setProfilePicture] = useState(settings.profilePicture);
  const [darkMode, setDarkMode] = useState(settings.darkMode);
  const [tempImageSrc, setTempImageSrc] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [croppedImage, setCroppedImage] = useState<string | null>(null);

  // Password change state
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // Email change state
  const [showEmailChange, setShowEmailChange] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  
  // 2FA state
  const [showQRCode, setShowQRCode] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [verificationMethod, setVerificationMethod] = useState<VerificationMethod>('authenticator');
  const [setupStep, setSetupStep] = useState(1);
  const [twoFactorCode, setTwoFactorCode] = useState("");

  // We'll use the original settings as a reference so we can revert if needed
  const originalDarkMode = settings.darkMode;

  useEffect(() => {
    if (croppedImage) {
      setProfilePicture(croppedImage);
      setShowCropper(false);
    }
  }, [croppedImage]);

  // Apply dark mode in real-time when the toggle changes
  useEffect(() => {
    // Apply dark mode to document based on current state
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode, originalDarkMode]);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setTempImageSrc(reader.result as string);
        setShowCropper(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClose = () => {
    // Revert to original settings if user closes without saving
    setDarkMode(originalDarkMode);
    
    // Make sure the document class matches the original dark mode setting
    if (originalDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    onClose();
  };

  const handleBackdropClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Only close if user clicks the actual backdrop (not any children)
    if (e.target === e.currentTarget) {
      e.preventDefault();
      handleClose();
    }
  }, []);

  const handleSave = () => {
    const newSettings = {
      username,
      fullName,
      email,
      profilePicture,
      darkMode,
    };
    onSave(newSettings);
    toast({
      title: "Settings saved",
      description: "Your settings have been updated successfully",
      variant: "success"
    });
    onClose();
  };

  const handleChangePassword = () => {
    // Validate passwords
    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords don't match",
        variant: "destructive"
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: "Error",
        description: "Password must be at least 8 characters long",
        variant: "destructive"
      });
      return;
    }

    // In a real app, you would send the passwords to your backend here
    // For this example, we'll just simulate success
    toast({
      title: "Password updated",
      description: "Your password has been changed successfully",
      variant: "success"
    });
    setShowPasswordChange(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleChangeEmail = () => {
    if (!emailSent) {
      // Validate email
      if (!newEmail.includes('@') || !newEmail.includes('.')) {
        toast({
          title: "Error",
          description: "Please enter a valid email address",
          variant: "destructive"
        });
        return;
      }

      // In a real app, you would send the verification code to the new email
      // For this example, we'll just simulate success
      setEmailSent(true);
      toast({
        title: "Verification code sent",
        description: `We've sent a verification code to ${newEmail}`,
        variant: "success"
      });
    } else {
      // Verify the code
      if (verificationCode !== "123456") { // Demo code
        toast({
          title: "Error",
          description: "Invalid verification code. For this demo, use 123456",
          variant: "destructive"
        });
        return;
      }

      setEmail(newEmail);
      setShowEmailChange(false);
      setNewEmail("");
      setEmailPassword("");
      setVerificationCode("");
      setEmailSent(false);
      toast({
        title: "Email updated",
        description: "Your email has been changed successfully",
        variant: "success"
      });
    }
  };

  const goToNextSetupStep = () => {
    if (setupStep === 1) {
      setSetupStep(2);
    } else if (setupStep === 2) {
      // Verify the code
      if (twoFactorCode !== "123456") { // Demo code
        toast({
          title: "Error",
          description: "Invalid verification code. For this demo, use 123456",
          variant: "destructive"
        });
        return;
      }
      
      setTwoFactorEnabled(true);
      setShowQRCode(false);
      setSetupStep(1);
      setTwoFactorCode("");
      toast({
        title: "2FA Enabled",
        description: "Two-factor authentication has been enabled for your account",
        variant: "success"
      });
    }
  };

  const handleDisableTwoFactor = () => {
    setTwoFactorEnabled(false);
    toast({
      title: "2FA Disabled",
      description: "Two-factor authentication has been disabled for your account",
      variant: "success"
    });
  };

  const handleTabClick = (e: React.MouseEvent) => {
    console.log('Tab container clicked');
    e.stopPropagation();
  };

  const handlePreferencesTabClick = (e: React.MouseEvent) => {
    console.log('Preferences tab clicked');
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    setActiveTab("preferences");
  };

  const TabContent = ({ activeTab }: { activeTab: string }) => {
    switch (activeTab) {
      case 'profile':
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold mb-4">Profile Settings</h2>
            <div className="space-y-6">
              <div className="mb-4">
                <label htmlFor="profilePicture" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
                  Profile Picture
                </label>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="relative w-20 h-20 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800">
                    <img src={profilePicture} alt="Profile" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-grow">
                    <input
                      type="file"
                      id="profilePicture"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                    <label 
                      htmlFor="profilePicture" 
                      className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-md transition-colors duration-150 cursor-pointer w-full sm:w-auto"
                    >
                      Change Profile Picture
                    </label>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                      Recommended: Square image, at least 400x400px
                    </p>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <label htmlFor="username" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
                  Username
                </label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:shadow-outline dark:bg-gray-700 dark:border-gray-500"
                />
              </div>

              <div className="mb-4">
                <label htmlFor="fullName" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
                  Full Name
                </label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:shadow-outline dark:bg-gray-700 dark:border-gray-500"
                />
              </div>

              <div className="mb-4">
                <label htmlFor="email" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
                  Email
                </label>
                <div className="flex items-center space-x-2">
                  <div className="flex-grow">
                    <Input
                      id="email"
                      value={email}
                      readOnly
                      disabled
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:shadow-outline dark:border-gray-500 bg-gray-100 dark:bg-gray-800"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowEmailChange(true);
                      setActiveTab("security");
                    }}
                  >
                    Change
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      case 'security':
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold mb-4">Security Settings</h2>
            <div className="space-y-6">
              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <h3 className="text-base font-medium mb-2">Two-Factor Authentication</h3>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Shield className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {twoFactorEnabled ? "Enabled" : "Add an extra layer of security"}
                      </p>
                    </div>
                  </div>
                  <Button 
                    onClick={() => {
                      if (twoFactorEnabled) {
                        handleDisableTwoFactor();
                      } else {
                        setShowQRCode(true);
                      }
                    }} 
                    variant="outline"
                  >
                    {twoFactorEnabled ? "Disable" : "Enable"}
                  </Button>
                </div>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <h3 className="text-base font-medium mb-2">Change Password</h3>
                {!showPasswordChange && !showEmailChange && !showQRCode && (
                  <>
                    <div className="mb-4 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Lock className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                          <div>
                            <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200">Password</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Change your password</p>
                          </div>
                        </div>
                        <Button 
                          onClick={() => setShowPasswordChange(true)} 
                          variant="outline"
                        >
                          Change
                        </Button>
                      </div>
                    </div>
                  
                    <div className="mb-4 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Mail className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                          <div>
                            <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200">Email</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Change your email address</p>
                          </div>
                        </div>
                        <Button 
                          onClick={() => setShowEmailChange(true)} 
                          variant="outline"
                        >
                          Change
                        </Button>
                      </div>
                    </div>
                  </>
                )}

                {showPasswordChange && (
                  <div className="space-y-4">
                    <div className="mb-4">
                      <label htmlFor="currentPassword" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
                        Current Password
                      </label>
                      <Input
                        id="currentPassword"
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:shadow-outline dark:bg-gray-700 dark:border-gray-500"
                      />
                    </div>
                    
                    <div className="mb-4">
                      <label htmlFor="newPassword" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
                        New Password
                      </label>
                      <Input
                        id="newPassword"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:shadow-outline dark:bg-gray-700 dark:border-gray-500"
                      />
                    </div>
                    
                    <div className="mb-4">
                      <label htmlFor="confirmPassword" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
                        Confirm New Password
                      </label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:shadow-outline dark:bg-gray-700 dark:border-gray-500"
                      />
                    </div>
                    
                    <div className="flex justify-end space-x-2">
                      <Button 
                        variant="outline"
                        onClick={() => {
                          setShowPasswordChange(false);
                          setCurrentPassword("");
                          setNewPassword("");
                          setConfirmPassword("");
                        }}
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleChangePassword}>Save Password</Button>
                    </div>
                  </div>
                )}

                {showEmailChange && (
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Change Email</h3>
                    
                    {!emailSent ? (
                      <>
                        <div className="mb-4">
                          <label htmlFor="newEmail" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
                            New Email Address
                          </label>
                          <Input
                            id="newEmail"
                            type="email"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:shadow-outline dark:bg-gray-700 dark:border-gray-500"
                          />
                        </div>
                        
                        <div className="mb-4">
                          <label htmlFor="emailPassword" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
                            Password (to confirm it's you)
                          </label>
                          <Input
                            id="emailPassword"
                            type="password"
                            value={emailPassword}
                            onChange={(e) => setEmailPassword(e.target.value)}
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:shadow-outline dark:bg-gray-700 dark:border-gray-500"
                          />
                        </div>
                      </>
                    ) : (
                      <div className="mb-4">
                        <p className="mb-4 text-gray-700 dark:text-gray-300">
                          We've sent a verification code to <strong>{newEmail}</strong>.
                          Please check your inbox and enter the code below.
                        </p>
                        <label htmlFor="verificationCode" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
                          Verification Code
                        </label>
                        <Input
                          id="verificationCode"
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value)}
                          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:shadow-outline dark:bg-gray-700 dark:border-gray-500"
                          placeholder="Enter 6-digit code"
                        />
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                          For this demo, use the code: <strong>123456</strong>
                        </p>
                      </div>
                    )}
                    
                    <div className="flex justify-end space-x-2">
                      <Button 
                        variant="outline"
                        onClick={() => {
                          setShowEmailChange(false);
                          setNewEmail("");
                          setEmailPassword("");
                          setVerificationCode("");
                          setEmailSent(false);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleChangeEmail}>
                        {emailSent ? "Verify" : "Send Verification Code"}
                      </Button>
                    </div>
                  </div>
                )}

                {showQRCode && (
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Set Up Two-Factor Authentication</h3>
                    
                    {setupStep === 1 && (
                      <>
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4">
                          <div className="text-center">
                            <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-2">Choose Verification Method</h4>
                            <div className="grid grid-cols-3 gap-4 mt-4">
                              <button
                                className={`p-4 rounded-lg border ${verificationMethod === 'authenticator' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700'}`}
                                onClick={() => setVerificationMethod('authenticator')}
                              >
                                <div className="flex flex-col items-center">
                                  <RefreshCw className="h-6 w-6 mb-2 text-gray-700 dark:text-gray-300" />
                                  <span className="text-sm">Authenticator App</span>
                                </div>
                              </button>
                              <button
                                className={`p-4 rounded-lg border ${verificationMethod === 'sms' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700'}`}
                                onClick={() => setVerificationMethod('sms')}
                              >
                                <div className="flex flex-col items-center">
                                  <Mail className="h-6 w-6 mb-2 text-gray-700 dark:text-gray-300" />
                                  <span className="text-sm">SMS</span>
                                </div>
                              </button>
                              <button
                                className={`p-4 rounded-lg border ${verificationMethod === 'email' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700'}`}
                                onClick={() => setVerificationMethod('email')}
                              >
                                <div className="flex flex-col items-center">
                                  <Mail className="h-6 w-6 mb-2 text-gray-700 dark:text-gray-300" />
                                  <span className="text-sm">Email</span>
                                </div>
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                          <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-2">
                            {verificationMethod === 'authenticator' ? 'Scan QR Code with Authenticator App' : 
                             verificationMethod === 'sms' ? 'We\'ll send a code to your phone' : 
                             'We\'ll send a code to your email'}
                          </h4>
                          
                          {verificationMethod === 'authenticator' && (
                            <div className="flex justify-center my-4">
                              <div className="p-2 bg-white rounded-lg">
                                <img
                                  src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIQAAACECAYAAABRRIOnAAAAAklEQVR4AewaftIAAAOPSURBVO3BQY4kRxIEQdNA/f/Lun0cPAqodoaHpGz8QWb+g8z8hcz8hcz8hcz8hcz8hcz8xcvLSMhPUjcJU3WT8CR1kzAJnzRJ+Enq3rwcZOYvZOYvZOYvXj6s0jcJm4QndVLdSd0kTOo2CZuETcKTqk3CJ6n7ps3LQWb+Qmb+Qmb+4uWHJdypuwl5UrVJmNRtEiZ1k3Cn7knCT1L3JOEnvXk5yMxfyMxfyMxfvPxPkzAJk7pJ3UnVJEzqJmFStwnbJPw/efNykJm/kJm/kJm/ePnPJEzqTuom4SRhUjcJP6n6SdV/yZuXg8z8hcz8hcz8xcsPq/4kdZMwCU+qJmGTsEl4kjAJd+qeVD1J+Jd583KQmb+Qmb+Qmb94+bAk4U7dJ6mbhDt1k3CnbhKeJJxU3ak7SdhUbRK+6c3LQWZ+X2Z+X2b+4uVlEqZK3SZhUjcJk7AJk7qbhEnCpuqbhE3CSdUm4aRqEjYJJ1UnVT/pzctBZv5CZv5CZv5CZv5CZv5CZv5CZv7i5WWlaptyp+4k4U7dJGwSTuomYVI3CZMwqdokPEl4UrWp+qRN1SZhU/VNb14OMvMXMvMXMvMXLz8sYVI3CZuEO3VPEu7UTcJJ1SZhExKqTqo2CZOwqZqESXhS9U1vXg4y8xcy8xcy8xcvLwl3qp4kbBJOEp5UTcKm6knCpmqTMKm7STipOkk4qZqEJ1WbhDtVn/Tm5SAzfyEzfyEzf/HyZarUTcIm4UnVJNypm4RNOJGQJ1V3Em4S7lSdVG2qvunNy0Fm/kJm/kJm/uLllyV8k7oTCXnSkzYJk7Cp2iScJJxU3al6knAn4UnVJNyp+qQ3LweZ+QuZ+QuZ+YuXl5GQSd0kbBI2VSdVk3CnbhKeJNxJeJIwqZuETdW/7M3LQWZ+X2Z+X2b+4uVlJWFTNQk/Sd2ThEndk4STqjtVk3Cn6qRqU7VJuJNwp2pTdafqm968HGTmL2TmL2TmL15eRkJ+krpJOKnahCdVk7CpOkm4SbhTdSfhScKk7k7Vk4Rv0vdJb14OMvMXMvMXMvMXLx9WVd+k7iTh/5m6ScIm4U7dJGwSTqomYVJ3UrVJmNRtEt68HGTmL2TmL2TmL15+WMKdujsJP0ndJEzCScImTBJOqiZhUrdJeJJwU/VNwqTuJ715OcjMX8jMX8jMX7z8H0vYVN1JOKmahEnYhEl4UrVJmNRNwqRuU3WTMKm7SbhTdafqzctBZv5CZv5CZv5CZv5CZv5CZv5CZv5CZv7DfwDUUMniz7jBLQAAAABJRU5ErkJggg=="
                                  alt="QR Code for 2FA"
                                  className="w-48 h-48"
                                />
                              </div>
                            </div>
                          )}
                          
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {verificationMethod === 'authenticator' ? 
                              "Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)" : 
                              verificationMethod === 'sms' ? 
                              "We'll send a verification code to your phone number" : 
                              "We'll send a verification code to your email address"}
                          </p>
                        </div>
                      </>
                    )}
                    
                    {setupStep === 2 && (
                      <div className="mb-4">
                        <p className="mb-4 text-gray-700 dark:text-gray-300">
                          {verificationMethod === 'authenticator' ? 
                            "Enter the code from your authenticator app" : 
                            `Enter the verification code sent to your ${verificationMethod === 'sms' ? 'phone' : 'email'}`}
                        </p>
                        <label htmlFor="twoFactorCode" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
                          Verification Code
                        </label>
                        <Input
                          id="twoFactorCode"
                          value={twoFactorCode}
                          onChange={(e) => setTwoFactorCode(e.target.value)}
                          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:shadow-outline dark:bg-gray-700 dark:border-gray-500"
                          placeholder="Enter 6-digit code"
                        />
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                          For this demo, use the code: <strong>123456</strong>
                        </p>
                      </div>
                    )}
                    
                    <div className="flex justify-end space-x-2">
                      <Button 
                        variant="outline"
                        onClick={() => {
                          setShowQRCode(false);
                          setTwoFactorCode("");
                          setSetupStep(1);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button onClick={goToNextSetupStep}>
                        {setupStep === 1 ? "Continue" : "Verify"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      case 'notifications':
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold mb-4">Notification Preferences</h2>
            <div className="space-y-6">
              // ... existing notifications content ...
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="min-h-screen px-4 text-center">
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose}></div>
        <div className="inline-block w-full max-w-2xl my-8 text-left align-middle transform bg-white dark:bg-gray-900 shadow-xl rounded-2xl">
          <div className="relative p-6">
            <button
              onClick={onClose}
              className="absolute right-4 top-4 p-2 text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold mb-6">Settings</h1>
            <Tabs 
              value={activeTab} 
              onValueChange={setActiveTab}
            >
              <TabsList className="grid grid-cols-3 mb-4 rounded-md">
                <TabsTrigger 
                  value="profile" 
                  className="rounded-md data-[state=active]:bg-indigo-50 dark:data-[state=active]:bg-blue-900/20"
                >
                  Profile
                </TabsTrigger>
                <TabsTrigger 
                  value="security" 
                  className="rounded-md data-[state=active]:bg-indigo-50 dark:data-[state=active]:bg-blue-900/20"
                >
                  Security
                </TabsTrigger>
                <TabsTrigger 
                  value="notifications" 
                  className="rounded-md data-[state=active]:bg-indigo-50 dark:data-[state=active]:bg-blue-900/20"
                >
                  Notifications
                </TabsTrigger>
              </TabsList>

              <TabsContent 
                value="profile" 
                className="space-y-4"
                onClick={(e) => {
                  console.log('Profile content clicked');
                  e.stopPropagation();
                }}
              >
                <TabContent activeTab="profile" />
              </TabsContent>

              <TabsContent 
                value="security" 
                className="space-y-4"
                onClick={(e) => {
                  console.log('Security content clicked');
                  e.stopPropagation();
                }}
              >
                <TabContent activeTab="security" />
              </TabsContent>

              <TabsContent 
                value="notifications" 
                className="space-y-4"
                onClick={(e) => {
                  console.log('Notifications content clicked');
                  e.stopPropagation();
                }}
              >
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold mb-4">Notification Preferences</h2>
                  <div className="space-y-6">
                    // ... existing notifications content ...
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {showCropper && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <ImageCropper
                  src={tempImageSrc}
                  onCrop={setCroppedImage}
                  onCancel={() => setShowCropper(false)}
                />
              </div>
            )}

            <div className="flex justify-end space-x-3 mt-6">
              <Button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleClose();
                }} 
                variant="outline"
              >
                Cancel
              </Button>
              <Button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleSave();
                }}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserSettings;
