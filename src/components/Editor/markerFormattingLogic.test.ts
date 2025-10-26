import { describe, it, expect } from 'vitest';
import { computeDesiredFormattingState } from './markerFormattingLogic';

function decide(p: Partial<Parameters<typeof computeDesiredFormattingState>[0]>) {
  const defaults = {
    hasMarkerFormatting: false,
    hasAnyContentFormatting: false,
    hasFullContentFormatting: false,
    queryCommandState: false,
    isFullListItemSelection: false,
    isCursorAtBeginningWithoutSelection: false,
  };
  return computeDesiredFormattingState({ ...defaults, ...p });
}

describe('computeDesiredFormattingState', () => {
  // 2) Default rule: desired = !(hasMarker && hasFullContent)
  it('adds formatting when marker off and content not fully formatted', () => {
    const r = decide({ hasMarkerFormatting: false, hasFullContentFormatting: false });
    expect(r.desiredFormattingState).toBe(true);
  });

  it('removes formatting when marker on and content fully formatted', () => {
    const r = decide({ hasMarkerFormatting: true, hasFullContentFormatting: true });
    expect(r.desiredFormattingState).toBe(false);
  });

  it('adds formatting when marker on but content not fully formatted', () => {
    const r = decide({ hasMarkerFormatting: true, hasFullContentFormatting: false });
    expect(r.desiredFormattingState).toBe(true);
  });

  it('adds formatting when marker off but content fully formatted', () => {
    const r = decide({ hasMarkerFormatting: false, hasFullContentFormatting: true });
    expect(r.desiredFormattingState).toBe(true);
  });

  // 3) Cursor-at-beginning special case overrides desiredFormattingState and clears full-content
  it('cursor at beginning toggles marker, clears full-content (marker off -> on)', () => {
    const r = decide({ hasMarkerFormatting: false, hasFullContentFormatting: true, isCursorAtBeginningWithoutSelection: true });
    expect(r.desiredFormattingState).toBe(true);
    expect(r.hasFullContentFormatting).toBe(false);
  });

  it('cursor at beginning toggles marker (marker on -> off)', () => {
    const r = decide({ hasMarkerFormatting: true, hasFullContentFormatting: false, isCursorAtBeginningWithoutSelection: true });
    expect(r.desiredFormattingState).toBe(false);
  });

  // 4) Final override: if marker on && full list selection && queryCommandState => false
  it('final override removes formatting when marker on, full selection, query true', () => {
    const r = decide({ hasMarkerFormatting: true, isFullListItemSelection: true, queryCommandState: true });
    expect(r.desiredFormattingState).toBe(false);
  });

  // Mixed scenarios: any-content formatting variations
  it('mixed content formatting with query true but not full content still follows default unless override', () => {
    const r = decide({ hasMarkerFormatting: false, hasAnyContentFormatting: true, hasFullContentFormatting: false, queryCommandState: true });
    expect(r.desiredFormattingState).toBe(true);
  });

  // Collapsed vs selection
  it('selection (not collapsed) uses default rule', () => {
    const r = decide({ hasMarkerFormatting: true, hasFullContentFormatting: true, isCursorAtBeginningWithoutSelection: false });
    expect(r.desiredFormattingState).toBe(false);
  });
});


