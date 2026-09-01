import { motion, AnimatePresence } from "framer-motion";
import Combobox from "../Combobox";
import ExceptionDrawer from "../components/ExceptionDrawer";
import Pagination from "../components/Pagination";
import TableHeadCell from "../components/TableHeadCell";
import { RecordIcon, SourceIcon, TypeIcon } from "../components/TableIcons";
import { PAGE_SIZE, pageSlide } from "../lib/constants";
import type { Exception } from "../types";

export default function ExceptionsPanel({
  exceptions,
  exceptionTypes,
  filter,
  sortKey,
  page,
  direction,
  selectedException,
  onFilterChange,
  onSortChange,
  onPageChange,
  onSelectException,
}: {
  exceptions: Exception[];
  exceptionTypes: string[];
  filter: string;
  sortKey: "source" | "type";
  page: number;
  direction: number;
  selectedException: Exception | null;
  onFilterChange: (value: string) => void;
  onSortChange: (value: "source" | "type") => void;
  onPageChange: (page: number) => void;
  onSelectException: (exception: Exception | null) => void;
}) {
  const start = (page - 1) * PAGE_SIZE;
  const paginated = exceptions.slice(start, start + PAGE_SIZE);

  return (
    <motion.section
      key="exceptions"
      className="panel exceptions-panel"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.12 }}
    >
      <div className="toolbar">
        <Combobox
          label="Filter"
          value={filter}
          onChange={onFilterChange}
          options={[
            { value: "all", label: "All" },
            ...exceptionTypes.map((t) => ({ value: t, label: t })),
          ]}
        />
        <Combobox
          label="Sort"
          value={sortKey}
          onChange={(value) => onSortChange(value as "source" | "type")}
          options={[
            { value: "source", label: "Source" },
            { value: "type", label: "Type" },
          ]}
        />
      </div>
      <div className="data-table">
        <div className="data-table-scroll">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={page}
              className="data-table-page"
              custom={direction}
              variants={pageSlide}
              initial="enter"
              animate="center"
              exit="exit"
            >
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
                  {paginated.map((e, i) => {
                    const key = `${e.source}:${e.recordId}`;
                    const selected =
                      selectedException?.recordId === e.recordId &&
                      selectedException?.source === e.source;
                    return (
                      <tr
                        key={key}
                        className={`data-table-row clickable ${selected ? "selected" : ""}`}
                        onClick={() =>
                          onSelectException(selected ? null : e)
                        }
                      >
                        <td className="data-table-sno">
                          {(page - 1) * PAGE_SIZE + i + 1}
                        </td>
                        <td className="data-table-record">{e.recordId}</td>
                        <td>{e.source}</td>
                        <td>{e.exceptionType ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <Pagination
        id="exceptions"
        page={page}
        total={exceptions.length}
        pageSize={PAGE_SIZE}
        onChange={onPageChange}
      />
      <ExceptionDrawer
        exception={selectedException}
        onClose={() => onSelectException(null)}
      />
    </motion.section>
  );
}
