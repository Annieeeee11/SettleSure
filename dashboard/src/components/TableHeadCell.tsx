import type { ReactNode } from "react";

export default function TableHeadCell({
  icon,
  label,
}: {
  icon: ReactNode;
  label: string;
}) {
  return (
    <span className="data-table-head-cell">
      <span className="data-table-head-icon" aria-hidden>
        {icon}
      </span>
      {label}
    </span>
  );
}
