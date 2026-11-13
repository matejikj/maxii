import { TIGER_ANATOMY, HIPPO_ANATOMY } from './playmatesAnatomy';
/**
 * Canonical LUMI anatomy, with sculpted artwork authored inside named parts.
 * Author changes here; never duplicate shape definitions in artwork.ts.
 *
 * Every item is an independent part with a stable ID, explicit role and z-order.
 */
import type { LumiAnimal } from '../types';
import type { CharacterPart } from './blueprint';
import { applySoftCompactFleetPolish } from './fleetPolish';
import { NEW_SPECIES_ANATOMY } from './newSpeciesAnatomy';
import { selectRabbitAnatomy } from './rabbitArtDirection';
import { sculptCharacterAnatomy } from './sculptedAnatomy';

/** Pre-direction rabbit geometry used to build comparable art variants A/B/C. */
export const RABBIT_ANATOMY_BASELINE: readonly CharacterPart[] = [
    {
      "id": "shadow",
      "role": "shadow",
      "order": 0,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": -18,
          "cy": -3,
          "rx": 16,
          "ry": 7,
          "fill": "#6E947F",
          "opacity": 0.12
        }
      }
    },
    {
      "id": "ear-left-outer",
      "role": "ear",
      "order": 1,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": -44,
          "cy": -83,
          "rx": 20,
          "ry": 70,
          "transform": "rotate(-14 -44 -83)",
          "fill": "#EDE0D6"
        }
      }
    },
    {
      "id": "ear-right-outer",
      "role": "ear",
      "order": 2,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": 32,
          "cy": -88,
          "rx": 20,
          "ry": 72,
          "transform": "rotate(13 32 -88)",
          "fill": "#EDE0D6"
        }
      }
    },
    {
      "id": "ear-left-inner",
      "role": "ear",
      "order": 3,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": -44,
          "cy": -83,
          "rx": 9,
          "ry": 52,
          "transform": "rotate(-14 -44 -83)",
          "fill": "#E7B8B6",
          "opacity": 0.84
        }
      }
    },
    {
      "id": "ear-right-inner",
      "role": "ear",
      "order": 4,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": 32,
          "cy": -88,
          "rx": 9,
          "ry": 52,
          "transform": "rotate(13 32 -88)",
          "fill": "#E7B8B6",
          "opacity": 0.84
        }
      }
    },
    {
      "id": "body",
      "role": "body",
      "order": 5,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": 0,
          "cy": 74,
          "rx": 91,
          "ry": 85,
          "fill": "#EDE0D6"
        }
      }
    },
    {
      "id": "belly",
      "role": "belly",
      "order": 6,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": 0,
          "cy": 82,
          "rx": 54,
          "ry": 58,
          "fill": "#FBF6F0"
        }
      }
    },
    {
      "id": "paw-left",
      "role": "paw",
      "order": 7,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": -79,
          "cy": 98,
          "rx": 24,
          "ry": 17,
          "transform": "rotate(-28 -79 98)",
          "fill": "#EDE0D6"
        }
      }
    },
    {
      "id": "paw-right",
      "role": "paw",
      "order": 8,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": 79,
          "cy": 98,
          "rx": 24,
          "ry": 17,
          "transform": "rotate(28 79 98)",
          "fill": "#EDE0D6"
        }
      }
    },
    {
      "id": "foot-left",
      "role": "paw",
      "order": 9,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": -47,
          "cy": 148,
          "rx": 26,
          "ry": 16,
          "fill": "#E9D3C8"
        }
      }
    },
    {
      "id": "foot-right",
      "role": "paw",
      "order": 10,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": 47,
          "cy": 148,
          "rx": 26,
          "ry": 16,
          "fill": "#E9D3C8"
        }
      }
    },
    {
      "id": "head",
      "role": "head",
      "order": 11,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": 0,
          "cy": -3,
          "rx": 91,
          "ry": 78,
          "fill": "#F1E5DA"
        }
      }
    },
    {
      "id": "cheek-left",
      "role": "cheek",
      "order": 12,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": -56,
          "cy": 27,
          "rx": 17,
          "ry": 11,
          "fill": "#EAB8B0",
          "opacity": 0.7
        }
      }
    },
    {
      "id": "cheek-right",
      "role": "cheek",
      "order": 13,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": 56,
          "cy": 27,
          "rx": 17,
          "ry": 11,
          "fill": "#EAB8B0",
          "opacity": 0.7
        }
      }
    },
    {
      "id": "eye-left",
      "role": "eye",
      "order": 14,
      "geometry": {
        "kind": "path",
        "props": {
          "d": "M-43 8 Q-30 -2 -17 8",
          "stroke": "#5A5550",
          "strokeWidth": 4.3,
          "fill": "none",
          "strokeLinecap": "round"
        }
      }
    },
    {
      "id": "eye-right",
      "role": "eye",
      "order": 15,
      "geometry": {
        "kind": "path",
        "props": {
          "d": "M17 8 Q30 -2 43 8",
          "stroke": "#5A5550",
          "strokeWidth": 4.3,
          "fill": "none",
          "strokeLinecap": "round"
        }
      }
    },
    {
      "id": "mouth",
      "role": "mouth",
      "order": 16,
      "geometry": {
        "kind": "path",
        "props": {
          "d": "M-5 21 Q0 26 5 21",
          "fill": "none",
          "stroke": "#9E716F",
          "strokeWidth": 2.5,
          "strokeLinecap": "round"
        }
      }
    },
    {
      "id": "nose",
      "role": "nose",
      "order": 17,
      "geometry": {
        "kind": "circle",
        "props": {
          "cx": 0,
          "cy": 16,
          "r": 3.3,
          "fill": "#B07F7C"
        }
      }
    },
    {
      "id": "seed-mark",
      "role": "mark",
      "order": 18,
      "geometry": {
        "kind": "group",
        "props": {
          "transform": "translate(0 91) scale(0.85)"
        },
        "children": [
          {
            "kind": "path",
            "props": {
              "d": "M0 -10 C9 -7 10 1 0 10 C-10 1 -9 -7 0 -10Z",
              "fill": "#B3C7AB"
            }
          },
          {
            "kind": "path",
            "props": {
              "d": "M0 0Q4 -4 7 -3",
              "stroke": "#FFFFFF",
              "strokeWidth": 1.3,
              "fill": "none",
              "strokeLinecap": "round"
            }
          }
        ]
      }
    },
    {
      "id": "highlight",
      "role": "mark",
      "order": 19,
      "geometry": {
        "kind": "path",
        "props": {
          "d": "M-56 -67 Q-50 -74 -44 -68",
          "fill": "none",
          "stroke": "#FFFFFF",
          "strokeWidth": 2.2,
          "opacity": 0.65,
          "strokeLinecap": "round"
        }
      }
    }
];

