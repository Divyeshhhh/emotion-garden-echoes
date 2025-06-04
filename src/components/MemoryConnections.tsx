
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Memory } from '../types/Memory';

interface MemoryConnectionsProps {
  memories: Memory[];
  connections: { [memoryId: string]: string[] };
  scene: THREE.Scene;
}

export const MemoryConnections = ({ memories, connections, scene }: MemoryConnectionsProps) => {
  const connectionsGroupRef = useRef<THREE.Group>(new THREE.Group());

  useEffect(() => {
    const connectionsGroup = connectionsGroupRef.current;
    
    // Clear existing connections
    connectionsGroup.clear();
    
    // Create connection lines
    Object.entries(connections).forEach(([memoryId, relatedIds]) => {
      const memory = memories.find(m => m.id === parseInt(memoryId));
      if (!memory || !memory.location) return;

      relatedIds.forEach(relatedId => {
        const relatedMemory = memories.find(m => m.id === parseInt(relatedId));
        if (!relatedMemory || !relatedMemory.location || !memory.location) return;

        // Create line geometry
        const points = [
          new THREE.Vector3(memory.location?.x, 2, memory.location?.z),
          new THREE.Vector3(relatedMemory.location?.x, 2, relatedMemory.location?.z)
        ];
        
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ 
          color: 0x00ff88, 
          opacity: 0.6, 
          transparent: true 
        });
        
        const line = new THREE.Line(geometry, material);
        connectionsGroup.add(line);
      });
    });

    // Add to scene if not already added
    if (!scene.children.includes(connectionsGroup)) {
      scene.add(connectionsGroup);
    }

    return () => {
      connectionsGroup.clear();
    };
  }, [memories, connections, scene]);

  return null; // This is a pure Three.js component
};
