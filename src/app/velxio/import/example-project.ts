import JSZip from 'jszip';

import type { ComponentSpec } from '../model/component.types';

const PROVENANCE = {
  url: 'https://example.com/datasheet.pdf',
  license: 'CERN-OHL-P-2.0',
  retrievedAt: '2026-11-05T00:00:00Z',
};

/** Deterministic specs used by the example project and the import tests. */
export const EXAMPLE_COMPONENT_SPECS: readonly ComponentSpec[] = [
  {
    partType: 'board-velxio-esp32',
    displayName: 'Velxio ESP32 board',
    category: 'board',
    envelope: { widthMm: 30, depthMm: 20, heightMm: 5 },
    mountHoles: [
      { xMm: 3, yMm: 3, diameterMm: 3 },
      { xMm: 27, yMm: 3, diameterMm: 3 },
      { xMm: 3, yMm: 17, diameterMm: 3 },
      { xMm: 27, yMm: 17, diameterMm: 3 },
    ],
    cutouts: [
      {
        id: 'usb',
        side: 'front',
        offsetMm: 10,
        widthMm: 9,
        heightMm: 4,
        label: 'USB',
      },
    ],
    keepouts: [],
    provenance: PROVENANCE,
    confidence: 'datasheet',
    schemaVersion: 1,
  },
  {
    partType: 'board-velxio-arduino-uno',
    displayName: 'Velxio Arduino Uno board',
    category: 'board',
    envelope: { widthMm: 25, depthMm: 18, heightMm: 4 },
    mountHoles: [
      { xMm: 2.5, yMm: 2.5, diameterMm: 3 },
      { xMm: 22.5, yMm: 2.5, diameterMm: 3 },
      { xMm: 2.5, yMm: 15.5, diameterMm: 3 },
      { xMm: 22.5, yMm: 15.5, diameterMm: 3 },
    ],
    cutouts: [],
    keepouts: [],
    provenance: PROVENANCE,
    confidence: 'datasheet',
    schemaVersion: 1,
  },
  {
    partType: 'wokwi-led',
    displayName: 'LED 5 mm',
    category: 'passive',
    envelope: { widthMm: 5, depthMm: 5, heightMm: 8 },
    mountHoles: [],
    cutouts: [],
    keepouts: [],
    provenance: PROVENANCE,
    confidence: 'datasheet',
    schemaVersion: 1,
  },
  {
    partType: 'wokwi-servo',
    displayName: 'Micro servo',
    category: 'actuator',
    envelope: { widthMm: 20, depthMm: 12, heightMm: 15 },
    mountHoles: [],
    cutouts: [],
    keepouts: [],
    provenance: PROVENANCE,
    confidence: 'datasheet',
    schemaVersion: 1,
  },
  {
    partType: 'wokwi-lcd1602',
    displayName: 'LCD 1602',
    category: 'display',
    envelope: { widthMm: 40, depthMm: 20, heightMm: 10 },
    mountHoles: [],
    cutouts: [
      {
        id: 'screen',
        side: 'front',
        offsetMm: 5,
        widthMm: 30,
        heightMm: 12,
        label: 'Display window',
      },
    ],
    keepouts: [],
    provenance: PROVENANCE,
    confidence: 'datasheet',
    schemaVersion: 1,
  },
];

export const EXAMPLE_DIAGRAM_PARTS = [
  { type: 'board-velxio-esp32', id: 'board1', top: 0, left: 0, rotate: 0, attrs: {} },
  { type: 'board-velxio-arduino-uno', id: 'board2', top: 0, left: 100, rotate: 0, attrs: {} },
  { type: 'wokwi-led', id: 'led1', top: 60, left: 40, rotate: 0, attrs: {} },
  { type: 'wokwi-servo', id: 'servo1', top: 60, left: 120, rotate: 0, attrs: {} },
  { type: 'wokwi-lcd1602', id: 'lcd1', top: 20, left: 200, rotate: 0, attrs: {} },
];

export const EXAMPLE_SKETCH = `void setup() {}
void loop() {}
`;

export interface ExampleZipOptions {
  includeUnknownPart?: boolean;
}

/** Build an in-memory Velxio export zip: 2 boards + 3 components. */
export const createExampleVelxioZip = async (options: ExampleZipOptions = {}): Promise<Blob> => {
  const parts = [...EXAMPLE_DIAGRAM_PARTS];
  if (options.includeUnknownPart) {
    parts.push({
      type: 'unknown-widget',
      id: 'unknown1',
      top: 120,
      left: 260,
      rotate: 0,
      attrs: {},
    });
  }

  const diagram = {
    version: 1,
    author: 'agent-b',
    editor: 'velxio',
    parts,
    connections: [
      ['board1:GPIO2', 'led1:A', 'green', []],
      ['board1:GND', 'led1:C', 'black', []],
      ['board2:5V', 'servo1:VCC', 'red', []],
      ['board2:GND', 'servo1:GND', 'black', []],
    ],
  };

  const zip = new JSZip();
  zip.file('diagram.json', JSON.stringify(diagram, null, 2));
  zip.file('sketch.ino', EXAMPLE_SKETCH);
  return zip.generateAsync({ type: 'blob' });
};