const BEAR_ANATOMY_BASE: readonly CharacterPart[] = [
    {
      "id": "ear-left-outer",
      "role": "ear",
      "order": 0,
      "geometry": {
        "kind": "circle",
        "props": {
          "cx": -68,
          "cy": -49,
          "r": 33,
          "fill": "#CFAE85"
        }
      }
    },
    {
      "id": "ear-right-outer",
      "role": "ear",
      "order": 1,
      "geometry": {
        "kind": "circle",
        "props": {
          "cx": 68,
          "cy": -49,
          "r": 33,
          "fill": "#CFAE85"
        }
      }
    },
    {
      "id": "ear-left-inner",
      "role": "ear",
      "order": 2,
      "geometry": {
        "kind": "circle",
        "props": {
          "cx": -68,
          "cy": -49,
          "r": 19,
          "fill": "#EBCDB3"
        }
      }
    },
    {
      "id": "ear-right-inner",
      "role": "ear",
      "order": 3,
      "geometry": {
        "kind": "circle",
        "props": {
          "cx": 68,
          "cy": -49,
          "r": 19,
          "fill": "#EBCDB3"
        }
      }
    },
    {
      "id": "body",
      "role": "body",
      "order": 4,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": 0,
          "cy": 77,
          "rx": 92,
          "ry": 86,
          "fill": "#DAB991"
        }
      }
    },
    {
      "id": "belly",
      "role": "belly",
      "order": 5,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": 0,
          "cy": 85,
          "rx": 56,
          "ry": 58,
          "fill": "#F5E4CE"
        }
      }
    },
    {
      "id": "paw-left",
      "role": "paw",
      "order": 6,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": -79,
          "cy": 99,
          "rx": 25,
          "ry": 17,
          "transform": "rotate(-20 -79 99)",
          "fill": "#D5B18A"
        }
      }
    },
    {
      "id": "paw-right",
      "role": "paw",
      "order": 7,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": 79,
          "cy": 99,
          "rx": 25,
          "ry": 17,
          "transform": "rotate(20 79 99)",
          "fill": "#D5B18A"
        }
      }
    },
    {
      "id": "foot-left",
      "role": "paw",
      "order": 8,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": -48,
          "cy": 147,
          "rx": 26,
          "ry": 17,
          "fill": "#C8A57E"
        }
      }
    },
    {
      "id": "foot-right",
      "role": "paw",
      "order": 9,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": 48,
          "cy": 147,
          "rx": 26,
          "ry": 17,
          "fill": "#C8A57E"
        }
      }
    },
    {
      "id": "head",
      "role": "head",
      "order": 10,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": 0,
          "cy": -3,
          "rx": 92,
          "ry": 79,
          "fill": "#E1C19B"
        }
      }
    },
    {
      "id": "muzzle",
      "role": "muzzle",
      "order": 11,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": 0,
          "cy": 25,
          "rx": 34,
          "ry": 24,
          "fill": "#F4E6D5"
        }
      }
    },
    {
      "id": "cheek-left",
      "role": "cheek",
      "order": 12,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": -58,
          "cy": 22,
          "rx": 17,
          "ry": 10,
          "fill": "#ECAFA0",
          "opacity": 0.56
        }
      }
    },
    {
      "id": "cheek-right",
      "role": "cheek",
      "order": 13,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": 58,
          "cy": 22,
          "rx": 17,
          "ry": 10,
          "fill": "#ECAFA0",
          "opacity": 0.56
        }
      }
    },
    {
      "id": "eye-left",
      "role": "eye",
      "order": 14,
      "geometry": {
        "kind": "circle",
        "props": {
          "cx": -31,
          "cy": 2,
          "r": 4.4,
          "fill": "#5D5149"
        }
      }
    },
    {
      "id": "eye-right",
      "role": "eye",
      "order": 15,
      "geometry": {
        "kind": "circle",
        "props": {
          "cx": 31,
          "cy": 2,
          "r": 4.4,
          "fill": "#5D5149"
        }
      }
    },
    {
      "id": "nose",
      "role": "nose",
      "order": 16,
      "geometry": {
        "kind": "path",
        "props": {
          "d": "M-8 18 Q0 11 8 18 Q6 25 0 25 Q-6 25 -8 18Z",
          "fill": "#66544B"
        }
      }
    },
    {
      "id": "mouth",
      "role": "mouth",
      "order": 17,
      "geometry": {
        "kind": "path",
        "props": {
          "d": "M0 25 Q-1 34 -10 34 M0 25 Q1 34 10 34",
          "fill": "none",
          "stroke": "#66544B",
          "strokeWidth": 2,
          "strokeLinecap": "round"
        }
      }
    },
    {
      "id": "seed-mark",
      "role": "mark",
      "order": 18,
      "geometry": {
        "kind": "group",
        "props": {
          "transform": "translate(0 93) scale(0.87)"
        },
        "children": [
          {
            "kind": "path",
            "props": {
              "d": "M0 -10 C9 -7 10 1 0 10 C-10 1 -9 -7 0 -10Z",
              "fill": "#AFC7A2"
            }
          },
          {
            "kind": "path",
            "props": {
              "d": "M0 0Q4 -4 7 -3",
              "stroke": "#FFFFFF",
              "strokeWidth": 1.3,
              "fill": "none",
              "strokeLinecap": "round"
            }
          }
        ]
      }
    }
  ];

