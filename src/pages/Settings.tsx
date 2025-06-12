import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Lock, Mail, Shield, Check, RefreshCw, User, Bell, ChevronRight } from 'lucide-react';
import ImageCropper from '../components/ImageCropper';
import { UserSettings as UserSettingsType } from '../types';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getUserSettingsFromStorage, updateUserSettings } from '../utils/storageUtils';
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from '@/components/ui/slider';

const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [profilePicture, setProfilePicture] = useState('');
  const [darkMode, setDarkMode] = useState(false);
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
  const [verificationMethod, setVerificationMethod] = useState<'email' | 'sms' | 'authenticator'>('authenticator');
  const [setupStep, setSetupStep] = useState(1);
  const [twoFactorCode, setTwoFactorCode] = useState("");

  // Notification settings
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [desktopNotifications, setDesktopNotifications] = useState(true);

// Sound settings
  const [soundsEnabled, toggleSoundEffects] = useState(true);

  useEffect(() => {
    const settings = getUserSettingsFromStorage();
    setFullName(settings.fullName);
    setEmail(settings.email);
    setProfilePicture(settings.profilePicture);
    setDarkMode(settings.darkMode);
  }, []);

  useEffect(() => {
    if (croppedImage) {
      setProfilePicture(croppedImage);
      setShowCropper(false);

      const newSettings = getUserSettingsFromStorage();
      updateUserSettings({
        ...newSettings,
        profilePicture: croppedImage
      });
    }
  }, [croppedImage]);

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

  const handleCancel = () => {
    const originalSettings = getUserSettingsFromStorage();
    navigate(-1);
  };

  const handleSave = () => {
    const newSettings = {
      fullName,
      email,
      profilePicture,
      darkMode,
    };
    
    updateUserSettings(newSettings);
    
    toast({
      title: "Settings saved",
      description: "Your settings have been updated successfully",
    });
    
    navigate(-1);
  };

  const handleDisableTwoFactor = () => {
    setTwoFactorEnabled(false);
    toast({
      title: "2FA Disabled",
      description: "Two-factor authentication has been disabled for your account",
    });
  };

  const goToNextSetupStep = () => {
    if (setupStep === 1) {
      setSetupStep(2);
    } else {
      setTwoFactorEnabled(true);
      setShowQRCode(false);
      setTwoFactorCode("");
      setSetupStep(1);
      toast({
        title: "2FA Enabled",
        description: "Two-factor authentication has been enabled for your account",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-2xl space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
          <Button variant="ghost" size="icon" onClick={handleCancel}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="space-y-6">
          {/* Profile Section */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <User className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-medium">Profile</h2>
              </div>

              <div className="flex items-start space-x-6 mb-8">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full overflow-hidden bg-muted ring-2 ring-muted-foreground/10">
                    <img src={profilePicture} alt="Profile" className="w-full h-full object-cover" />
                  </div>
                  <input
                    type="file"
                    id="profilePicture"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                  <label 
                    htmlFor="profilePicture" 
                    className="absolute -bottom-2 -right-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full p-1.5 cursor-pointer shadow-sm transition-colors"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </label>
                </div>
                <div className="flex-1 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Name</Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="max-w-sm"
                    />
                  </div>
                </div>
              </div>

              <Separator className="my-6" />

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="email"
                      value={email}
                      readOnly
                      disabled
                      className="flex-1 max-w-sm bg-muted/50"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowEmailChange(true)}
                      className="shrink-0"
                    >
                      Change
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security Section */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <Shield className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-medium">Security</h2>
              </div>

              <div className="space-y-4">
                <button
                  onClick={() => setShowPasswordChange(true)}
                  className="w-full group text-left"
                >
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <div className="flex items-center gap-3">
                      <Lock className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <h3 className="font-medium">Password</h3>
                        <p className="text-sm text-muted-foreground">Change your password</p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </div>
                </button>

                <button
                  onClick={() => setShowQRCode(true)}
                  className="w-full group text-left"
                >
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <div className="flex items-center gap-3">
                      <Shield className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <h3 className="font-medium">Two-Factor Authentication</h3>
                        <p className="text-sm text-muted-foreground">
                          {twoFactorEnabled ? "Enabled" : "Not enabled"}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </div>
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Notifications Section */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <Bell className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-medium">Notifications</h2>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive email updates about your account
                    </p>
                  </div>
                  <Switch
                    checked={emailNotifications}
                    onCheckedChange={setEmailNotifications}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Desktop Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified about important updates
                    </p>
                  </div>
                  <Switch
                    checked={desktopNotifications}
                    onCheckedChange={setDesktopNotifications}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        
        
          {/* Sounds section */}
          <Card>
            <CardContent className='p-6'>
              {/* Titulo de la carta */}
              <div className="flex items-center gap-3 mb-6">
                <Speaker className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-medium">Sounds</h2>
              </div>
              {/* Contenido de la carta */}
              <div className="space-y-4">
                {/* Apartado en la carta */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable/Disable</Label>
                    <p className="text-sm text-muted-foreground">
                      Activate or desactivate the sounds.
                    </p>
                  </div>
                  <Switch
                    checked={soundsEnabled}
                    onCheckedChange={toggleSoundEffects}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Bar</Label>
                    <p className="text-sm text-muted-foreground"> 
                     Volume
                    </p>
                  </div>
                  <Slider
                    min={0}
                    max={1}
                    step={0.1}
                  />
                </div>

              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </div>
      </div>

      {showCropper && tempImageSrc && (
        <ImageCropper
          src={tempImageSrc}
          onCrop={setCroppedImage}
          onCancel={() => setShowCropper(false)}
        />
      )}
    </div>
  );
};

export default Settings;
