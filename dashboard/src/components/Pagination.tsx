import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/base-ui/tooltip";
import { pageNumbers } from "../lib/utils";

export default function Pagination({
  page,
  total,
  pageSize,
  onChange,
  id,
}: {
  page: number;
  total: number;
  pageSize: number;
  onChange: (p: number) => void;
  id: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  if (total === 0) return null;

  return (
    <nav className="pagination" aria-label="Pagination">
      <span className="pagination-info">
        {start}–{end} of {total}
      </span>
      {totalPages > 1 && (
        <div className="pagination-content">
          <span className="pagination-item">
            <button
              type="button"
              className="pagination-nav pagination-previous"
              disabled={page <= 1}
              onClick={() => onChange(page - 1)}
            >
              ← Prev
            </button>
          </span>
          {pageNumbers(page, totalPages).map((n, i) =>
            n === "…" ? (
              <span key={`${id}-ellipsis-${i}`} className="pagination-item">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className="pagination-ellipsis"
                      tabIndex={0}
                      aria-label="More pages"
                    >
                      <span className="pagination-ellipsis-dots" aria-hidden>
                        …
                      </span>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="tooltip-indigo rounded-full">
                    <p>More pages</p>
                  </TooltipContent>
                </Tooltip>
              </span>
            ) : (
              <span key={`${id}-${n}`} className="pagination-item">
                <button
                  type="button"
                  className={`pagination-link ${n === page ? "active" : ""}`}
                  aria-current={n === page ? "page" : undefined}
                  onClick={() => onChange(n)}
                >
                  {n}
                </button>
              </span>
            ),
          )}
          <span className="pagination-item">
            <button
              type="button"
              className="pagination-nav pagination-next"
              disabled={page >= totalPages}
              onClick={() => onChange(page + 1)}
            >
              Next →
            </button>
          </span>
        </div>
      )}
    </nav>
  );
}
