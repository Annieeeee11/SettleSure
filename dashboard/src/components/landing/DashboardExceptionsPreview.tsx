import TableHeadCell from "@/components/TableHeadCell";
import { RecordIcon, SourceIcon, TypeIcon } from "@/components/TableIcons";

const ROWS = [
  {
    recordId: "setl_0068",
    source: "settlement",
    type: "fee/tax miscalculation",
  },
  {
    recordId: "bank_0052",
    source: "bank",
    type: "currency mismatch",
  },
  {
    recordId: "bank_0036",
    source: "bank+settlement",
    type: "ambiguous pair",
  },
] as const;

export default function DashboardExceptionsPreview({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`border border-[var(--card-border)] bg-[var(--surface)] shadow-[var(--shadow-raised-sm)] ${
        compact ? "rounded-xl" : "overflow-hidden rounded-2xl"
      }`}
    >
      <div
        className={`flex items-center justify-between border-b border-[var(--card-border)] ${
          compact ? "px-3 py-2" : "px-4 py-3"
        }`}
      >
        <div>
          <p className={`font-semibold tracking-tight ${compact ? "text-[10px]" : "text-[0.6875rem]"}`}>
            Exceptions
          </p>
          <p className={`text-[var(--text-tertiary)] ${compact ? "text-[9px]" : "text-[0.6875rem]"}`}>
            Review queue · tier 5
          </p>
        </div>
        <span className={`font-mono text-[var(--text-tertiary)] ${compact ? "text-[9px]" : "text-[0.625rem]"}`}>
          3 pending
        </span>
      </div>
      <div className={compact ? "p-2.5" : "p-4"}>
        <section className="panel exceptions-panel !mb-0">
          <div className={`toolbar ${compact ? "!gap-2" : ""}`}>
            <span
              className={`rounded-full bg-[var(--surface-inset)] text-[var(--text-secondary)] shadow-[var(--shadow-inset-sm)] ${
                compact ? "px-2 py-1 text-[9px]" : "px-3 py-1.5 text-[0.6875rem]"
              }`}
            >
              Filter: All
            </span>
            <span
              className={`rounded-full bg-[var(--surface-inset)] text-[var(--text-secondary)] shadow-[var(--shadow-inset-sm)] ${
                compact ? "px-2 py-1 text-[9px]" : "px-3 py-1.5 text-[0.6875rem]"
              }`}
            >
              Sort: Source
            </span>
          </div>
          <div
            className={`data-table ${
              compact ? "!overflow-visible [&_td]:py-1.5 [&_th]:py-1.5 [&_table]:text-[10px]" : ""
            }`}
          >
            <div className="data-table-page">
              <table>
                  <thead>
                    <tr>
                      <th scope="col" className="data-table-sno">
                        S.No
                      </th>
                      <th scope="col">
                        <TableHeadCell icon={<RecordIcon />} label="Record" />
                      </th>
                      <th scope="col">
                        <TableHeadCell icon={<SourceIcon />} label="Source" />
                      </th>
                      <th scope="col">
                        <TableHeadCell icon={<TypeIcon />} label="Type" />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {ROWS.map((row, i) => (
                      <tr
                        key={row.recordId}
                        className={`data-table-row ${i === 0 ? "selected" : ""}`}
                      >
                        <td className="data-table-sno">{i + 1}</td>
                        <td className="data-table-record">{row.recordId}</td>
                        <td>{row.source}</td>
                        <td>{row.type}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
