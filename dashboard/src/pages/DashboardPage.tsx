import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import ReconcilePanel, {
  type ReportMode,
} from "../components/ReconcilePanel";
import CornerActions from "../components/CornerActions";
import BackToLanding from "../BackToLanding";
import TabBar from "../components/TabBar";
import AppFooter from "../sections/AppFooter";
import DifficultySection from "../sections/DifficultySection";
import ExceptionsPanel from "../sections/ExceptionsPanel";
import HeroSection from "../sections/HeroSection";
import LlmAblationSection from "../sections/LlmAblationSection";
import MatchesPanel from "../sections/MatchesPanel";
import MatchSourceSection from "../sections/MatchSourceSection";
import MetricsSection from "../sections/MetricsSection";
import type { DashboardTab } from "../lib/constants";
import type { Exception, FullReport, MatchResult } from "../types";
import {
  NavBody,
  Navbar,
} from "../components/landing/redesign/ResizableNavbar";

interface Props {
  report: FullReport;
  reportMode: ReportMode;
  onReportComplete: (report: FullReport, mode: ReportMode) => void;
}

export default function DashboardPage({
  report,
  reportMode,
  onReportComplete,
}: Props) {
  const [tab, setTab] = useState<DashboardTab>("matches");
  const [filter, setFilter] = useState("all");
  const [selectedException, setSelectedException] = useState<Exception | null>(
    null,
  );
  const [selectedMatch, setSelectedMatch] = useState<MatchResult | null>(
    null,
  );
  const [sortKey, setSortKey] = useState<"source" | "type">("source");
  const [excPage, setExcPage] = useState(1);
  const [matchPage, setMatchPage] = useState(1);
  const [excDirection, setExcDirection] = useState(1);
  const [matchDirection, setMatchDirection] = useState(1);

  function goExcPage(next: number) {
    setExcDirection(next >= excPage ? 1 : -1);
    setExcPage(next);
    setSelectedException(null);
  }

  function goMatchPage(next: number) {
    setMatchDirection(next >= matchPage ? 1 : -1);
    setMatchPage(next);
  }

  function handleTabChange(id: DashboardTab) {
    setTab(id);
    setSelectedException(null);
    if (id === "exceptions") {
      setExcPage(1);
      setExcDirection(1);
    } else {
      setMatchPage(1);
      setMatchDirection(1);
    }
  }

  function handleReconcileComplete(nextReport: FullReport, mode: ReportMode) {
    onReportComplete(nextReport, mode);
    setTab(nextReport.exceptions.length > 0 ? "exceptions" : "matches");
    setExcPage(1);
    setMatchPage(1);
    setSelectedException(null);
    setSelectedMatch(null);
  }

  const filteredExceptions = useMemo(() => {
    let rows = [...report.exceptions];
    if (filter !== "all") {
      rows = rows.filter(
        (e) => e.exceptionType === filter || e.source === filter,
      );
    }
    rows.sort((a, b) => {
      if (sortKey === "source") return a.source.localeCompare(b.source);
      return (a.exceptionType ?? "").localeCompare(b.exceptionType ?? "");
    });
    return rows;
  }, [report, filter, sortKey]);

  const exceptionTypes = useMemo(() => {
    return [
      ...new Set(
        report.exceptions
          .map((e) => e.exceptionType ?? e.source)
          .filter(Boolean),
      ),
    ];
  }, [report]);

  return (
    <>
      <header className="h-13" aria-label="Dashboard navigation">
        <Navbar>
          <NavBody className="dashboard-nav-body">
          <BackToLanding layout="inline" />
          <CornerActions layout="inline" />
          </NavBody>
        </Navbar>
      </header>
      <div className="shell">
      <HeroSection report={report} reportMode={reportMode} />

      <ReconcilePanel
        mode={reportMode}
        onComplete={handleReconcileComplete}
      />

      <MetricsSection report={report} reportMode={reportMode} />
      <DifficultySection report={report} />
      <LlmAblationSection report={report} />
      <MatchSourceSection report={report} />

      <TabBar
        tab={tab}
        exceptionCount={report.exceptions.length}
        matchCount={report.matches.length}
        onChange={handleTabChange}
      />

      <div className="tab-content">
        <AnimatePresence mode="wait">
          {tab === "exceptions" && (
            <ExceptionsPanel
              exceptions={filteredExceptions}
              exceptionTypes={exceptionTypes}
              filter={filter}
              sortKey={sortKey}
              page={excPage}
              direction={excDirection}
              selectedException={selectedException}
              onFilterChange={(value) => {
                setFilter(value);
                setExcPage(1);
                setExcDirection(1);
                setSelectedException(null);
              }}
              onSortChange={(value) => {
                setSortKey(value);
                setExcPage(1);
                setExcDirection(1);
                setSelectedException(null);
              }}
              onPageChange={goExcPage}
              onSelectException={setSelectedException}
            />
          )}

          {tab === "matches" && (
            <MatchesPanel
              matches={report.matches}
              page={matchPage}
              direction={matchDirection}
              selectedMatch={selectedMatch}
              onPageChange={goMatchPage}
              onSelectMatch={setSelectedMatch}
            />
          )}
        </AnimatePresence>
      </div>

      {/* <LimitationsSection report={report} /> */}
      <AppFooter />
      </div>
    </>
  );
}
