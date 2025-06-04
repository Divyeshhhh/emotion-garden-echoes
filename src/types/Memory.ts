
export interface Memory {
  id: string;
  title: string;
  description: string;
  emotion: string;
  date: string;
  intensity: number;
  createdAt: Date;
  position?: {
    x: number;
    z: number;
  };
  relatedMemories?: string[];
}
