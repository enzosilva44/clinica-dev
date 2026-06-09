export default function Spinner({ className = "" }) {
  return (
    <div className={`flex items-center justify-center py-16 ${className}`}>
      <div className="w-8 h-8 border-4 border-[#D8CDB9] border-t-[#1F4D46] rounded-full animate-spin" />
    </div>
  );
}
