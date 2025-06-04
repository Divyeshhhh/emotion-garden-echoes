
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

import { zones } from '../data/zones';
import { Memory } from '../types/Memory';
import { analyzeSentiment, autoCompleteText } from '../services/aiService';
import { Wand2, Brain } from 'lucide-react';

interface MemoryFormProps {
  onSubmit: (memory: Omit<Memory, 'id'>) => void;
  onClose: () => void;
}

export const MemoryForm = ({ onSubmit, onClose }: MemoryFormProps) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    emotion: 'joy',
    date: new Date().toISOString().split('T')[0],
    intensity: 5
  });
  const [apiKey, setApiKey] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAutoCompleting, setIsAutoCompleting] = useState(false);

  const handleAutoSentiment = async () => {
    if (!formData.description) return;

    setIsAnalyzing(true);
    try {
      const detectedEmotion = await analyzeSentiment(formData.description);
      setFormData(prev => ({ ...prev, emotion: detectedEmotion }));
    } catch (error) {
      console.error('Sentiment analysis failed:', error);
    }
    setIsAnalyzing(false);
  };

  const handleAutoComplete = async () => {
    if (!formData.description) return;

    setIsAutoCompleting(true);
    try {
      const completion = await autoCompleteText(formData.description);
      setFormData(prev => ({
        ...prev,
        description: prev.description + (completion ? ' ' + completion : '')
      }));
    } catch (error) {
      console.error('Auto-completion failed:', error);
    }
    setIsAutoCompleting(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      createdAt: new Date(),
      intensity: Number(formData.intensity)
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-20">
      <Card className="w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle className="text-center">Plant a New Memory</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Memory Title</label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="What happened?"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Date</label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Emotion</label>
              <div className="flex gap-2">
                <Select
                  value={formData.emotion}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, emotion: value }))}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(zones).map(([key, zone]) => (
                      <SelectItem key={key} value={key}>
                        {zone.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAutoSentiment}
                  disabled={isAnalyzing || !formData.description}
                >
                  <Brain className="w-4 h-4" />
                  {isAnalyzing ? 'Analyzing...' : 'AI Detect'}
                </Button>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">
                Intensity ({formData.intensity}/10)
              </label>
              <Input
                type="range"
                min="1"
                max="10"
                value={formData.intensity}
                onChange={(e) => setFormData(prev => ({ ...prev, intensity: Number(e.target.value) }))}
                className="w-full"
              />
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium">Description</label>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAutoComplete}
                    disabled={isAutoCompleting || !formData.description}
                  >
                    <Wand2 className="w-4 h-4" />
                    {isAutoCompleting ? 'Completing...' : 'AI Complete'}
                  </Button>
                </div>
              </div>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Tell the full story of this memory..."
                rows={4}
                required
              />
            </div>
            
            <div className="flex gap-2">
              <Button type="submit" className="flex-1">
                Plant Memory
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
