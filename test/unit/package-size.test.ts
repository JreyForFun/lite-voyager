import { expect, test } from 'vitest';
import { assertPackageSize } from '../../scripts/package-size.mts';

test.each([1, 9_999_999])('NFR-008: Given a %i-byte VSIX, When enforcing the package budget, Then nonempty output strictly under 10 MB is accepted', (bytes) => {
  expect(() => assertPackageSize(bytes)).not.toThrow();
});
test.each([0, -1, 10_000_000, 10_000_001, Number.NaN, Number.POSITIVE_INFINITY, 1.5])('NFR-008: Given an empty, invalid or oversized %i-byte VSIX, When enforcing the package budget, Then verification fails visibly', (bytes) => {
  expect(() => assertPackageSize(bytes)).toThrow(/VSIX/);
});
