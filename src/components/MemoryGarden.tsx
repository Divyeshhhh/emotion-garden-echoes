import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { MemoryForm } from './MemoryForm';
import { MemoryModal } from './MemoryModal';
import { AudioManager } from './AudioManager';
import { MemoryConnections } from './MemoryConnections';
import { zones } from '../data/zones';
import { Memory } from '../types/Memory';
import { findRelatedMemories } from '../services/aiService';

export const MemoryGarden = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene>();
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [currentZone, setCurrentZone] = useState('joy');
  const [isDragging, setIsDragging] = useState(false);
  const [draggedTree, setDraggedTree] = useState<THREE.Object3D | null>(null);
  const [connections, setConnections] = useState<{ [memoryId: string]: string[] }>({});
  const [showConnections, setShowConnections] = useState(false);
  
  const mouseRef = useRef(new THREE.Vector2());
  const raycasterRef = useRef(new THREE.Raycaster());
  const keysRef = useRef<{[key: string]: boolean}>({});

  useEffect(() => {
    if (!mountRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x87CEEB, 50, 200);
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, 0);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x87CEEB);
    rendererRef.current = renderer;
    mountRef.current.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(50, 50, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // Create zone grounds
    createZoneGrounds(scene);

    // Movement controls
    const handleKeyDown = (event: KeyboardEvent) => {
      keysRef.current[event.code] = true;
      if (event.code === 'KeyF') {
        setShowForm(true);
      }
      if (event.code === 'KeyC') {
        setShowConnections(prev => !prev);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      keysRef.current[event.code] = false;
    };

    const handleMouseMove = (event: MouseEvent) => {
      mouseRef.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = -(event.clientY / window.innerHeight) * 2 + 1;
    };

    const handleMouseDown = (event: MouseEvent) => {
      if (event.button === 0) { // Left click
        raycasterRef.current.setFromCamera(mouseRef.current, camera);
        const intersects = raycasterRef.current.intersectObjects(scene.children, true);
        
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
              setSelectedMemory(memory);
            }
          }
        }
      }
    };

    const handleMouseUp = () => {
      if (isDragging && draggedTree) {
        // Update memory position
        const memoryId = draggedTree.userData.memoryId;
        setMemories(prev => prev.map(m => 
          m.id === memoryId 
            ? { ...m, position: { x: draggedTree.position.x, z: draggedTree.position.z } }
            : m
        ));
      }
      setIsDragging(false);
      setDraggedTree(null);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      updateMovement(camera);
      updateZoneEffects(camera.position, scene);
      updateCurrentZone(camera.position);
      
      if (isDragging && draggedTree) {
        raycasterRef.current.setFromCamera(mouseRef.current, camera);
        const intersects = raycasterRef.current.intersectObjects([getGroundPlane(scene)]);
        if (intersects.length > 0) {
          draggedTree.position.x = intersects[0].point.x;
          draggedTree.position.z = intersects[0].point.z;
        }
      }
      
      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('resize', handleResize);
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Update trees when memories change
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
    const speed = 0.5;
    const direction = new THREE.Vector3();
    
    if (keysRef.current['KeyW']) direction.z -= speed;
    if (keysRef.current['KeyS']) direction.z += speed;
    if (keysRef.current['KeyA']) direction.x -= speed;
    if (keysRef.current['KeyD']) direction.x += speed;
    
    direction.applyQuaternion(camera.quaternion);
    camera.position.add(direction);
    
    // Keep camera above ground
    camera.position.y = Math.max(camera.position.y, 3);
  };

  const updateCurrentZone = (position: THREE.Vector3) => {
    const newZone = determineZone(position);
    if (newZone !== currentZone) {
      setCurrentZone(newZone);
    }
  };

  const determineZone = (position: THREE.Vector3) => {
    // Simple zone detection based on position
    const angle = Math.atan2(position.z, position.x);
    const normalizedAngle = ((angle + Math.PI) / (2 * Math.PI)) * 8;
    const zoneIndex = Math.floor(normalizedAngle) % 8;
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
    if (memory.position) {
      group.position.set(memory.position.x, 0, memory.position.z);
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
      rendererRef.current.setClearColor(new THREE.Color(zone.colors.primary), 0.3);
    }
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

  const addMemory = async (memoryData: Omit<Memory, 'id'>) => {
    const newMemory: Memory = {
      ...memoryData,
      id: Date.now().toString(),
    };
    
    const updatedMemories = [...memories, newMemory];
    setMemories(updatedMemories);
    
    // Find related memories using AI (if API key is available)
    const apiKey = localStorage.getItem('openai_api_key');
    if (apiKey && updatedMemories.length > 1) {
      try {
        const relatedIds = await findRelatedMemories(memories, newMemory, apiKey);
        setConnections(prev => ({
          ...prev,
          [newMemory.id]: relatedIds
        }));
      } catch (error) {
        console.error('Failed to find related memories:', error);
      }
    }
    
    setShowForm(false);
  };

  return (
    <div className="relative w-full h-screen">
      <div ref={mountRef} className="w-full h-full" />
      
      {/* UI Overlay */}
      <div className="absolute top-4 left-4 z-10 text-white">
        <div className="bg-black bg-opacity-50 p-4 rounded-lg">
          <h2 className="text-xl font-bold mb-2">AI Memory Garden</h2>
          <p>Current Zone: <span className="capitalize text-yellow-300">{currentZone}</span></p>
          <p className="text-sm mt-2">WASD to move • F to add memory • C to toggle connections</p>
          <p className="text-sm">Click tree to view • Shift+Click to drag</p>
          {showConnections && <p className="text-sm text-green-300">Mind-map connections: ON</p>}
        </div>
      </div>

      <AudioManager currentZone={currentZone} />
      
      {/* Memory Connections Visualization */}
      {showConnections && sceneRef.current && (
        <MemoryConnections
          memories={memories}
          connections={connections}
          scene={sceneRef.current}
        />
      )}
      
      {showForm && (
        <MemoryForm
          onSubmit={addMemory}
          onClose={() => setShowForm(false)}
        />
      )}
      
      {selectedMemory && (
        <MemoryModal
          memory={selectedMemory}
          onClose={() => setSelectedMemory(null)}
        />
      )}
    </div>
  );
};
