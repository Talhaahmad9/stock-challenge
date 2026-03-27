-- Phase 2.5 performance bundle
-- Apply in Supabase SQL editor (or migration runner).

-- Helpful indexes for high-frequency portfolio + leaderboard reads.
create index if not exists idx_portfolios_event_user
  on public.portfolios (event_id, user_id);

create index if not exists idx_holdings_portfolio_stock
  on public.holdings (portfolio_id, stock_id);

create index if not exists idx_stock_prices_round_stock
  on public.stock_prices (round_id, stock_id);

create index if not exists idx_game_state_event
  on public.game_state (event_id);

create index if not exists idx_rounds_event_round
  on public.rounds (event_id, round_number);

-- DB-side leaderboard aggregation.
create or replace function public.get_event_leaderboard(
  p_event_id uuid,
  p_user_id uuid
)
returns table (
  rank bigint,
  username text,
  total_value numeric,
  balance numeric,
  portfolio_value numeric,
  pnl numeric,
  is_current_user boolean
)
language sql
stable
as $$
with event_meta as (
  select e.starting_balance
  from public.events e
  where e.id = p_event_id
),
current_round as (
  select gs.current_round
  from public.game_state gs
  where gs.event_id = p_event_id
),
round_id as (
  select r.id
  from public.rounds r
  join current_round cr on cr.current_round = r.round_number
  where r.event_id = p_event_id
  limit 1
),
price_map as (
  select sp.stock_id, sp.price
  from public.stock_prices sp
  join round_id rr on rr.id = sp.round_id
),
holding_values as (
  select
    h.portfolio_id,
    sum(h.quantity * coalesce(pm.price, h.avg_buy_price))::numeric as portfolio_value
  from public.holdings h
  left join price_map pm on pm.stock_id = h.stock_id
  group by h.portfolio_id
),
base as (
  select
    p.id as portfolio_id,
    coalesce(u.username, '—') as username,
    p.balance::numeric as balance,
    coalesce(hv.portfolio_value, 0)::numeric as portfolio_value,
    (p.balance::numeric + coalesce(hv.portfolio_value, 0)::numeric) as total_value,
    (
      (p.balance::numeric + coalesce(hv.portfolio_value, 0)::numeric)
      - coalesce((select em.starting_balance::numeric from event_meta em), 0)
    ) as pnl,
    (p.user_id = p_user_id) as is_current_user
  from public.portfolios p
  left join public.users u on u.id = p.user_id
  left join holding_values hv on hv.portfolio_id = p.id
  where p.event_id = p_event_id
)
select
  dense_rank() over (order by b.total_value desc) as rank,
  b.username,
  b.total_value,
  b.balance,
  b.portfolio_value,
  b.pnl,
  b.is_current_user
from base b
order by rank asc, b.username asc;
$$;

-- DB-side participant portfolio snapshot aggregation.
create or replace function public.get_participant_portfolio_snapshot(
  p_event_id uuid,
  p_user_id uuid
)
returns jsonb
language sql
stable
as $$
with event_meta as (
  select e.starting_balance
  from public.events e
  where e.id = p_event_id
),
portfolio_row as (
  select p.id, p.balance
  from public.portfolios p
  where p.event_id = p_event_id
    and p.user_id = p_user_id
  limit 1
),
current_round as (
  select gs.current_round
  from public.game_state gs
  where gs.event_id = p_event_id
),
round_id as (
  select r.id
  from public.rounds r
  join current_round cr on cr.current_round = r.round_number
  where r.event_id = p_event_id
  limit 1
),
stock_data as (
  select
    s.id,
    s.symbol,
    s.name,
    s.sector,
    coalesce(sp.price, 0)::numeric as current_price
  from public.stocks s
  left join round_id rr on true
  left join public.stock_prices sp
    on sp.stock_id = s.id
   and sp.round_id = rr.id
  where s.event_id = p_event_id
),
holdings_data as (
  select
    h.stock_id,
    h.quantity,
    h.avg_buy_price,
    sd.symbol,
    sd.name,
    sd.sector,
    coalesce(sd.current_price, h.avg_buy_price)::numeric as current_price,
    ((coalesce(sd.current_price, h.avg_buy_price) - h.avg_buy_price) * h.quantity)::numeric as unrealized_pnl
  from public.holdings h
  join portfolio_row p on p.id = h.portfolio_id
  left join stock_data sd on sd.id = h.stock_id
)
select jsonb_build_object(
  'balance', coalesce((select p.balance from portfolio_row p), 0),
  'starting_balance', coalesce((select em.starting_balance from event_meta em), 0),
  'holdings', coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', hd.stock_id,
          'symbol', hd.symbol,
          'name', hd.name,
          'sector', hd.sector,
          'currentPrice', hd.current_price,
          'quantity', hd.quantity,
          'avgBuyPrice', hd.avg_buy_price,
          'unrealizedPnL', hd.unrealized_pnl
        )
      )
      from holdings_data hd
    ),
    '[]'::jsonb
  ),
  'stocks', coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', sd.id,
          'symbol', sd.symbol,
          'name', sd.name,
          'sector', sd.sector,
          'currentPrice', sd.current_price
        )
      )
      from stock_data sd
    ),
    '[]'::jsonb
  )
);
$$;
