export default function LearningInboxLoading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 bg-muted rounded animate-pulse" />
      <div className="h-5 w-64 bg-muted rounded animate-pulse" />
      <div className="flex gap-2">
        <div className="h-6 w-20 bg-muted rounded-full animate-pulse" />
        <div className="h-6 w-24 bg-muted rounded-full animate-pulse" />
      </div>
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
      ))}
    </div>
  );
}
