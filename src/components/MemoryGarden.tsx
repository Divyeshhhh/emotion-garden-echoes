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

    // Create zone grounds and environmental objects
    createZoneGrounds(scene);
    createZoneEnvironments(scene);

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
          <p>Current Zone: <span className="capitalize text-yellow-300">{zones[currentZone]?.name || currentZone}</span></p>
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
