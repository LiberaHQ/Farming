/**
 * Master palette. Every tile and sprite draws from this list so the world
 * reads as one coherent piece of pixel art.
 */
export const P = {
  outline: '#2b1d1a',

  grass: '#5f9e3e',
  grassShade: '#558f38',
  grassDark: '#447a30',
  grassLight: '#76b34a',
  grassHi: '#97cc5c',
  grassSeed: '#d9c36b',

  waterDeep: '#2c6a96',
  water: '#3a83b5',
  waterLight: '#58a4d2',
  foam: '#d3edf5',

  bank: '#7a5434',
  bankDark: '#583b24',

  dirt: '#bf9058',
  dirtDark: '#a07443',
  dirtLight: '#d6ac74',

  wood: '#a8703d',
  woodDark: '#6f4626',
  woodLight: '#c9905a',

  trunk: '#7c512c',
  trunkDark: '#58381d',
  trunkLight: '#9a6a3c',

  leaf: '#3f8c3c',
  leafDark: '#2d6a33',
  leafLight: '#5aac46',
  leafHi: '#84c95a',

  pine: '#2f7a52',
  pineDark: '#215c40',
  pineLight: '#46996a',
  pineHi: '#6dbb84',

  stone: '#959ca3',
  stoneDark: '#6a7179',
  stoneLight: '#bcc2c7',
  stoneHi: '#dfe3e6',

  berry: '#d2404c',
  berryHi: '#f19a9a',

  flowerYellow: '#f4d24a',
  flowerWhite: '#f6f3e8',
  flowerPink: '#ea7194',
  flowerBlue: '#8fb0ff',
  flowerCenter: '#f7e27c',

  cheek: '#eaa48c',
  eye: '#2b1d1a',
} as const;
