import { Download, Moon, Sun, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useConfirm } from "../components/ConfirmDialog";
import { RulesEditor } from "../components/RulesEditor";
import { useToast } from "../components/Toast";
import { SectionTitle, Switch, TopBar } from "../components/ui";
import { APP_CONFIG, PHOTO_COUNT } from "../config";
import { emptyDatabase } from "../domain/database";
import { updateSettings } from "../domain/operations";
import { migrate } from "../storage/adapter";
import { useStore } from "../state/store";

export function SettingsScreen() {
  const { db, apply, replaceAll } = useStore();
  const confirm = useConfirm();
  const toast = useToast();
  const [name, setName] = useState(db.settings.appName);
  const fileRef = useRef<HTMLInputElement>(null);

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `domino-placar-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importBackup = async (file: File) => {
    try {
      const data = migrate(JSON.parse(await file.text()));
      const ok = await confirm({
        title: "Restaurar backup?",
        message: `O backup tem ${data.players.length} jogadores e ${data.matches.length} partidas. Os dados atuais deste aparelho serão substituídos.`,
        confirmLabel: "Restaurar",
        danger: true,
      });
      if (ok) {
        replaceAll(data);
        setName(data.settings.appName);
        toast.show("Backup restaurado.", "success");
      }
    } catch {
      toast.show("Arquivo de backup inválido.", "error");
    }
  };

  const eraseAll = async () => {
    const ok = await confirm({
      title: "Apagar todos os dados?",
      message: "Jogadores, partidas e histórico deste aparelho serão apagados definitivamente. Faça um backup antes, se quiser guardar.",
      confirmLabel: "Apagar tudo",
      danger: true,
    });
    if (ok) {
      replaceAll(emptyDatabase());
      setName(APP_CONFIG.defaultAppName);
      toast.show("Dados apagados.", "success");
    }
  };

  return (
    <div className="screen">
      <TopBar title="Ajustes" back="/" />

      <SectionTitle>Nome do aplicativo</SectionTitle>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (apply((d) => updateSettings(d, { appName: name }))) toast.show("Nome atualizado.", "success");
        }}
      >
        <input className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} aria-label="Nome do aplicativo" />
        <button className="btn btn-primary" type="submit" disabled={name.trim() === db.settings.appName}>
          Salvar
        </button>
      </form>

      <SectionTitle>Contagem por foto</SectionTitle>
      <div className="card flex items-center gap-4 p-4">
        <div className="flex-1">
          <div className="font-extrabold">Mostrar botão de câmera na rodada</div>
          <div className="text-sm text-muted">
            {PHOTO_COUNT.enabled
              ? "Opcional. A IA lista as peças da foto e você confere antes de usar. Digitar os pontos continua funcionando normalmente."
              : "Indisponível nesta instalação: o servidor da contagem por foto não foi configurado (veja o README). Os pontos são digitados normalmente."}
          </div>
        </div>
        <Switch
          label="Mostrar botão de contagem por foto"
          checked={PHOTO_COUNT.enabled && db.settings.photoCount}
          disabled={!PHOTO_COUNT.enabled}
          onChange={(v) => apply((d) => updateSettings(d, { photoCount: v }))}
        />
      </div>

      <SectionTitle>Aparência</SectionTitle>
      <div className="tabs" role="radiogroup" aria-label="Tema">
        <button role="radio" aria-selected={db.settings.theme === "dark"} aria-checked={db.settings.theme === "dark"} onClick={() => apply((d) => updateSettings(d, { theme: "dark" }))}>
          <Moon size={16} className="mr-1 inline" /> Escuro
        </button>
        <button role="radio" aria-selected={db.settings.theme === "light"} aria-checked={db.settings.theme === "light"} onClick={() => apply((d) => updateSettings(d, { theme: "light" }))}>
          <Sun size={16} className="mr-1 inline" /> Claro
        </button>
      </div>

      <SectionTitle>Regras padrão para novas partidas</SectionTitle>
      <RulesEditor
        value={db.settings.defaultMatchSettings}
        onChange={(v) => apply((d) => updateSettings(d, { defaultMatchSettings: v }))}
      />
      <p className="mt-2 text-sm text-muted">
        Partidas já iniciadas mantêm as regras com que começaram.
      </p>

      <SectionTitle>Dados do aparelho</SectionTitle>
      <p className="mb-3 text-sm text-muted">
        Tudo fica salvo neste aparelho, sem precisar de conta. Use o backup para guardar uma cópia ou levar
        os dados para outro celular.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button className="btn btn-secondary" onClick={exportBackup}>
          <Download size={20} /> Exportar
        </button>
        <button className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
          <Upload size={20} /> Importar
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void importBackup(f);
          e.target.value = "";
        }}
      />
      <button className="btn btn-ghost mt-2 w-full text-danger" onClick={eraseAll}>
        Apagar todos os dados
      </button>

      <p className="mt-8 text-center text-xs text-muted">
        Conjunto duplo-12 · {APP_CONFIG.minPlayers} a {APP_CONFIG.maxPlayers} jogadores · versão 1.0
      </p>
    </div>
  );
}
