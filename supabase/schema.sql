-- Esquema PREPARADO para sincronização futura entre aparelhos (Supabase/PostgreSQL).
-- O app funciona 100% local sem isto; nada aqui é aplicado automaticamente.
-- Espelha o modelo de src/domain/types.ts. Totais, rankings e carroções utilizados
-- continuam derivados de rounds/round_results (não há colunas de total).

create table players (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 30),
  created_at  timestamptz not null default now()
);
create unique index players_name_uniq on players (lower(name));

create table matches (
  id              uuid primary key default gen_random_uuid(),
  started_at      timestamptz not null default now(),
  ended_at        timestamptz,
  status          text not null default 'in_progress' check (status in ('in_progress', 'finished')),
  -- { zeroDoubleScoresZero, tieBreakers[], highestDouble }
  settings        jsonb not null,
  check ((status = 'finished') = (ended_at is not null))
);

create table match_participants (
  match_id      uuid not null references matches (id) on delete cascade,
  player_id     uuid not null references players (id) on delete restrict,
  display_order smallint not null,
  primary key (match_id, player_id),
  unique (match_id, display_order)
);

create table rounds (
  id               uuid primary key default gen_random_uuid(),
  match_id         uuid not null references matches (id) on delete cascade,
  number           smallint not null check (number > 0),
  opening_double   smallint check (opening_double between 0 and 12),
  opener_id        uuid references players (id),
  manual_exception boolean not null default false,
  exception_note   text,
  status           text not null default 'open' check (status in ('open', 'closed')),
  draft            jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  closed_at        timestamptz,
  edited_at        timestamptz,
  unique (match_id, number),
  check (manual_exception or opening_double is not null)
);
-- Regra essencial: um carroção só abre uma rodada por partida.
create unique index rounds_double_once_per_match on rounds (match_id, opening_double)
  where opening_double is not null;
-- No máximo uma rodada em andamento por partida.
create unique index rounds_one_open_per_match on rounds (match_id) where status = 'open';

create table round_results (
  id               uuid primary key default gen_random_uuid(),
  round_id         uuid not null references rounds (id) on delete cascade,
  player_id        uuid not null references players (id) on delete restrict,
  exit_position    smallint check (exit_position > 0),
  remaining_points integer check (remaining_points >= 0),
  counted_points   integer not null check (counted_points >= 0),
  is_winner        boolean not null default false,
  had_zero_double  boolean not null default false,
  unique (round_id, player_id),
  unique (round_id, exit_position)
);

-- Placar derivado (nunca armazenado): total por jogador e partida.
create view match_totals as
select r.match_id, rr.player_id, sum(rr.counted_points) as total, count(*) as rounds_played
from round_results rr join rounds r on r.id = rr.round_id
where r.status = 'closed'
group by r.match_id, rr.player_id;

-- Ao ligar a sincronização: habilite RLS em todas as tabelas e crie políticas por
-- "turma" (ex.: coluna group_id + tabela de membros), mantendo o uso local sem login.
