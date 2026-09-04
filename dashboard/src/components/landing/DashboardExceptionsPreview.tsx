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

export default function DashboardExceptionsPreview() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] shadow-[var(--shadow-raised-sm)]">
      <div className="flex items-center justify-between border-b border-[var(--card-border)] px-4 py-3">
        <div>
          <p className="text-[0.6875rem] font-semibold tracking-tight">Exceptions</p>
          <p className="text-[0.6875rem] text-[var(--text-tertiary)]">
            Review queue · tier 5
          </p>
        </div>
        <span className="font-mono text-[0.625rem] text-[var(--text-tertiary)]">
          3 pending
        </span>
      </div>
      <div className="p-4">
        <section className="panel exceptions-panel !mb-0">
          <div className="toolbar">
            <span className="rounded-full bg-[var(--surface-inset)] px-3 py-1.5 text-[0.6875rem] text-[var(--text-secondary)] shadow-[var(--shadow-inset-sm)]">
              Filter: All
            </span>
            <span className="rounded-full bg-[var(--surface-inset)] px-3 py-1.5 text-[0.6875rem] text-[var(--text-secondary)] shadow-[var(--shadow-inset-sm)]">
              Sort: Source
            </span>
          </div>
          <div className="data-table">
            <div className="data-table-scroll">
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
          </div>
        </section>
      </div>
    </div>
  );
}
