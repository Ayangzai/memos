import { create } from "@bufbuild/protobuf";
import { useState } from "react";
import { CAMPUS_LOCATIONS, STATUS_OPEN_TAG, TYPE_FOUND_TAG, TYPE_LOST_TAG } from "@/components/LostFound/constants";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateMemo } from "@/hooks/useMemoQueries";
import { cn } from "@/lib/utils";
import { MemoSchema, Visibility } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ReportType = "found" | "lost";

/** Quick report form: composes a tag-structured memo instead of asking users to remember the convention. */
const PostDialog = ({ open, onOpenChange }: Props) => {
  const t = useTranslate();
  const { mutateAsync: createMemo, isPending } = useCreateMemo();

  const [reportType, setReportType] = useState<ReportType>("found");
  const [itemName, setItemName] = useState("");
  const [locationValue, setLocationValue] = useState<string>(CAMPUS_LOCATIONS[0].value);
  const [eventTime, setEventTime] = useState("");
  const [locationDetail, setLocationDetail] = useState("");
  const [description, setDescription] = useState("");
  const [contact, setContact] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const resetForm = () => {
    setItemName("");
    setLocationValue(CAMPUS_LOCATIONS[0].value);
    setEventTime("");
    setLocationDetail("");
    setDescription("");
    setContact("");
    setErrorMessage("");
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetForm();
    }
    onOpenChange(nextOpen);
  };

  const buildContent = () => {
    const typeTag = reportType === "found" ? TYPE_FOUND_TAG : TYPE_LOST_TAG;
    const locationTag = `地点/${locationValue}`;
    const lines: string[] = [`#${typeTag} #${locationTag} #${STATUS_OPEN_TAG}`, ""];
    lines.push(`**物品**：${itemName.trim()}`);
    if (eventTime) {
      lines.push(`**时间**：${eventTime.replace("T", " ")}`);
    }
    if (locationDetail.trim()) {
      lines.push(`**地点**：${CAMPUS_LOCATIONS.find((l) => l.value === locationValue)?.value ?? ""} · ${locationDetail.trim()}`);
    }
    if (description.trim()) {
      lines.push(`**描述**：${description.trim()}`);
    }
    lines.push(`**联系方式**：${contact.trim() || "未填写，可通过校园服务站或平台留言认领"}`);
    return lines.join("\n");
  };

  const handlePublish = async () => {
    if (!itemName.trim()) {
      setErrorMessage(t("lostfound.required-warning"));
      return;
    }
    setErrorMessage("");
    try {
      await createMemo(
        create(MemoSchema, {
          content: buildContent(),
          // Campus board default: every signed-in member can see and help, but guests cannot.
          visibility: Visibility.PROTECTED,
        }),
      );
      handleClose(false);
    } catch {
      setErrorMessage(t("lostfound.post-failed"));
    }
  };

  const typeOptions: { value: ReportType; label: string }[] = [
    { value: "found", label: t("lostfound.post-found") },
    { value: "lost", label: t("lostfound.post-lost") },
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("lostfound.post")}</DialogTitle>
          <DialogDescription>{t("lostfound.visibility-hint")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex gap-2" role="radiogroup" aria-label={t("lostfound.filter-type")}>
            {typeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={reportType === option.value}
                onClick={() => setReportType(option.value)}
                className={cn(
                  "flex-1 rounded-md border px-3 py-2 text-sm transition-colors",
                  reportType === option.value
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-border text-muted-foreground hover:bg-accent",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("lostfound.item-name")}</Label>
            <Input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder={t("lostfound.item-name-placeholder")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("lostfound.filter-location")}</Label>
            <div className="flex flex-wrap gap-1.5">
              {CAMPUS_LOCATIONS.map((location) => (
                <button
                  key={location.value}
                  type="button"
                  onClick={() => setLocationValue(location.value)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs transition-colors",
                    locationValue === location.value
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border text-muted-foreground hover:bg-accent",
                  )}
                >
                  {t(location.labelKey)}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>{t("lostfound.event-time")}</Label>
              <Input type="datetime-local" value={eventTime} onChange={(e) => setEventTime(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("lostfound.location-detail")}</Label>
              <Input
                value={locationDetail}
                onChange={(e) => setLocationDetail(e.target.value)}
                placeholder={t("lostfound.location-placeholder")}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("lostfound.description")}</Label>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("lostfound.description-placeholder")}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("lostfound.contact")}</Label>
            <Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder={t("lostfound.contact-placeholder")} />
            <p className="text-muted-foreground text-xs">{t("lostfound.contact-hint")}</p>
          </div>
          {errorMessage && <p className="text-destructive text-sm">{errorMessage}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            {t("lostfound.cancel")}
          </Button>
          <Button onClick={handlePublish} disabled={isPending}>
            {t("lostfound.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PostDialog;
