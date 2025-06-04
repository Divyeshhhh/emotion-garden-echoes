export interface Memory {
  id: number;
  title: string;
  description: string;
  emotion: string;
  intensity: number;
  createdAt: Date;
  date: string;
  audio?: string;
  location?: {
    x: number;
    y: number;
    z: number;
  };
  relatedMemories?: string[];
}
