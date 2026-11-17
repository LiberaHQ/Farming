export type Direction = 'down' | 'left' | 'right' | 'up';

/**
 * Colours used to render the player sprite sheet. The sheet is generated at
 * boot from these values, which is the foundation for character customisation.
 */
export interface CharacterAppearance {
  skin: string;
  skinShade: string;
  hair: string;
  hairLight: string;
  shirt: string;
  shirtDark: string;
  pants: string;
  pantsDark: string;
  shoes: string;
  /** The player's extra looks (villagers don't use these). */
  shoesLight?: string;
  eyes?: string;
  hairStyle?: 'short' | 'long' | 'ponytail' | 'bun' | 'curly' | 'spiky' | 'bob';
  hat?: 'none' | 'straw' | 'cap' | 'beanie' | 'bandana' | 'flower';
  outfit?: 'shirt' | 'tee' | 'overalls' | 'dress';
}
