import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { X } from 'lucide-react';

interface BackgroundSelectorProps {
  onSelect: (imageUrl: string) => void;
  onClose: () => void;
  initialSelectedBg?: string; // Optional prop for initially selected background
}

const backgroundOptions = [
  {
    id: 1,
    url: "/images/profile-bg-1.jpg",
    label: "Gradient 1"
  },
  {
    id: 2,
    url: "/images/profile-bg-2.jpg",
    label: "Gradient 2"
  },
  {
    id: 3,
    url: "/images/profile-bg-3.jpg",
    label: "Gradient 3"
  }
];

export const BackgroundSelector = ({ onSelect, onClose, initialSelectedBg }: BackgroundSelectorProps) => {
  const [selectedBg, setSelectedBg] = useState<string | null>(initialSelectedBg || backgroundOptions[0].url);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#121021] rounded-xl p-6 max-w-2xl w-full border border-[#5d43ef]/20">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold text-white">Select Background</h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {backgroundOptions.map((bg) => (
            <div 
              key={bg.id}
              onClick={() => setSelectedBg(bg.url)}
              className={`relative rounded-lg overflow-hidden cursor-pointer transition-all duration-200 border-2 ${
                selectedBg === bg.url 
                  ? 'border-[#5d43ef] ring-2 ring-[#5d43ef] ring-offset-2 ring-offset-[#121021]' 
                  : 'border-transparent hover:border-white/30'
              }`}
            >
              <img 
                src={bg.url} 
                alt={bg.label}
                className="w-full h-32 object-cover"
              />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <span className="text-white text-sm font-medium">
                  {selectedBg === bg.url ? 'Selected' : 'Select'}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-gray-600 text-white hover:bg-gray-700/50"
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (selectedBg) {
                onSelect(selectedBg);
              }
              onClose();
            }}
            disabled={!selectedBg}
            className="bg-[#5d43ef] hover:bg-[#5d43ef]/90 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Apply Background
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BackgroundSelector;
