/**
 * CONTRAT PARTAGÉ — composants Velxio → dimensions réelles → boîtier.
 *
 * Ce fichier est la propriété du chef de projet (ProxBoss). Les agents ne le
 * modifient pas : toute évolution passe par une demande explicite.
 *
 * Clé de jointure universelle : `partType`, exactement le champ `type` d'une
 * entrée `parts[]` du `diagram.json` exporté par Velxio.
 */

export type PartCategory =
  | 'board'
  | 'display'
  | 'sensor'
  | 'passive'
  | 'actuator'
  | 'power'
  | 'module'
  | 'other';

/** Provenance et fiabilité d'une donnée dimensionnelle. */
export type Confidence = 'verified' | 'datasheet' | 'estimated';

export type Side = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom';

/** Trou de fixation, coordonnées en mm depuis le coin haut-gauche de l'empreinte. */
export interface MountHole {
  xMm: number;
  yMm: number;
  diameterMm: number;
}

/** Ouverture à pratiquer dans une paroi (écran, USB, jack, bouton...). */
export interface Cutout {
  id: string;
  side: Side;
  /** Position du bord gauche de l'ouverture le long de la paroi, en mm. */
  offsetMm: number;
  widthMm: number;
  heightMm: number;
  /** Profondeur d'échancrure (ex. connecteur en retrait). 0 = traversant. */
  depthMm?: number;
  label?: string;
  /** Marge d'impression appliquée par le générateur, en mm. */
  clearanceMm?: number;
}

/** Zone à ne pas recouvrir (antenne, bouton, Connecteur déjà en façade). */
export interface Keepout {
  side: Side;
  offsetMm: number;
  widthMm: number;
  heightMm: number;
  reason: string;
}

export interface Provenance {
  /** Datasheet ou fiche constructeur. */
  url?: string;
  /** Bibliothèque d'origine, ex "kicad:Resistor_SMD:R_0805_2012Metric". */
  library?: string;
  /** SPDX ou mention libre, ex "CC-BY-SA-4.0", "CERN-OHL-P-2.0", "datasheet". */
  license: string;
  retrievedAt: string;
}

/**
 * Enregistrement canonique d'un composant.
 * Un fichier JSON par composant dans data/components/<category>/<partType>.json
 */
export interface ComponentSpec {
  /** Identifiant Velxio/Wokwi : parts[].type du diagram.json. */
  partType: string;
  displayName: string;
  category: PartCategory;
  /** Encombrement hors tout. widthMm = axe X, depthMm = axe Y, heightMm = axe Z. */
  envelope: {
    widthMm: number;
    depthMm: number;
    heightMm: number;
  };
  mountHoles: MountHole[];
  cutouts: Cutout[];
  keepouts: Keepout[];
  provenance: Provenance;
  confidence: Confidence;
  /** Version du schéma, commence à 1. */
  schemaVersion: number;
  notes?: string;
}

/** Index généré par `npm run db:build`. Jamais édité à la main. */
export interface ComponentIndex {
  generatedAt: string;
  count: number;
  byPartType: Record<string, { file: string; category: PartCategory; confidence: Confidence }>;
}

export interface ValidationIssue {
  partType: string;
  severity: 'error' | 'warning';
  code:
    | 'SCHEMA'
    | 'NEGATIVE_DIMENSION'
    | 'HOLE_OUTSIDE_ENVELOPE'
    | 'CUTOUT_OUTSIDE_SIDE'
    | 'MISSING_PROVENANCE'
    | 'DUPLICATE_PART_TYPE'
    | 'UNKNOWN_UNIT';
  message: string;
}

export interface ValidationReport {
  ok: boolean;
  checked: number;
  issues: ValidationIssue[];
}
