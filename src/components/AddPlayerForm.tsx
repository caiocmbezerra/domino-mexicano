import { UserPlus } from "lucide-react";
import { useState } from "react";
import { addPlayer } from "../domain/operations";
import { useStore } from "../state/store";
import { useToast } from "./Toast";
import { haptic } from "./ui";

/** Campo para cadastrar um jogador novo. `onAdded` recebe o ID criado. */
export function AddPlayerForm({ onAdded }: { onAdded?: (id: string) => void }) {
  const { run } = useStore();
  const toast = useToast();
  const [name, setName] = useState("");

  const submit = () => {
    const id = run((db) => {
      const r = addPlayer(db, name);
      return { db: r.db, value: r.id };
    });
    if (id) {
      haptic();
      toast.show(`${name.trim()} cadastrado.`, "success");
      setName("");
      onAdded?.(id);
    }
  };

  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <input
        className="input"
        placeholder="Nome ou apelido"
        aria-label="Nome do novo jogador"
        value={name}
        maxLength={30}
        autoCapitalize="words"
        enterKeyHint="done"
        onChange={(e) => setName(e.target.value)}
      />
      <button type="submit" className="btn btn-primary shrink-0 !px-4" disabled={!name.trim()} aria-label="Adicionar jogador">
        <UserPlus size={22} />
      </button>
    </form>
  );
}
