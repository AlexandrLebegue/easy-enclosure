/**
 * CONTRAT PARTAGÉ — modèle de projet importé et spécification de boîtier.
 * Propriété du chef de projet (ProxBoss). Ne pas modifier sans demande.
 */

import type { ComponentSpec, Cutout } from './component.types';

/** Un composant tel qu'il sort du fichier Velxio, avant/après résolution dimensionnelle. */
export interface PlacedPart {
  /** id unique dans le diagram.json. */
  id: string;
  /** type Wokwi/Velxio : clé de jointure avec la base. */
  partType: string;
  /** null si le type est absent de la base : le boîtier doit alors le signaler. */
  spec: ComponentSpec | null;
  /** Position d'origine sur le canevas Velxio (pixels, non physiques). */
  canvas: { x: number; y: number; rotate: number };
  /** Position physique retenue après placement, mm depuis l'origine du boîtier. */
  placedMm?: { x: number; y: number; z: number; rotate: number };
}

export interface Connection {
  from: string;
  to: string;
  color: string;
}

export interface ImportWarning {
  code:
    | 'UNKNOWN_PART_TYPE'
    | 'ESTIMATED_DIMENSIONS'
    | 'CANVAS_SCALE_IGNORED'
    | 'MISSING_SKETCH'
    | 'COLLISION_RESOLVED'
    | 'PART_IGNORED';
  message: string;
  partId?: string;
}

/** Résultat de l'import d'un zip Velxio. */
export interface BoardModel {
  source: { fileName: string; importedAt: string };
  parts: PlacedPart[];
  connections: Connection[];
  warnings: ImportWarning[];
  /** true si tous les parts ont un spec non nul. */
  complete: boolean;
}

export type EnclosureMode = 'flat' | 'stacked';
export type LidType = 'snap' | 'screw-heat-set' | 'screw-nut';
export type SupportType = 'standoff-screw' | 'cradle' | 'clip' | 'pocket' | 'none';

export interface BoardEnclosureRules {
  /** Épaisseur de paroi, mm. */
  wallMm: number;
  /** Jeu entre composant et paroi, mm. */
  clearanceMm: number;
  /** Hauteur libre au-dessus du composant le plus haut, mm. */
  headroomMm: number;
  /** Rayon des congés verticaux, mm. */
  cornerRadiusMm: number;
  /** Jeu d'impression ajouté à chaque découpe, mm. */
  printClearanceMm: number;
  /** Épaisseur du plancher, mm. */
  floorMm: number;
  /** Épaisseur du couvercle, mm. */
  lidMm: number;
}

export interface Standoff {
  partId: string;
  type: SupportType;
  /** Position du centre, mm. */
  xMm: number;
  yMm: number;
  heightMm: number;
  /** Diamètre de la vis si applicable. */
  screwMm?: number;
}

/** Spécification complète et déterministe consommée par le moteur CAO. */
export interface EnclosureSpec {
  schemaVersion: number;
  mode: EnclosureMode;
  rules: BoardEnclosureRules;
  lid: { type: LidType; screwMm?: number };
  outer: { widthMm: number; depthMm: number; heightMm: number };
  parts: PlacedPart[];
  standoffs: Standoff[];
  cutouts: Cutout[];
  /** Paramètres libres conservés pour l'UI et les presets. */
  metadata: { projectName: string; generatedBy: string; generatedAt: string };
}

/**
 * Contrat du chat IA : il ne produit jamais de géométrie, seulement un patch
 * validé de EnclosureSpec (ou une question).
 */
export interface ChatPatch {
  op:
    | 'set-mode'
    | 'set-rule'
    | 'set-lid'
    | 'add-cutout'
    | 'remove-cutout'
    | 'set-support'
    | 'ask-user';
  /** Chemin dans EnclosureSpec, ex "rules.wallMm". */
  path?: string;
  value?: unknown;
  question?: string;
  rationale?: string;
}

export interface ChatTurn {
  userText: string;
  patches: ChatPatch[];
  /** Message à afficher si aucune modification n'est proposée. */
  message?: string;
}
