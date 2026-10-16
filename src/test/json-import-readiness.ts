import { BROWSER_PAGE_SIZE, type BrowserStatus } from '../protocol';

/** Editor attachment reports ready before start() requests the initial table.
 * Real DOM Run clicks must wait until that table page is idle and rendered. */
export function populatedJsonBrowseReady(status: Pick<BrowserStatus, 'editorReady' | 'busy' | 'cachedRows' | 'renderedRows' | 'query'> | undefined): boolean {
  return status !== undefined && status.editorReady === true && !status.busy && status.query === false
    && status.cachedRows === BROWSER_PAGE_SIZE && status.renderedRows > 0;
}
