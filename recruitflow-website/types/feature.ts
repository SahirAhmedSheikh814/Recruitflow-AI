/**
 * Shared shape for a single "Our Features" gallery entry.
 *
 * Mirrors the reference implementation's data shape exactly so the 5-column
 * mapping + hover-expand logic works unchanged:
 *   - id:     stable numeric id, referenced by featuresColumns
 *   - icon:   lucide-react icon name (kept for parity with the reference data
 *             shape; not rendered in the card UI, matching the reference)
 *   - color:  brand gradient token (Tailwind class fragment)
 *   - title:  feature title shown on the panel + detail card
 *   - points: bullet list rendered with check-marks in the detail card
 */
export interface Feature {
  id: number;
  icon: string;
  color: string;
  title: string;
  points: string[];
}
