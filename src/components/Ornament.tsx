import React from 'react';

export function RuneDivider({ label }: { label?: string }) {
  return (
    <div className="rune-divider my-1">
      {label ? (
        <span className="font-fantasy text-[11px] uppercase tracking-[0.26em] text-[#C5A059]">
          ◆ {label} ◆
        </span>
      ) : (
        <span className="text-[10px] text-[#C5A059]/75">◆</span>
      )}
    </div>
  );
}
