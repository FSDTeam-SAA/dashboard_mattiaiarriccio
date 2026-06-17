export type Notify = (kind: "success" | "error", message: string) => void;

export type SectionProps = {
  token: string | null;
  notify: Notify;
};