const FOX_ANATOMY_BASE: readonly CharacterPart[] = [
    {
      "id": "tail",
      "role": "tail",
      "order": 0,
      "geometry": {
        "kind": "path",
        "props": {
          "d": "M64 98 C173 45 178 166 95 174 C45 180 35 142 65 127Z",
          "fill": "#E6A77E"
        }
      }
    },
    {
      "id": "tail-tip",
      "role": "tail",
      "order": 1,
      "geometry": {
        "kind": "path",
        "props": {
          "d": "M144 108 Q176 150 123 165 Q131 144 144 108Z",
          "fill": "#FFF1E3"
        }
      }
    },
    {
      "id": "ear-left-outer",
      "role": "ear",
      "order": 2,
      "geometry": {
        "kind": "path",
        "props": {
          "d": "M-87 -50 L-80 -139 Q-42 -121 -24 -72Z",
          "fill": "#CD8F75"
        }
      }
    },
    {
      "id": "ear-right-outer",
      "role": "ear",
      "order": 3,
      "geometry": {
        "kind": "path",
        "props": {
          "d": "M87 -50 L80 -139 Q42 -121 24 -72Z",
          "fill": "#CD8F75"
        }
      }
    },
    {
      "id": "ear-left-inner",
      "role": "ear",
      "order": 4,
      "geometry": {
        "kind": "path",
        "props": {
          "d": "M-70 -69 L-70 -114 Q-50 -99 -40 -76Z",
          "fill": "#EDC0AE"
        }
      }
    },
    {
      "id": "ear-right-inner",
      "role": "ear",
      "order": 5,
      "geometry": {
        "kind": "path",
        "props": {
          "d": "M70 -69 L70 -114 Q50 -99 40 -76Z",
          "fill": "#EDC0AE"
        }
      }
    },
    {
      "id": "body",
      "role": "body",
      "order": 6,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": 0,
          "cy": 75,
          "rx": 92,
          "ry": 84,
          "fill": "#E8A987"
        }
      }
    },
    {
      "id": "belly",
      "role": "belly",
      "order": 7,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": 0,
          "cy": 82,
          "rx": 54,
          "ry": 56,
          "fill": "#FFF1E6"
        }
      }
    },
    {
      "id": "paw-left",
      "role": "paw",
      "order": 8,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": -72,
          "cy": 100,
          "rx": 25,
          "ry": 19,
          "fill": "#D99678"
        }
      }
    },
    {
      "id": "paw-right",
      "role": "paw",
      "order": 9,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": 72,
          "cy": 100,
          "rx": 25,
          "ry": 19,
          "fill": "#D99678"
        }
      }
    },
    {
      "id": "foot-left",
      "role": "paw",
      "order": 10,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": -44,
          "cy": 143,
          "rx": 26,
          "ry": 16,
          "fill": "#D98D72"
        }
      }
    },
    {
      "id": "foot-right",
      "role": "paw",
      "order": 11,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": 44,
          "cy": 143,
          "rx": 26,
          "ry": 16,
          "fill": "#D98D72"
        }
      }
    },
    {
      "id": "head",
      "role": "head",
      "order": 12,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": 0,
          "cy": -2,
          "rx": 91,
          "ry": 78,
          "fill": "#EBAF89"
        }
      }
    },
    {
      "id": "muzzle",
      "role": "muzzle",
      "order": 13,
      "geometry": {
        "kind": "path",
        "props": {
          "d": "M-82 8 C-64 26 -36 39 0 45 C36 39 64 26 82 8 Q68 70 0 73 Q-68 70 -82 8",
          "fill": "#FFF1E8"
        }
      }
    },
    {
      "id": "cheek-left",
      "role": "cheek",
      "order": 14,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": -55,
          "cy": 16,
          "rx": 15,
          "ry": 9,
          "fill": "#E8B0A2",
          "opacity": 0.6
        }
      }
    },
    {
      "id": "cheek-right",
      "role": "cheek",
      "order": 15,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": 55,
          "cy": 16,
          "rx": 15,
          "ry": 9,
          "fill": "#E8B0A2",
          "opacity": 0.6
        }
      }
    },
    {
      "id": "eye-left",
      "role": "eye",
      "order": 16,
      "geometry": {
        "kind": "path",
        "props": {
          "d": "M-43 4 Q-31 -6 -19 4",
          "stroke": "#705B58",
          "strokeWidth": 4.1,
          "fill": "none",
          "strokeLinecap": "round"
        }
      }
    },
    {
      "id": "eye-right",
      "role": "eye",
      "order": 17,
      "geometry": {
        "kind": "path",
        "props": {
          "d": "M19 4 Q31 -6 43 4",
          "stroke": "#705B58",
          "strokeWidth": 4.1,
          "fill": "none",
          "strokeLinecap": "round"
        }
      }
    },
    {
      "id": "mouth",
      "role": "mouth",
      "order": 18,
      "geometry": {
        "kind": "path",
        "props": {
          "d": "M-6 35 Q0 42 6 35",
          "fill": "none",
          "stroke": "#AF7870",
          "strokeWidth": 2,
          "strokeLinecap": "round"
        }
      }
    },
    {
      "id": "nose",
      "role": "nose",
      "order": 19,
      "geometry": {
        "kind": "path",
        "props": {
          "d": "M-7 29 L7 29 Q5 38 0 38 Q-5 38 -7 29Z",
          "fill": "#855C57"
        }
      }
    },
    {
      "id": "seed-mark",
      "role": "mark",
      "order": 20,
      "geometry": {
        "kind": "group",
        "props": {
          "transform": "translate(0 96) scale(0.85)"
        },
        "children": [
          {
            "kind": "path",
            "props": {
              "d": "M0 -10 C9 -7 10 1 0 10 C-10 1 -9 -7 0 -10Z",
              "fill": "#D7BDA2"
            }
          },
          {
            "kind": "path",
            "props": {
              "d": "M0 0Q4 -4 7 -3",
              "stroke": "#FFFFFF",
              "strokeWidth": 1.3,
              "fill": "none",
              "strokeLinecap": "round"
            }
          }
        ]
      }
    }
  ];

