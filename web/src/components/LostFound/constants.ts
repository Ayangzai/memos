/**
 * CampusFind (校园失物招领) shared constants.
 *
 * The board is built on memos' hierarchical tag system. Every lost-and-found
 * report is a regular memo whose content carries three kinds of tags:
 *
 * - Type tag: `#招领` (someone found an item) or `#寻物` (someone lost an item).
 * - Location tag: `#地点/图书馆` and friends. The server expands ancestor tags,
 *   so filtering with `tag in ["地点"]` matches every location.
 * - Status tag: `#状态/未解决` (open) or `#状态/已解决` (resolved). Toggling the
 *   status rewrites this tag inside the memo content.
 *
 * Tag values are stored in Chinese on purpose so data stays consistent across
 * locales; only the UI labels are translated.
 */

import type { Translations } from "@/utils/i18n";

export const TYPE_FOUND_TAG = "招领";
export const TYPE_LOST_TAG = "寻物";
export const STATUS_OPEN_TAG = "状态/未解决";
export const STATUS_DONE_TAG = "状态/已解决";
export const LOCATION_TAG_PREFIX = "地点/";

export interface CampusLocation {
  /** Stable tag segment appended to `地点/`. */
  value: string;
  /** i18n key of the display label. */
  labelKey: Translations;
}

export const CAMPUS_LOCATIONS: readonly CampusLocation[] = [
  { value: "图书馆", labelKey: "lostfound.location-library" },
  { value: "教学楼", labelKey: "lostfound.location-teaching" },
  { value: "食堂", labelKey: "lostfound.location-canteen" },
  { value: "宿舍", labelKey: "lostfound.location-dorm" },
  { value: "操场", labelKey: "lostfound.location-playground" },
  { value: "体育馆", labelKey: "lostfound.location-gym" },
  { value: "实验室", labelKey: "lostfound.location-lab" },
  { value: "办公楼", labelKey: "lostfound.location-office" },
  { value: "校门口", labelKey: "lostfound.location-gate" },
  { value: "其他", labelKey: "lostfound.location-other" },
];

/** The location tag of a memo, e.g. `地点/图书馆`, or `undefined` when absent. */
export const getMemoLocationTag = (tags: string[]): string | undefined =>
  tags.find((tag) => tag.startsWith(LOCATION_TAG_PREFIX) && tag !== LOCATION_TAG_PREFIX);

/** True when the memo follows the board's tag convention well enough to manage its status. */
export const isBoardMemo = (tags: string[]): boolean => tags.includes(STATUS_OPEN_TAG) || tags.includes(STATUS_DONE_TAG);

/** Rewrites the status tag inside memo content. The server recomputes tags from content. */
export const swapStatusTag = (content: string, open: boolean): string =>
  open
    ? content.replace(new RegExp(`#${STATUS_OPEN_TAG}`, "g"), `#${STATUS_DONE_TAG}`)
    : content.replace(new RegExp(`#${STATUS_DONE_TAG}`, "g"), `#${STATUS_OPEN_TAG}`);
