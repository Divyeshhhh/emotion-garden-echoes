export interface MemoryFormData {
  date: string;
  text: string;
  emotion: string;
  location?: {
    x: number;
    y: number;
    z: number;
  };
  audio?: string;
  tags?: string[];
}
