
import { MemoryGarden } from "@/components/MemoryGarden";
import { Memory } from "@/types/Memory";
import { useState } from "react";

const Index = () => {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [currentZone, setCurrentZone] = useState<string>("default");
  const [showConnections, setShowConnections] = useState<boolean>(false);

  const handleAddMemory = (memory: Memory) => {
    setMemories(prev => [...prev, memory]);
  };

  const handleMemorySelect = (memory: Memory) => {
    setSelectedMemory(memory);
  };

  const handleZoneChange = (zone: string) => {
    setCurrentZone(zone);
  };

  const handleToggleConnections = () => {
    setShowConnections(prev => !prev);
  };

  return (
    <div className="w-full h-screen overflow-hidden">
      <MemoryGarden
        memories={memories}
        selectedMemory={selectedMemory}
        currentZone={currentZone}
        showConnections={showConnections}
        onAddMemory={handleAddMemory}
        onMemorySelect={handleMemorySelect}
        onZoneChange={handleZoneChange}
        onToggleConnections={handleToggleConnections}
      />
    </div>
  );
};

export default Index;
