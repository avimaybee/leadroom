export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-56 bg-muted rounded animate-pulse" />
      <div className="h-5 w-96 bg-muted rounded animate-pulse" />
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-28 bg-muted rounded-lg animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
        ))}
      </div>
      <div className="h-12 bg-muted rounded-xl animate-pulse" />
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-muted rounded-md animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
        ))}
      </div>
    </div>
  );
}
