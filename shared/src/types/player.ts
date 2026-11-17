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
}
