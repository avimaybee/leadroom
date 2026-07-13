export default function ResearchQueueLoading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-64 bg-muted rounded animate-pulse" />
      <div className="h-5 w-48 bg-muted rounded animate-pulse" />
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-16 bg-muted rounded-md animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
      ))}
    </div>
  );
}
