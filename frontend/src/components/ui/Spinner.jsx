export default function Spinner({ className = "" }) {
  return (
    <div className={`flex items-center justify-center py-16 ${className}`}>
      <div className="w-8 h-8 border-4 border-creme-200 border-t-verde rounded-full animate-spin" />
    </div>
  );
}
