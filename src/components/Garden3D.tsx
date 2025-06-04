import { useRef, useEffect, useState } from 'react';
import * as BABYLON from 'babylonjs';
import { StandardMaterial, Color3, Material } from 'babylonjs';
import { zones } from '../data/zones';

// Type assertion helper
const assertMaterial = (mat: Material): mat is StandardMaterial => {
  return mat instanceof StandardMaterial;
};

interface Garden3DProps {
  currentZone: string;
  onZoneChange: (zone: string) => void;
}


export const Garden3D = ({ currentZone, onZoneChange }: Garden3DProps) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<BABYLON.Scene>(null);
  const cameraRef = useRef<BABYLON.ArcRotateCamera>(null);
  const zoneObjectsRef = useRef<{ [key: string]: BABYLON.TransformNode }>({});

  useEffect(() => {
    if (!mountRef.current) return;

    // Create canvas and engine
    const canvas = document.createElement('canvas');
    mountRef.current.appendChild(canvas);
    const engine = new BABYLON.Engine(canvas, true);
    const scene = new BABYLON.Scene(engine);
    sceneRef.current = scene;

    // Create camera
    const camera = new BABYLON.ArcRotateCamera(
      'camera',
      Math.PI / 2,
      Math.PI / 4,
      15,
      BABYLON.Vector3.Zero(),
      scene
    );
    camera.attachControl(mountRef.current, true);
    cameraRef.current = camera;

    // Create light
    const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 0.7;

    // Create zones
    createZones(scene);

    // Animation loop
    engine.runRenderLoop(() => {
      scene.render();
    });

    // Resize handler
    const handleResize = () => {
      engine.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      engine.dispose();
    };
  }, [currentZone]);

  const createZones = (scene: BABYLON.Scene) => {
    Object.entries(zones).forEach(([zoneKey, zone]) => {
      const zoneGroup = new BABYLON.TransformNode(zoneKey, scene);

      // Create ground
      const ground = BABYLON.MeshBuilder.CreateGround(
        'ground',
        { width: 20, height: 20 },
        scene
      );
      const groundMat = new BABYLON.StandardMaterial('groundMat', scene) as BABYLON.StandardMaterial;
      groundMat.diffuseColor = BABYLON.Color3.FromHexString(zone.colors.primary);
      groundMat.specularColor = BABYLON.Color3.Black();
      groundMat.backFaceCulling = false;
      ground.material = groundMat;

      // Create trees
      createTree(zone.treeType, zoneGroup, scene);

      // Add objects
      zone.objects.forEach((object) => {
        createObject(object, zoneGroup, scene);
      });

      // Position zone
      const angle = (Math.PI * 2) / Object.keys(zones).length;
      const radius = 15;
      const angleOffset = (Math.PI * 2) / Object.keys(zones).length;
      const anglePosition = angleOffset * Object.keys(zones).indexOf(zoneKey);
      zoneGroup.position = new BABYLON.Vector3(
        Math.cos(anglePosition) * radius,
        0,
        Math.sin(anglePosition) * radius
      );

      zoneObjectsRef.current[zoneKey] = zoneGroup;
    });
  };

  const createTree = (type: string, parent: BABYLON.TransformNode, scene: BABYLON.Scene) => {
    // Create a simple tree mesh
    const trunk = BABYLON.MeshBuilder.CreateCylinder(
      'trunk',
      { height: 3, diameter: 0.5, tessellation: 16 },
      scene
    );
    trunk.position.y = 1.5;
    const trunkMat = new BABYLON.StandardMaterial('trunkMat', scene) as StandardMaterial;
    trunkMat.diffuseColor = new BABYLON.Color3(0.4, 0.2, 0);
    trunk.material = trunkMat;
    trunk.parent = parent;

    // Create leaves
    const leaves = BABYLON.MeshBuilder.CreateSphere(
      'leaves',
      { diameter: 2, segments: 32 },
      scene
    );
    leaves.position.y = 2.5;
    const leavesMat = new BABYLON.StandardMaterial('leavesMat', scene) as StandardMaterial;
    leavesMat.diffuseColor = new BABYLON.Color3(0.2, 0.6, 0.2);
    leaves.material = leavesMat;
    leaves.parent = parent;
  };

  const createObject = (type: string, parent: BABYLON.TransformNode, scene: BABYLON.Scene) => {
    // Create a simple sphere as placeholder
    const object = BABYLON.MeshBuilder.CreateSphere(
      'object',
      { diameter: 0.6, segments: 32 },
      scene
    );
    object.position = new BABYLON.Vector3(
      Math.random() * 2 - 1,
      0.3,
      Math.random() * 2 - 1
    );
    const objectMat = new BABYLON.StandardMaterial('objectMat', scene) as StandardMaterial;
    objectMat.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.5);
    object.material = objectMat;
    object.parent = parent;
  };

  return (
    <div
      ref={mountRef}
      style={{ width: '100vw', height: '100vh', position: 'relative' }}
    />
  );
};
