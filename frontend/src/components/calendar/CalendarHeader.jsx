export default function CalendarHeader() {
  return (
    <div
      className="
        bg-white
        rounded-2xl
        shadow-sm
        p-4
        mb-6
        flex
        justify-between
        items-center
      "
    >

      <div>

        <h1 className="text-3xl font-bold">
          Agenda
        </h1>

        <p className="text-gray-500">
          Visualize seus agendamentos
        </p>

      </div>

      <button
        className="
          bg-blue-500
          hover:bg-blue-600
          text-white
          px-5
          py-3
          rounded-xl
          transition
        "
      >
        Novo Agendamento
      </button>

    </div>
  );
}