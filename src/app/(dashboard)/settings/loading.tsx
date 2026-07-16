export default function SettingsLoading() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="h-8 w-48 bg-muted rounded animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6">
        <div className="h-64 bg-muted rounded-xl animate-pulse" />
        <div className="h-96 bg-muted rounded-xl animate-pulse" />
      </div>
    </div>
  );
}
