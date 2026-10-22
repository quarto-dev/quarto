/*
 * insert_symbol-grid.tsx
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import React from 'react';
import { Grid, useGridCallbackRef } from 'react-window';

import debounce from 'lodash.debounce';

import { EditorUI } from '../../api/ui-types';
import { WidgetProps } from '../../api/widgets/react';

import { CharacterGridCellItemData, SymbolCharacterCell } from './insert_symbol-grid-cell';
import { SymbolCharacter } from './insert_symbol-dataprovider';

import './insert_symbol-grid-styles.css';

interface CharacterGridProps extends WidgetProps {
  height: number;
  width: number;
  numberOfColumns: number;
  symbolCharacters: SymbolCharacter[];
  selectedIndex: number;
  onSelectionChanged: (selectedIndex: number) => void;
  onSelectionCommitted: VoidFunction;
  ui: EditorUI;
}

const selectedItemClassName = 'pm-grid-item-selected';

const SymbolCharacterGrid = React.forwardRef<HTMLDivElement, CharacterGridProps>((props, ref) => {
  const columnWidth = Math.floor(props.width / props.numberOfColumns);
  const characterCellData: CharacterGridCellItemData = {
    symbolCharacters: props.symbolCharacters,
    numberOfColumns: props.numberOfColumns,
    selectedIndex: props.selectedIndex,
    onSelectionChanged: props.onSelectionChanged,
    onSelectionCommitted: props.onSelectionCommitted,
    selectedItemClassName,
  };

  // The grid's API is held in state so that the scroll effect below runs
  // again once the grid has mounted
  const [grid, setGrid] = useGridCallbackRef(null);
  const rowCount = Math.ceil(props.symbolCharacters.length / props.numberOfColumns);
  const handleScroll = debounce(() => {
    // scrollToRow throws on an out-of-range index, where react-window 1 clamped it
    const index = Math.floor(props.selectedIndex / props.numberOfColumns);
    if (grid && index >= 0 && index < rowCount) {
      grid.scrollToRow({ index, align: 'auto' });
    }
  }, 5);

  React.useEffect(handleScroll, [grid, props.selectedIndex]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const newIndex = newIndexForKeyboardEvent(
      event,
      props.selectedIndex,
      props.numberOfColumns,
      props.symbolCharacters.length,
    );
    if (newIndex !== undefined) {
      props.onSelectionChanged(newIndex);
      event.preventDefault();
    }
  };

  return (
    <div onKeyDown={handleKeyDown} tabIndex={0} ref={ref}>
      <Grid
        columnCount={props.numberOfColumns}
        rowCount={rowCount}
        style={{ height: props.height, width: props.width + 1 }}
        rowHeight={columnWidth}
        columnWidth={columnWidth}
        cellComponent={SymbolCharacterCell}
        cellProps={characterCellData}
        className="pm-symbol-grid"
        gridRef={setGrid}
      />
    </div>
  );
});

function previous(currentIndex: number): number {
  const newIndex = currentIndex - 1;
  return Math.max(0, newIndex);
}
function next(currentIndex: number, _numberOfColumns: number, numberOfCells: number): number {
  const newIndex = currentIndex + 1;
  return Math.min(numberOfCells - 1, newIndex);
}
function prevRow(currentIndex: number, numberOfColumns: number): number {
  const newIndex = currentIndex - numberOfColumns;
  return newIndex >= 0 ? newIndex : currentIndex;
}
function nextRow(currentIndex: number, numberOfColumns: number, numberOfCells: number): number {
  const newIndex = currentIndex + numberOfColumns;
  return newIndex < numberOfCells ? newIndex : currentIndex;
}
function nextPage(currentIndex: number, numberOfColumns: number, numberOfCells: number): number {
  const newIndex = currentIndex + 6 * numberOfColumns;
  return Math.min(numberOfCells - 1, newIndex);
}
function prevPage(currentIndex: number, numberOfColumns: number): number {
  const newIndex = currentIndex - 6 * numberOfColumns;
  return Math.max(0, newIndex);
}

export const newIndexForKeyboardEvent = (
  event: React.KeyboardEvent,
  selectedIndex: number,
  numberOfColumns: number,
  numberOfCells: number,
): number | undefined => {
  switch (event.key) {
    case 'ArrowLeft': // left
      return previous(selectedIndex);

    case 'ArrowUp': // up
      return prevRow(selectedIndex, numberOfColumns);

    case 'ArrowRight': // right
      return next(selectedIndex, numberOfColumns, numberOfCells);

    case 'ArrowDown': // down
      return nextRow(selectedIndex, numberOfColumns, numberOfCells);

    case 'PageDown':
      return nextPage(selectedIndex, numberOfColumns, numberOfCells);

    case 'PageUp':
      return prevPage(selectedIndex, numberOfColumns);

    case 'Home':
      return 0;

    case 'End':
      return numberOfCells - 1;

    default:
      return undefined;
  }
};

export default SymbolCharacterGrid;
