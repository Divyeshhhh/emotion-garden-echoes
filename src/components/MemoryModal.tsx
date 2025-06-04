
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Memory } from '../types/Memory';
import { zones } from '../data/zones';

interface MemoryModalProps {
  memory: Memory;
  onClose: () => void;
}

export const MemoryModal = ({ memory, onClose }: MemoryModalProps) => {
  const zone = zones[memory.emotion];
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-20">
      <Card className="w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">{memory.title}</CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              ✕
            </Button>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Badge 
              style={{ 
                backgroundColor: zone.colors.primary,
                color: zone.colors.text || 'white'
              }}
            >
              {zone.name}
            </Badge>
            <span>{memory.date}</span>
            <span>Intensity: {memory.intensity}/10</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Memory Description</h3>
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                {memory.description}
              </p>
            </div>
            
            <div className="text-xs text-gray-500">
              Created: {memory.createdAt.toLocaleDateString()}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