const OTTER_ANATOMY_BASE: readonly CharacterPart[] = [
    {
      "id": "tail",
      "role": "tail",
      "order": 0,
      "geometry": {
        "kind": "path",
        "props": {
          "d": "M73 93 C163 78 160 164 115 163 Q100 156 110 140 Q145 114 86 119Z",
          "fill": "#B98D78"
        }
      }
    },
    {
      "id": "ear-left",
      "role": "ear",
      "order": 1,
      "geometry": {
        "kind": "circle",
        "props": {
          "cx": -74,
          "cy": -51,
          "r": 27,
          "fill": "#C7A08C"
        }
      }
    },
    {
      "id": "ear-right",
      "role": "ear",
      "order": 2,
      "geometry": {
        "kind": "circle",
        "props": {
          "cx": 74,
          "cy": -51,
          "r": 27,
          "fill": "#C7A08C"
        }
      }
    },
    {
      "id": "body",
      "role": "body",
      "order": 3,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": 0,
          "cy": 78,
          "rx": 90,
          "ry": 88,
          "fill": "#C9A38C"
        }
      }
    },
    {
      "id": "belly",
      "role": "belly",
      "order": 4,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": 0,
          "cy": 82,
          "rx": 54,
          "ry": 62,
          "fill": "#F4E4D5"
        }
      }
    },
    {
      "id": "paw-left",
      "role": "paw",
      "order": 5,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": -74,
          "cy": 104,
          "rx": 25,
          "ry": 17,
          "fill": "#C29880"
        }
      }
    },
    {
      "id": "paw-right",
      "role": "paw",
      "order": 6,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": 74,
          "cy": 104,
          "rx": 25,
          "ry": 17,
          "fill": "#C29880"
        }
      }
    },
    {
      "id": "foot-left",
      "role": "paw",
      "order": 7,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": -43,
          "cy": 147,
          "rx": 26,
          "ry": 16,
          "fill": "#B98D78"
        }
      }
    },
    {
      "id": "foot-right",
      "role": "paw",
      "order": 8,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": 43,
          "cy": 147,
          "rx": 26,
          "ry": 16,
          "fill": "#B98D78"
        }
      }
    },
    {
      "id": "head",
      "role": "head",
      "order": 9,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": 0,
          "cy": -5,
          "rx": 89,
          "ry": 80,
          "fill": "#D3AD96"
        }
      }
    },
    {
      "id": "muzzle",
      "role": "muzzle",
      "order": 10,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": 0,
          "cy": 24,
          "rx": 47,
          "ry": 29,
          "fill": "#F4E3D7"
        }
      }
    },
    {
      "id": "eye-left",
      "role": "eye",
      "order": 11,
      "geometry": {
        "kind": "circle",
        "props": {
          "cx": -31,
          "cy": 0,
          "r": 4,
          "fill": "#594D4A"
        }
      }
    },
    {
      "id": "eye-right",
      "role": "eye",
      "order": 12,
      "geometry": {
        "kind": "circle",
        "props": {
          "cx": 31,
          "cy": 0,
          "r": 4,
          "fill": "#594D4A"
        }
      }
    },
    {
      "id": "nose",
      "role": "nose",
      "order": 13,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": 0,
          "cy": 20,
          "rx": 8,
          "ry": 5,
          "fill": "#76615A"
        }
      }
    },
    {
      "id": "mouth",
      "role": "mouth",
      "order": 14,
      "geometry": {
        "kind": "path",
        "props": {
          "d": "M0 25 Q-8 35 -15 27 M0 25 Q8 35 15 27",
          "stroke": "#76615A",
          "strokeWidth": 2,
          "fill": "none",
          "strokeLinecap": "round"
        }
      }
    },
    {
      "id": "cheek-left",
      "role": "cheek",
      "order": 15,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": -59,
          "cy": 24,
          "rx": 16,
          "ry": 10,
          "fill": "#E8ADA2",
          "opacity": 0.6
        }
      }
    },
    {
      "id": "cheek-right",
      "role": "cheek",
      "order": 16,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": 59,
          "cy": 24,
          "rx": 16,
          "ry": 10,
          "fill": "#E8ADA2",
          "opacity": 0.6
        }
      }
    },
    {
      "id": "seed-mark",
      "role": "mark",
      "order": 17,
      "geometry": {
        "kind": "group",
        "props": {
          "transform": "translate(0 91) scale(0.85)"
        },
        "children": [
          {
            "kind": "path",
            "props": {
              "d": "M0 -10 C9 -7 10 1 0 10 C-10 1 -9 -7 0 -10Z",
              "fill": "#AFC5A2"
            }
          },
          {
            "kind": "path",
            "props": {
              "d": "M0 0Q4 -4 7 -3",
              "stroke": "#FFFFFF",
              "strokeWidth": 1.3,
              "fill": "none",
              "strokeLinecap": "round"
            }
          }
        ]
      }
    }
  ];

