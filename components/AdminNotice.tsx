export default function AdminNotice({ type, children }: { type: "success" | "error"; children: string }) {
  return <p className={type === "success" ? "admin-success" : "admin-error"}>{children}</p>;
}
