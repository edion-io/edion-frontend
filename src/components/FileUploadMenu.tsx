import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cloud,
  FileUp,
  Upload,
  X,
  Paperclip,
  FileText,
  File
} from 'lucide-react';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface FileUploadMenuProps {
  onFileSelect?: (file: File) => void;
  triggerClassName?: string;
  triggerIconClassName?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
  showMobile?: boolean;
  disableResponsive?: boolean;
  accept?: string;
  maxSize?: number;
  multiple?: boolean;
}

const FileUploadMenu: React.FC<FileUploadMenuProps> = ({
  onFileSelect,
  triggerClassName,
  triggerIconClassName,
  position = 'top',
  align = 'center',
  sideOffset = 10,
  showMobile = true,
  disableResponsive = false,
  accept = '*',
  maxSize = 10 * 1024 * 1024, // 10MB default
  multiple = false,
}) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      for (const file of files) {
        if (file.size > maxSize) {
          toast({
            title: "File too large",
            description: `${file.name} exceeds the ${(maxSize / 1024 / 1024).toFixed(0)}MB limit`,
            variant: "destructive"
          });
          continue;
        }
        
        if (onFileSelect) {
          onFileSelect(file);
        }
        
        toast({
          title: "File selected",
          description: `${file.name} (${(file.size / 1024).toFixed(1)} KB)`,
        });
      }
    }
    // Reset file input
    e.target.value = '';
  };
  
  const handleLocalUpload = () => {
    fileInputRef.current?.click();
  };
  
  const handleGoogleDrive = () => {
    toast({
      title: "Google Drive",
      description: "Google Drive integration is coming soon",
    });
  };
  
  const handleOneDrive = () => {
    toast({
      title: "Microsoft OneDrive",
      description: "OneDrive integration is coming soon",
    });
  };
  
  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: 'none' }}
        accept={accept}
        multiple={multiple}
        aria-label="File input"
      />
      
      <Popover>
        <PopoverTrigger asChild>
          <button 
            type="button" 
            className={cn(
              disableResponsive ? "p-1" : "p-1.5 sm:p-2",
              "hover:bg-gray-200/70 dark:hover:bg-gray-700/70 rounded-lg text-gray-500 dark:text-gray-400 backdrop-blur-sm",
              triggerClassName,
              showMobile ? "" : "hidden sm:block"
            )}
            aria-label="Attach file"
            aria-haspopup="true"
            aria-expanded="false"
          >
            <Paperclip className={cn(
              disableResponsive ? "w-3.5 h-3.5" : "h-4 w-4 sm:w-5 sm:h-5",
              triggerIconClassName
            )} />
          </button>
        </PopoverTrigger>
        <PopoverContent 
          side={position} 
          align={align} 
          sideOffset={sideOffset}
          className="w-56 p-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl"
          role="menu"
          aria-label="File upload options"
        >
          <div className="p-1.5">
            <div className="space-y-1">
              <button
                onClick={handleLocalUpload}
                className="w-full flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm h-10"
              >
                <Upload className="h-5 w-5 text-blue-500" />
                <span>Upload from computer</span>
              </button>
              
              <button
                onClick={handleGoogleDrive}
                className="w-full flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm h-10"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 87.3 78" className="h-5 w-5">
                  <title>Google Drive</title>
                  <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                  <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
                  <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                  <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                  <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                  <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                </svg>
                <span>Google Drive</span>
              </button>
              
              <button
                onClick={handleOneDrive}
                className="w-full flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm h-10"
              >

                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 34" className="h-5 w-5">
                  <title>OneDrive</title>
                  <g id="STYLE_COLOR">
                    <path d="M12.20245,11.19292l.00031-.0011,6.71765,4.02379,4.00293-1.68451.00018.00068A6.4768,6.4768,0,0,1,25.5,13c.14764,0,.29358.0067.43878.01639a10.00075,10.00075,0,0,0-18.041-3.01381C7.932,10.00215,7.9657,10,8,10A7.96073,7.96073,0,0,1,12.20245,11.19292Z" fill="#0364b8"/>
                    <path d="M12.20276,11.19182l-.00031.0011A7.96073,7.96073,0,0,0,8,10c-.0343,0-.06805.00215-.10223.00258A7.99676,7.99676,0,0,0,1.43732,22.57277l5.924-2.49292,2.63342-1.10819,5.86353-2.46746,3.06213-1.28859Z" fill="#0078d4"/>
                    <path d="M25.93878,13.01639C25.79358,13.0067,25.64764,13,25.5,13a6.4768,6.4768,0,0,0-2.57648.53178l-.00018-.00068-4.00293,1.68451,1.16077.69528L23.88611,18.19l1.66009.99438,5.67633,3.40007a6.5002,6.5002,0,0,0-5.28375-9.56805Z" fill="#1490df"/>
                    <path d="M25.5462,19.18437,23.88611,18.19l-3.80493-2.2791-1.16077-.69528L15.85828,16.5042,9.99475,18.97166,7.36133,20.07985l-5.924,2.49292A7.98889,7.98889,0,0,0,8,26H25.5a6.49837,6.49837,0,0,0,5.72253-3.41556Z" fill="#28a8ea"/>
                  </g>
                </svg>
                <span>OneDrive</span>
              </button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
};

export default FileUploadMenu;
