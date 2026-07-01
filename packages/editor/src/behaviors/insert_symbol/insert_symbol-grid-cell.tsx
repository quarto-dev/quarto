/*
 * insert_symbol-grid-cell.tsx
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import React from 'react';
import { GridChildComponentProps } from 'react-window';

import { SymbolCharacter } from './insert_symbol-dataprovider';

export interface CharacterGridCellItemData {
  symbolCharacters: SymbolCharacter[];
  numberOfColumns: number;
  selectedIndex: number;
  selectedItemClassName: string;
  onSelectionChanged: (selectedIndex: number) => void;
  onSelectionCommitted: VoidFunction;
}

export const SymbolCharacterCell = (props: GridChildComponentProps) => {
  const characterGridCellItemData = props.data as CharacterGridCellItemData;
  const symbolCharacters = characterGridCellItemData.symbolCharacters;
  const itemIndex = props.rowIndex * characterGridCellItemData.numberOfColumns + props.columnIndex;

  const handleMouseEnter = () => {
    characterGridCellItemData.onSelectionChanged(itemIndex);
  };

  // If we don't handle and eat the mouse down event, the mouse down will propagate to the parent
  // editor and result in loss of focus to this element
  const handleMouseDown = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleMouseClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    characterGridCellItemData.onSelectionCommitted();
  };

  if (itemIndex < symbolCharacters.length) {
    const ch = symbolCharacters[itemIndex];
    return (
      <div
        tabIndex={-1}
        style={props.style}
        className="pm-symbol-grid-container"
        onClick={handleMouseClick}
        onMouseDown={handleMouseDown}
        onMouseEnter={handleMouseEnter}
      >
        <div
          className={`pm-symbol-grid-cell pm-grid-item pm-emoji-font ${
            characterGridCellItemData.selectedIndex === itemIndex ? characterGridCellItemData.selectedItemClassName : ''
            }`}
        >
          {ch.value || ''}
        </div>
      </div>
    );
  } else {
    return null;
  }
};
