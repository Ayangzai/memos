import { create } from "@bufbuild/protobuf";
import { timestampDate } from "@bufbuild/protobuf/wkt";
import { PlusIcon, Table2Icon } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import {
  CAMPUS_LOCATIONS,
  isBoardMemo,
  STATUS_DONE_TAG,
  STATUS_OPEN_TAG,
  swapStatusTag,
  TYPE_FOUND_TAG,
  TYPE_LOST_TAG,
} from "@/components/LostFound/constants";
import PostDialog from "@/components/LostFound/PostDialog";
import MemoView from "@/components/MemoView";
import PagedMemoList, { getMemoKey } from "@/components/PagedMemoList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { memoServiceClient } from "@/connect";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useUpdateMemo } from "@/hooks/useMemoQueries";
import { downloadFileFromUrl } from "@/lib/browser";
import { combineCELFilters } from "@/lib/cel-filter";
import { cn } from "@/lib/utils";
import { State } from "@/types/proto/api/v1/common_pb";
import { ListMemosRequestSchema, type Memo } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import { canManageMemo } from "@/utils/user";

const escapeFilterValue = (value: string): string => JSON.stringify(value);

type TypeFilter = "all" | "found" | "lost";
type StatusFilter = "all" | "open" | "done";
type TimeFilter = "all" | "24h" | "7d" | "30d";

interface BoardFilterState {
  type: TypeFilter;
  location: string; // "all" or a CAMPUS_LOCATIONS value
  status: StatusFilter;
  timeRange: TimeFilter;
  keyword: string;
}

const TIME_RANGE_SECONDS: Record<Exclude<TimeFilter, "all">, number> = {
  "24h": 24 * 60 * 60,
  "7d": 7 * 24 * 60 * 60,
  "30d": 30 * 24 * 60 * 60,
};

/** Compiles the board's structured filters into the CEL filter language memos understands. */
const buildBoardFilter = (state: BoardFilterState): string | undefined => {
  const conditions: string[] = [];
  if (state.type === "found") {
    conditions.push(`tag in [${escapeFilterValue(TYPE_FOUND_TAG)}]`);
  } else if (state.type === "lost") {
    conditions.push(`tag in [${escapeFilterValue(TYPE_LOST_TAG)}]`);
  }
  if (state.location !== "all") {
    conditions.push(`tag in [${escapeFilterValue(`地点/${state.location}`)}]`);
  }
  if (state.status === "open") {
    conditions.push(`tag in [${escapeFilterValue(STATUS_OPEN_TAG)}]`);
  } else if (state.status === "done") {
    conditions.push(`tag in [${escapeFilterValue(STATUS_DONE_TAG)}]`);
  }
  if (state.timeRange !== "all") {
    const since = Math.floor(Date.now() / 1000) - TIME_RANGE_SECONDS[state.timeRange];
    conditions.push(`created_ts >= timestamp(${since})`);
  }
  if (state.keyword.trim()) {
    conditions.push(`content.contains(${escapeFilterValue(state.keyword.trim())})`);
  }
  return combineCELFilters(...conditions);
};

const Chip = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "rounded-full border px-2.5 py-1 text-xs whitespace-nowrap transition-colors",
      active ? "border-primary bg-primary/10 text-primary font-medium" : "border-border text-muted-foreground hover:bg-accent",
    )}
  >
    {children}
  </button>
);

const FilterRow = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex items-center gap-2">
    <span className="text-muted-foreground w-10 shrink-0 text-xs">{label}</span>
    <div className="flex flex-wrap gap-1.5">{children}</div>
  </div>
);

const csvEscape = (value: string): string => `"${value.replace(/"/g, '""')}"`;

