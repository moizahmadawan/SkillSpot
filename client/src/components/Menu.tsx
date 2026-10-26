import { ReactNode, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

// Dropdown that closes after you pick an item, when you click elsewhere, press Escape, or the page changes.
export default function Menu({ trigger, label, children, width = 'w-48' }: { trigger: ReactNode; label: string; children: ReactNode; width?: string }) {
  const [open, setOpen] = useState(false); const ref = useRef<HTMLDivElement>(null); const loc = useLocation();
  useEffect(() => { setOpen(false); }, [loc.pathname, loc.search]);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex items-center gap-2">{trigger}</button>
      {open && <div role="menu" onClick={() => setOpen(false)} className={`absolute right-0 z-30 mt-2 ${width} rounded-xl border border-ink/10 bg-white p-1 shadow-lg`}>{children}</div>}
    </div>
  );
}
export const MenuItem = ({ children, onClick, danger }: { children: ReactNode; onClick?: () => void; danger?: boolean }) => (
  <button role="menuitem" type="button" onClick={onClick} className={`block w-full rounded-lg px-3 py-2 text-left hover:bg-leaf-soft ${danger ? 'text-danger' : ''}`}>{children}</button>
);
