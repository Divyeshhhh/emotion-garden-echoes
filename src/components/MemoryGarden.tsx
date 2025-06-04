import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { Memory } from '../types/Memory';
import { zones } from '../data/zones';
import { MemoryForm } from './MemoryForm';
import { MemoryModal } from './MemoryModal';
import { MemoryConnections } from './MemoryConnections';
import { Garden3D } from './Garden3D';
import { findRelatedMemories } from '../services/aiService';

interface Connection {
  from: number;
  to: number;
  strength: number;
}

interface MemoryGardenProps {
  memories: Memory[];
  onAddMemory: (memory: Memory) => void;
  selectedMemory: Memory | null;
  onMemorySelect: (memory: Memory) => void;
  currentZone: string;
  onZoneChange: (zone: string) => void;
  showConnections: boolean;
  onToggleConnections: () => void;
}

export const MemoryGarden = ({
  memories,
  selectedMemory,
  currentZone,
  showConnections,
  onAddMemory,
  onMemorySelect,
  onZoneChange,
  onToggleConnections
}: MemoryGardenProps) => {
  const [showForm, setShowForm] = useState<boolean>(false);
  const [connections, setConnections] = useState<Connection[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene>(new THREE.Scene());
  const cameraRef = useRef<THREE.PerspectiveCamera>(new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000));
  const rendererRef = useRef<THREE.WebGLRenderer>(new THREE.WebGLRenderer({ antialias: true }));
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const keysRef = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false
  });
  const [isDragging, setIsDragging] = useState(false);
  const [draggedTree, setDraggedTree] = useState<THREE.Object3D | null>(null);

  const handleAddMemory = (memory: Memory) => {
    onAddMemory(memory);
  };

  const handleZoneChange = (zone: string) => {
    onZoneChange(zone);
  };

  useEffect(() => {
    // Initialize scene
    if (!sceneRef.current) {
      sceneRef.current = new THREE.Scene();
      sceneRef.current.background = new THREE.Color(0x87CEEB);
    }

    // Initialize camera
    if (!cameraRef.current) {
      cameraRef.current = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      cameraRef.current.position.z = 5;
    }

    // Initialize renderer
    if (!rendererRef.current) {
      rendererRef.current = new THREE.WebGLRenderer({ antialias: true });
      rendererRef.current.setSize(window.innerWidth, window.innerHeight);
      mountRef.current?.appendChild(rendererRef.current.domElement);
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowUp':
          keysRef.current.forward = true;
          break;
        case 'ArrowDown':
          keysRef.current.backward = true;
          break;
        case 'ArrowLeft':
          keysRef.current.left = true;
          break;
        case 'ArrowRight':
          keysRef.current.right = true;
          break;
        case ' ':
          keysRef.current.up = true;
          break;
        case 'Shift':
          keysRef.current.down = true;
          break;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowUp':
          keysRef.current.forward = false;
          break;
        case 'ArrowDown':
          keysRef.current.backward = false;
          break;
        case 'ArrowLeft':
          keysRef.current.left = false;
          break;
        case 'ArrowRight':
          keysRef.current.right = false;
          break;
        case ' ':
          keysRef.current.up = false;
          break;
        case 'Shift':
          keysRef.current.down = false;
          break;
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      mouseRef.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = -(event.clientY / window.innerHeight) * 2 + 1;
    };

    const handleMouseDown = (event: MouseEvent) => {
      if (event.button === 0) { // Left click
        raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current!);
        const intersects = raycasterRef.current.intersectObjects(sceneRef.current!.children, true);

        const treeIntersect = intersects.find(intersect => intersect.object.userData.isTree);
        if (treeIntersect) {
          if (event.shiftKey) {
            // Drag mode
            setIsDragging(true);
            setDraggedTree(treeIntersect.object);
          } else {
            // View memory mode
            const memory = memories.find(m => m.id === treeIntersect.object.userData.memoryId);
            if (memory) {
              onMemorySelect(memory);
            }
          }
        }
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setDraggedTree(null);
    };

    const animate = () => {
      requestAnimationFrame(animate);
      
      // Update camera position based on keys
      if (cameraRef.current) {
        const speed = 0.1;
        if (keysRef.current.forward) cameraRef.current.position.z -= speed;
        if (keysRef.current.backward) cameraRef.current.position.z += speed;
        if (keysRef.current.left) cameraRef.current.position.x -= speed;
        if (keysRef.current.right) cameraRef.current.position.x += speed;
        if (keysRef.current.up) cameraRef.current.position.y += speed;
        if (keysRef.current.down) cameraRef.current.position.y -= speed;
      }

      // Update dragged tree position
      if (isDragging && draggedTree && sceneRef.current) {
        raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current!);
        const intersects = raycasterRef.current.intersectObjects([getGroundPlane(sceneRef.current)]);
        if (intersects.length > 0) {
          draggedTree.position.x = intersects[0].point.x;
          draggedTree.position.z = intersects[0].point.z;
        }
      }

      // Update zone effects
      if (cameraRef.current && sceneRef.current) {
        updateZoneEffects(cameraRef.current.position, sceneRef.current);
        updateCurrentZone(cameraRef.current.position);
      }

      rendererRef.current?.render(sceneRef.current!, cameraRef.current!);
    };
    animate();

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
      rendererRef.current?.dispose();
      sceneRef.current?.clear();
    };
  }, [memories]);

  useEffect(() => {
    if (!sceneRef.current) return;
    
    // Remove existing trees
    const treesToRemove = sceneRef.current.children.filter(child => child.userData.isTree);
    treesToRemove.forEach(tree => sceneRef.current!.remove(tree));
    
    // Add new trees
    memories.forEach(memory => {
      const tree = createTree(memory);
      sceneRef.current!.add(tree);
    });
  }, [memories]);

  const updateMovement = (camera: THREE.PerspectiveCamera) => {
    const speed = 0.1;
    const direction = new THREE.Vector3();
    
    if (keysRef.current.forward) direction.z -= speed;
    if (keysRef.current.backward) direction.z += speed;
    if (keysRef.current.left) direction.x -= speed;
    if (keysRef.current.right) direction.x += speed;
    if (keysRef.current.up) direction.y += speed;
    if (keysRef.current.down) direction.y -= speed;
    
    direction.applyQuaternion(camera.quaternion);
    camera.position.add(direction);
    
    // Keep camera above ground
    camera.position.y = Math.max(camera.position.y, 3);
  };

  const updateCurrentZone = (position: THREE.Vector3) => {
    const newZone = determineZone(position);
    if (newZone !== currentZone) {
      onZoneChange(newZone);
      // Update connections when zone changes
      const newConnections = memories.map(memory => ({
        from: memory.id,
        to: memory.id,
        strength: 0.5 // TODO: Implement zone-based connection strength
      }));
      setConnections(newConnections);
    }
  };

  const determineZone = (position: THREE.Vector3) => {
    // Simple zone detection based on position
    const angle = (Math.PI * 2) / Object.keys(zones).length;
    const radius = 15;
    const zoneIndex = Math.floor((Math.atan2(position.z, position.x) + Math.PI) / angle) % Object.keys(zones).length;
    return Object.keys(zones)[zoneIndex];
  };

  const createZoneGrounds = (scene: THREE.Scene) => {
    Object.entries(zones).forEach(([zoneName, zone], index) => {
      const angle = (index / 8) * Math.PI * 2;
      const radius = 30;
      
      const geometry = new THREE.CircleGeometry(15, 32);
      const material = new THREE.MeshLambertMaterial({ 
        color: new THREE.Color(zone.colors.primary),
        transparent: true,
        opacity: 0.7
      });
      
      const ground = new THREE.Mesh(geometry, material);
      ground.rotation.x = -Math.PI / 2;
      ground.position.x = Math.cos(angle) * radius;
      ground.position.z = Math.sin(angle) * radius;
      ground.userData.zone = zoneName;
      
      scene.add(ground);
    });
  };

  const createZoneEnvironments = (scene: THREE.Scene) => {
    Object.entries(zones).forEach(([zoneName, zone], index) => {
      const angle = (index / 8) * Math.PI * 2;
      const radius = 30;
      const centerX = Math.cos(angle) * radius;
      const centerZ = Math.sin(angle) * radius;
      
      // Create environmental objects based on zone type
      zone.objects.forEach((objectType, objIndex) => {
        const objectAngle = (objIndex / zone.objects.length) * Math.PI * 2;
        const objectRadius = 8 + Math.random() * 5;
        const x = centerX + Math.cos(objectAngle) * objectRadius;
        const z = centerZ + Math.sin(objectAngle) * objectRadius;
        
        const envObject = createEnvironmentalObject(objectType, zone);
        if (envObject) {
          envObject.position.set(x, 0, z);
          scene.add(envObject);
        }
      });
    });
  };

  const createEnvironmentalObject = (objectType: string, zone: any) => {
    const group = new THREE.Group();
    
    switch (objectType) {
      case 'butterflies':
      case 'sparkles':
        // Create small glowing particles
        for (let i = 0; i < 5; i++) {
          const geometry = new THREE.SphereGeometry(0.1, 8, 6);
          const material = new THREE.MeshBasicMaterial({ 
            color: new THREE.Color(zone.colors.accent),
            transparent: true,
            opacity: 0.8
          });
          const particle = new THREE.Mesh(geometry, material);
          particle.position.set(
            (Math.random() - 0.5) * 4,
            1 + Math.random() * 3,
            (Math.random() - 0.5) * 4
          );
          group.add(particle);
        }
        break;
        
      case 'hammocks':
      case 'swings':
        // Create hanging objects
        const ropeGeometry = new THREE.CylinderGeometry(0.05, 0.05, 3);
        const ropeMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const rope = new THREE.Mesh(ropeGeometry, ropeMaterial);
        rope.position.y = 1.5;
        group.add(rope);
        
        const seatGeometry = new THREE.BoxGeometry(1.5, 0.1, 0.5);
        const seatMaterial = new THREE.MeshLambertMaterial({ color: 0x654321 });
        const seat = new THREE.Mesh(seatGeometry, seatMaterial);
        seat.position.y = 0.5;
        group.add(seat);
        break;
        
      case 'benches':
        const benchGeometry = new THREE.BoxGeometry(2, 0.2, 0.8);
        const benchMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const bench = new THREE.Mesh(benchGeometry, benchMaterial);
        bench.position.y = 0.5;
        group.add(bench);
        break;
        
      case 'rain_puddles':
        const puddleGeometry = new THREE.CircleGeometry(1, 16);
        const puddleMaterial = new THREE.MeshLambertMaterial({ 
          color: 0x4682B4,
          transparent: true,
          opacity: 0.6
        });
        const puddle = new THREE.Mesh(puddleGeometry, puddleMaterial);
        puddle.rotation.x = -Math.PI / 2;
        puddle.position.y = 0.01;
        group.add(puddle);
        break;
        
      case 'lanterns':
      case 'floating_lanterns':
        const lanternGeometry = new THREE.CylinderGeometry(0.3, 0.4, 0.8);
        const lanternMaterial = new THREE.MeshLambertMaterial({ 
          color: new THREE.Color(zone.colors.accent),
          emissive: new THREE.Color(zone.colors.accent),
          emissiveIntensity: 0.3
        });
        const lantern = new THREE.Mesh(lanternGeometry, lanternMaterial);
        lantern.position.y = objectType === 'floating_lanterns' ? 3 + Math.random() * 2 : 1.5;
        group.add(lantern);
        break;
        
      case 'smoldering_rocks':
        const rockGeometry = new THREE.DodecahedronGeometry(0.5);
        const rockMaterial = new THREE.MeshLambertMaterial({ 
          color: 0x8B0000,
          emissive: 0xFF4500,
          emissiveIntensity: 0.2
        });
        const rock = new THREE.Mesh(rockGeometry, rockMaterial);
        rock.position.y = 0.3;
        group.add(rock);
        break;
        
      case 'crystals':
        const crystalGeometry = new THREE.OctahedronGeometry(0.8);
        const crystalMaterial = new THREE.MeshLambertMaterial({ 
          color: 0x9932CC,
          transparent: true,
          opacity: 0.7,
          emissive: 0x40E0D0,
          emissiveIntensity: 0.3
        });
        const crystal = new THREE.Mesh(crystalGeometry, crystalMaterial);
        crystal.position.y = 1;
        crystal.rotation.y = Math.random() * Math.PI;
        group.add(crystal);
        break;
        
      case 'koi_ponds':
      case 'streams':
        const waterGeometry = new THREE.CircleGeometry(2, 16);
        const waterMaterial = new THREE.MeshLambertMaterial({ 
          color: 0x40E0D0,
          transparent: true,
          opacity: 0.8
        });
        const water = new THREE.Mesh(waterGeometry, waterMaterial);
        water.rotation.x = -Math.PI / 2;
        water.position.y = -0.1;
        group.add(water);
        break;
        
      case 'glowing_mushrooms':
        const mushroomCapGeometry = new THREE.SphereGeometry(0.4, 8, 6);
        const mushroomCapMaterial = new THREE.MeshLambertMaterial({ 
          color: 0x9932CC,
          emissive: 0x40E0D0,
          emissiveIntensity: 0.4
        });
        const mushroomCap = new THREE.Mesh(mushroomCapGeometry, mushroomCapMaterial);
        mushroomCap.position.y = 0.6;
        
        const mushroomStemGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.5);
        const mushroomStemMaterial = new THREE.MeshLambertMaterial({ color: 0xF5F5DC });
        const mushroomStem = new THREE.Mesh(mushroomStemGeometry, mushroomStemMaterial);
        mushroomStem.position.y = 0.25;
        
        group.add(mushroomCap);
        group.add(mushroomStem);
        break;
        
      default:
        // Create a simple decorative object for unspecified types
        const defaultGeometry = new THREE.SphereGeometry(0.2, 8, 6);
        const defaultMaterial = new THREE.MeshLambertMaterial({ 
          color: new THREE.Color(zone.colors.secondary)
        });
        const defaultObject = new THREE.Mesh(defaultGeometry, defaultMaterial);
        defaultObject.position.y = 0.2;
        group.add(defaultObject);
        break;
    }
    
    return group.children.length > 0 ? group : null;
  };

  const createTree = (memory: Memory) => {
    const zone = zones[memory.emotion];
    const group = new THREE.Group();
    
    // Trunk
    const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.5, 3);
    const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = 1.5;
    trunk.castShadow = true;
    group.add(trunk);
    
    // Foliage
    const foliageGeometry = new THREE.SphereGeometry(2, 8, 6);
    const foliageMaterial = new THREE.MeshLambertMaterial({ 
      color: new THREE.Color(zone.colors.secondary) 
    });
    const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
    foliage.position.y = 4;
    foliage.castShadow = true;
    group.add(foliage);
    
    // Position
    if (memory.location) {
      group.position.set(memory.location.x, 0, memory.location.z);
    } else {
      const angle = Math.random() * Math.PI * 2;
      const radius = 10 + Math.random() * 10;
      group.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    }
    
    group.userData.isTree = true;
    group.userData.memoryId = memory.id;
    group.userData.emotion = memory.emotion;
    
    return group;
  };

  const updateZoneEffects = (position: THREE.Vector3, scene: THREE.Scene) => {
    const zone = zones[currentZone];
    if (!zone) return;
    
    // Update fog color based on zone
    scene.fog!.color = new THREE.Color(zone.colors.primary);
    
    // Update clear color
    if (rendererRef.current) {
      (rendererRef.current as any).setClearColor(new THREE.Color(zone.colors.primary), 0.3);
    }

    // Update AudioManager zone

  };

  const getGroundPlane = (scene: THREE.Scene) => {
    const existingPlane = scene.getObjectByName('groundPlane');
    if (existingPlane) return existingPlane;
    
    const planeGeometry = new THREE.PlaneGeometry(200, 200);
    const planeMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x90EE90, 
      transparent: true, 
      opacity: 0 
    });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2;
    plane.name = 'groundPlane';
    scene.add(plane);
    return plane;
  };

  const addMemory = async (memory: Memory) => {
    const newMemory = {
      ...memory,
      location: {
        x: Math.random() * 20 - 10,
        y: 0,
        z: Math.random() * 20 - 10
      }
    };

    const updatedMemories = [...memories, newMemory];
    onAddMemory(newMemory);
    
    // Update the current memory with its location
    const memoryWithLocation = {
      ...newMemory,
      location: {
        x: newMemory.location?.x || 0,
        y: newMemory.location?.y || 0,
        z: newMemory.location?.z || 0
      }
    };
    
    // Find related memories using AI (if API key is available)
    
    // Find related memories using AI (if API key is available)
    if (process.env.NEXT_PUBLIC_OPENAI_API_KEY) {
      findRelatedMemories([newMemory], memories)
        .then(relatedMemoryIds => {
          const relatedMemories = memories.filter(memory => relatedMemoryIds.includes(memory.id.toString()));
          const newConnections = relatedMemories.map((memory: Memory) => ({
            from: newMemory.id,
            to: memory.id,
            strength: 0.5 // TODO: Implement connection strength calculation
          }));
          setConnections(prev => [...prev, ...newConnections]);
        })
        .catch(error => console.error('Error finding related memories:', error));
    }

    // Find related memories using AI (if API key is available)
    if (updatedMemories.length > 1) {
      try {
        const relatedMemoryIds = await findRelatedMemories(memories, newMemory);
        const relatedMemories = memories.filter(memory => relatedMemoryIds.includes(memory.id.toString()));
        const newConnections = relatedMemories.map((memory: Memory) => ({
          from: newMemory.id,
          to: memory.id,
          strength: 0.5
        }));
        setConnections(prev => [...prev, ...newConnections]);
      } catch (error) {
        console.error('Failed to find related memories:', error);
      }
    }

    // Update audio based on current zone


    setShowForm(false);
  };

  return (
    <div className="relative w-full h-screen">
      <div ref={mountRef} className="w-full h-full" />
      
      {/* UI Overlay */}
      <div className="absolute top-4 left-4 z-10 text-white">
        <div className="bg-black bg-opacity-50 p-4 rounded-lg">
          <h2 className="text-xl font-bold mb-2">AI Memory Garden</h2>
          <p>Current Zone: <span className="capitalize text-yellow-300">{zones[currentZone]?.name || currentZone}</span></p>
          <p className="text-sm mt-2">WASD to move • F to add memory • C to toggle connections</p>
          <p className="text-sm">Click tree to view • Shift+Click to drag</p>
          {showConnections && <p className="text-sm text-green-300">Mind-map connections: ON</p>}
    </div>
  </div>
  <div className="flex-none">
    <MemoryForm
      onSubmit={(memory: Omit<Memory, 'id'>) => {
        onAddMemory(memory as Memory);
        onMemorySelect(null);
      }}
      onClose={() => onMemorySelect(null)}
    />
  </div>
  {selectedMemory && (
    <MemoryModal
      memory={selectedMemory}
      onClose={() => {
        onMemorySelect(null);
      }}
    />
  )}
  {showConnections && (
    <MemoryConnections
      memories={memories}
      connections={{} as { [memoryId: string]: string[] }}
      scene={sceneRef.current}
    />
  )}
</div>
);
};
