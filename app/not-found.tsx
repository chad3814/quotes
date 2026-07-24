import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container">
      <div className="empty">
        <h1 className="page-title">Not found</h1>
        <p className="empty__hint">
          That page doesn’t exist. <Link href="/">Return home</Link>.
        </p>
      </div>
    </div>
  );
}
