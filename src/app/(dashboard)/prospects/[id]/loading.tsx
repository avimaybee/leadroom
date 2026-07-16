export default function ProspectDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-64 bg-muted rounded animate-pulse" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="h-48 bg-muted rounded-xl animate-pulse" />
        </div>
        <div className="space-y-4">
          <div className="h-40 bg-muted rounded-xl animate-pulse" />
        </div>
      </div>
    </div>
  );
}
