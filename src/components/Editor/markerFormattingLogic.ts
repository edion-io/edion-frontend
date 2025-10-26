export interface MarkerDecisionInput {
  hasMarkerFormatting: boolean;
  hasAnyContentFormatting: boolean;
  hasFullContentFormatting: boolean;
  queryCommandState: boolean;
  isFullListItemSelection: boolean | null | HTMLElement;
  isCursorAtBeginningWithoutSelection: boolean;
}

export interface MarkerDecisionOutput {
  desiredFormattingState: boolean;
  hasFullContentFormatting: boolean;
}

// Normalize isFullListItemSelection which upstream may pass as non-null object
function asBool(value: MarkerDecisionInput['isFullListItemSelection']): boolean {
  return !!value;
}

// Implements the linear decision sequence described in the request.
export function computeDesiredFormattingState(input: MarkerDecisionInput): MarkerDecisionOutput {
  const hasMarkerFormatting = input.hasMarkerFormatting;
  const hasAnyContentFormatting = input.hasAnyContentFormatting;
  let hasFullContentFormatting = input.hasFullContentFormatting;
  const queryCommandState = input.queryCommandState;
  const isFullListItemSelection = asBool(input.isFullListItemSelection);
  const isCursorAtBeginningWithoutSelection = input.isCursorAtBeginningWithoutSelection;

  // 2) Default rule
  let desiredFormattingState = !(hasMarkerFormatting && hasFullContentFormatting);

  // 3) Cursor-at-beginning special case overrides desiredFormattingState
  if (isCursorAtBeginningWithoutSelection) {
    desiredFormattingState = !hasMarkerFormatting;
    // Ensure full-content is cleared for this path
    hasFullContentFormatting = false;
  }

  // 4) Final override independent of previous desiredFormattingState
  if (hasMarkerFormatting && isFullListItemSelection && queryCommandState) {
    desiredFormattingState = false;
  }

  return { desiredFormattingState, hasFullContentFormatting };
}


