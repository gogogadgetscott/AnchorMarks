import type {
  FolderMetadata,
  FolderMetadataType,
  FolderMetadataStatus,
  FolderMetadataDomain,
} from "../../types/index";

interface Props {
  metadata: FolderMetadata | null | undefined;
  onChange: (updated: FolderMetadata) => void;
  disabled?: boolean;
}

const TYPE_OPTIONS: FolderMetadataType[] = [
  "Project",
  "Tool",
  "System",
  "Vendor",
  "Personal",
];

const STATUS_OPTIONS: FolderMetadataStatus[] = ["Active", "Archived"];

const DOMAIN_OPTIONS: FolderMetadataDomain[] = [
  "Solar",
  "Homelab",
  "Finance",
  "Research",
  "Other",
];

export function FolderMetadataEditor({ metadata, onChange, disabled = false }: Props) {
  const meta: FolderMetadata = metadata ?? {};

  function patch(partial: Partial<FolderMetadata>) {
    onChange({ ...meta, ...partial });
  }

  return (
    <div className="fme-root">
      <div className="fme-row">
        <label className="fme-label" htmlFor="fme-type">
          Type
        </label>
        <select
          id="fme-type"
          className="fme-select"
          value={meta.type ?? ""}
          disabled={disabled}
          onChange={(e) =>
            patch({ type: (e.target.value as FolderMetadataType) || undefined })
          }
        >
          <option value="">— none —</option>
          {TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="fme-row">
        <label className="fme-label" htmlFor="fme-status">
          Status
        </label>
        <select
          id="fme-status"
          className={`fme-select ${meta.status === "Archived" ? "fme-select--archived" : ""}`}
          value={meta.status ?? ""}
          disabled={disabled}
          onChange={(e) =>
            patch({
              status: (e.target.value as FolderMetadataStatus) || undefined,
            })
          }
        >
          <option value="">— none —</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="fme-row">
        <label className="fme-label" htmlFor="fme-domain">
          Domain
        </label>
        <select
          id="fme-domain"
          className="fme-select"
          value={meta.domain ?? ""}
          disabled={disabled}
          onChange={(e) =>
            patch({
              domain: (e.target.value as FolderMetadataDomain) || undefined,
            })
          }
        >
          <option value="">— none —</option>
          {DOMAIN_OPTIONS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