const LostFound = () => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const { mutateAsync: updateMemo } = useUpdateMemo();
  const [postDialogOpen, setPostDialogOpen] = useState(false);
  const [filterState, setFilterState] = useState<BoardFilterState>({
    type: "all",
    location: "all",
    status: "all",
    timeRange: "all",
    keyword: "",
  });

  const boardFilter = useMemo(() => buildBoardFilter(filterState), [filterState]);

  const patchFilter = (patch: Partial<BoardFilterState>) => setFilterState((prev) => ({ ...prev, ...patch }));

  const toggleStatus = async (memo: Memo) => {
    const open = memo.tags.includes(STATUS_OPEN_TAG);
    await updateMemo({
      update: { name: memo.name, content: swapStatusTag(memo.content, open) },
      updateMask: ["content", "update_time"],
    });
  };

  const exportCsv = async () => {
    const rows: string[] = [["类型", "状态", "地点", "内容", "发布者", "发布时间", "链接"].map(csvEscape).join(",")];
    let pageToken = "";
    for (;;) {
      const response = await memoServiceClient.listMemos(
        create(ListMemosRequestSchema, { state: State.NORMAL, filter: boardFilter, orderBy: "create_time desc", pageSize: 200, pageToken }),
      );
      for (const memo of response.memos) {
        const type = memo.tags.includes(TYPE_FOUND_TAG) ? "招领" : memo.tags.includes(TYPE_LOST_TAG) ? "寻物" : "";
        const status = memo.tags.includes(STATUS_DONE_TAG) ? "已解决" : memo.tags.includes(STATUS_OPEN_TAG) ? "进行中" : "";
        const location = (memo.tags.find((tag) => tag.startsWith("地点/")) ?? "").replace("地点/", "");
        const created = memo.createTime ? timestampDate(memo.createTime).toLocaleString() : "";
        const content = memo.content
          .replace(/[#*`>[\]]/g, "")
          .replace(/\s+/g, " ")
          .slice(0, 200);
        rows.push(
          [type, status, location, content, memo.creator, created, `${window.location.origin}/${memo.name}`].map(csvEscape).join(","),
        );
      }
      if (!response.nextPageToken) break;
      pageToken = response.nextPageToken;
    }
    // BOM keeps Excel from garbling the UTF-8 Chinese text.
    const blob = new Blob(["\uFEFF", rows.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    downloadFileFromUrl(url, `campusfind-export-${new Date().toISOString().slice(0, 10)}.csv`);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const typeChips: { value: TypeFilter; label: string }[] = [
    { value: "all", label: t("lostfound.type-all") },
    { value: "found", label: t("lostfound.type-found-short") },
    { value: "lost", label: t("lostfound.type-lost-short") },
  ];
  const statusChips: { value: StatusFilter; label: string }[] = [
    { value: "all", label: t("lostfound.status-all") },
    { value: "open", label: t("lostfound.status-open") },
    { value: "done", label: t("lostfound.status-done") },
  ];
  const timeChips: { value: TimeFilter; label: string }[] = [
    { value: "all", label: t("lostfound.time-all") },
    { value: "24h", label: t("lostfound.time-24h") },
    { value: "7d", label: t("lostfound.time-7d") },
    { value: "30d", label: t("lostfound.time-30d") },
  ];

  return (
    <div className="w-full min-h-full bg-background text-foreground">
      <div className="mx-auto w-full max-w-3xl px-4 pt-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">{t("lostfound.title")}</h1>
            <p className="text-muted-foreground text-sm">{t("lostfound.description")}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Table2Icon className="size-4" />
              {t("lostfound.export-csv")}
            </Button>
            <Button size="sm" onClick={() => setPostDialogOpen(true)}>
              <PlusIcon className="size-4" />
              {t("lostfound.post")}
            </Button>
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
          <FilterRow label={t("lostfound.filter-type")}>
            {typeChips.map((chip) => (
              <Chip key={chip.value} active={filterState.type === chip.value} onClick={() => patchFilter({ type: chip.value })}>
                {chip.label}
              </Chip>
            ))}
          </FilterRow>
          <FilterRow label={t("lostfound.filter-location")}>
            <Chip active={filterState.location === "all"} onClick={() => patchFilter({ location: "all" })}>
              {t("lostfound.location-all")}
            </Chip>
            {CAMPUS_LOCATIONS.map((location) => (
              <Chip
                key={location.value}
                active={filterState.location === location.value}
                onClick={() => patchFilter({ location: location.value })}
              >
                {t(location.labelKey)}
              </Chip>
            ))}
          </FilterRow>
          <FilterRow label={t("lostfound.filter-status")}>
            {statusChips.map((chip) => (
              <Chip key={chip.value} active={filterState.status === chip.value} onClick={() => patchFilter({ status: chip.value })}>
                {chip.label}
              </Chip>
            ))}
          </FilterRow>
          <FilterRow label={t("lostfound.filter-time")}>
            {timeChips.map((chip) => (
              <Chip key={chip.value} active={filterState.timeRange === chip.value} onClick={() => patchFilter({ timeRange: chip.value })}>
                {chip.label}
              </Chip>
            ))}
          </FilterRow>
          <div className="relative">
            <Input
              value={filterState.keyword}
              onChange={(e) => patchFilter({ keyword: e.target.value })}
              placeholder={t("lostfound.keyword-placeholder")}
            />
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl px-4 pb-10">
        <PagedMemoList
          renderer={(memo: Memo, { compact }) => (
            <div key={getMemoKey(memo)}>
              {currentUser && isBoardMemo(memo.tags) && canManageMemo(memo, currentUser) && (
                <div className="mb-1 flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => toggleStatus(memo)}>
                    {memo.tags.includes(STATUS_OPEN_TAG) ? t("lostfound.mark-resolved") : t("lostfound.reopen")}
                  </Button>
                </div>
              )}
              <MemoView memo={memo} showCreator showVisibility compact={compact} />
            </div>
          )}
          filter={boardFilter}
          state={State.NORMAL}
          orderBy="create_time desc"
          emptyMessage={t("lostfound.empty-message")}
        />
      </div>

      <PostDialog open={postDialogOpen} onOpenChange={setPostDialogOpen} />
    </div>
  );
};

export default LostFound;
