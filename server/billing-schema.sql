CREATE SCHEMA IF NOT EXISTS billing;
REVOKE ALL ON SCHEMA billing FROM PUBLIC;
CREATE TABLE IF NOT EXISTS billing.accounts (
  mode text NOT NULL CHECK (mode IN ('test','live')),
  user_id text NOT NULL,
  customer_id text NOT NULL,
  entitlement jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (mode, user_id), UNIQUE (mode, customer_id)
);
CREATE TABLE IF NOT EXISTS billing.checkouts (
  mode text NOT NULL,
  user_id text NOT NULL,
  session_id text NOT NULL,
  request_id uuid NOT NULL,
  plan text NOT NULL CHECK (plan IN ('month','year','lifetime')),
  terms_version text NOT NULL,
  adult_confirmed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (mode, session_id), UNIQUE (mode, user_id, request_id),
  FOREIGN KEY (mode,user_id) REFERENCES billing.accounts(mode,user_id)
);
CREATE TABLE IF NOT EXISTS billing.events (
  mode text NOT NULL,
  event_id text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (mode,event_id)
);
REVOKE ALL ON ALL TABLES IN SCHEMA billing FROM PUBLIC;
