import { colors } from '@/tokens';

export function InlineStyles() {
  return (
    <style>{`
      @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.5; transform: scale(1.3); }
      }
      .pipeline-running-row {
        background-color: ${colors.primary[50]} !important;
      }
      .pipeline-running-row:hover td {
        background-color: ${colors.primary[50]} !important;
      }
    `}</style>
  );
}