const HEDGEHOG_ANATOMY_BASE: readonly CharacterPart[] = [
    {
      "id": "spines",
      "role": "spines",
      "order": 0,
      "geometry": {
        "kind": "path",
        "props": {
          "d": "M-102 47 L-112 20 L-87 12 L-98 -18 L-70 -19 L-68 -50 L-42 -44 L-26 -70 L-2 -53 L21 -70 L44 -43 L67 -51 L72 -21 L100 -18 L91 12 L113 22 L100 49 Q113 152 0 168 Q-105 155 -102 47",
          "fill": "#BD9C87"
        }
      }
    },
    {
      "id": "body",
      "role": "body",
      "order": 1,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": 0,
          "cy": 74,
          "rx": 87,
          "ry": 88,
          "fill": "#D8B39D"
        }
      }
    },
    {
      "id": "belly",
      "role": "belly",
      "order": 2,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": 0,
          "cy": 84,
          "rx": 54,
          "ry": 56,
          "fill": "#F7E6D6"
        }
      }
    },
    {
      "id": "paw-left",
      "role": "paw",
      "order": 3,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": -70,
          "cy": 106,
          "rx": 25,
          "ry": 17,
          "fill": "#C8A18B"
        }
      }
    },
    {
      "id": "paw-right",
      "role": "paw",
      "order": 4,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": 70,
          "cy": 106,
          "rx": 25,
          "ry": 17,
          "fill": "#C8A18B"
        }
      }
    },
    {
      "id": "foot-left",
      "role": "paw",
      "order": 5,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": -45,
          "cy": 146,
          "rx": 26,
          "ry": 16,
          "fill": "#BE9B87"
        }
      }
    },
    {
      "id": "foot-right",
      "role": "paw",
      "order": 6,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": 45,
          "cy": 146,
          "rx": 26,
          "ry": 16,
          "fill": "#BE9B87"
        }
      }
    },
    {
      "id": "head",
      "role": "head",
      "order": 7,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": 0,
          "cy": 0,
          "rx": 80,
          "ry": 75,
          "fill": "#F0D5BF"
        }
      }
    },
    {
      "id": "eye-left",
      "role": "eye",
      "order": 8,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": -28,
          "cy": 2,
          "rx": 4,
          "ry": 5,
          "fill": "#5D514D"
        }
      }
    },
    {
      "id": "eye-right",
      "role": "eye",
      "order": 9,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": 28,
          "cy": 2,
          "rx": 4,
          "ry": 5,
          "fill": "#5D514D"
        }
      }
    },
    {
      "id": "nose",
      "role": "nose",
      "order": 10,
      "geometry": {
        "kind": "circle",
        "props": {
          "cx": 0,
          "cy": 23,
          "r": 5,
          "fill": "#74574E"
        }
      }
    },
    {
      "id": "mouth",
      "role": "mouth",
      "order": 11,
      "geometry": {
        "kind": "path",
        "props": {
          "d": "M-7 30 Q0 38 7 30",
          "fill": "none",
          "stroke": "#74574E",
          "strokeWidth": 2.3,
          "strokeLinecap": "round"
        }
      }
    },
    {
      "id": "cheek-left",
      "role": "cheek",
      "order": 12,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": -54,
          "cy": 25,
          "rx": 15,
          "ry": 10,
          "fill": "#E8B1A8",
          "opacity": 0.7
        }
      }
    },
    {
      "id": "cheek-right",
      "role": "cheek",
      "order": 13,
      "geometry": {
        "kind": "ellipse",
        "props": {
          "cx": 54,
          "cy": 25,
          "rx": 15,
          "ry": 10,
          "fill": "#E8B1A8",
          "opacity": 0.7
        }
      }
    },
    {
      "id": "seed-mark",
      "role": "mark",
      "order": 14,
      "geometry": {
        "kind": "group",
        "props": {
          "transform": "translate(0 90) scale(0.85)"
        },
        "children": [
          {
            "kind": "path",
            "props": {
              "d": "M0 -10 C9 -7 10 1 0 10 C-10 1 -9 -7 0 -10Z",
              "fill": "#C7A48B"
            }
          },
          {
            "kind": "path",
            "props": {
              "d": "M0 0Q4 -4 7 -3",
              "stroke": "#FFFFFF",
              "strokeWidth": 1.3,
              "fill": "none",
              "strokeLinecap": "round"
            }
          }
        ]
      }
    }
  ];

export const CHARACTER_ANATOMY: Readonly<Record<LumiAnimal, readonly CharacterPart[]>> = {
  tiger: TIGER_ANATOMY,
  hippo: HIPPO_ANATOMY,
  rabbit: selectRabbitAnatomy(RABBIT_ANATOMY_BASELINE),
  bear: sculptCharacterAnatomy('bear', applySoftCompactFleetPolish(BEAR_ANATOMY_BASE)),
  fox: sculptCharacterAnatomy('fox', applySoftCompactFleetPolish(FOX_ANATOMY_BASE)),
  otter: sculptCharacterAnatomy('otter', applySoftCompactFleetPolish(OTTER_ANATOMY_BASE)),
  hedgehog: sculptCharacterAnatomy('hedgehog', applySoftCompactFleetPolish(HEDGEHOG_ANATOMY_BASE)),
  owl: sculptCharacterAnatomy('owl', NEW_SPECIES_ANATOMY.owl),
  squirrel: sculptCharacterAnatomy('squirrel', NEW_SPECIES_ANATOMY.squirrel),
  fawn: sculptCharacterAnatomy('fawn', NEW_SPECIES_ANATOMY.fawn),
};
