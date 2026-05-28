export default function Spinner({ className = "" }) {
  return (
    <div className={`flex items-center justify-center py-16 ${className}`}>
      <div className="w-8 h-8 border-4 border-[#E5D8C5] border-t-[#314D3E] rounded-full animate-spin" />
    </div>
  );
}
