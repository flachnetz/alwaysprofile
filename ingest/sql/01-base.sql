-- +migrate Up

CREATE TABLE ap_service (
  id   SERIAL4 NOT NULL PRIMARY KEY,
  name TEXT    NOT NULL UNIQUE
);

CREATE TABLE ap_instance (
  id         SERIAL4 NOT NULL PRIMARY KEY,
  uuid       UUID    NOT NULL UNIQUE,
  service_id INT4    NOT NULL REFERENCES ap_service (id),
  tags       JSONB   NOT NULL DEFAULT '{}'::JSONB
);

CREATE TABLE ap_method (
  id   SERIAL4 NOT NULL PRIMARY KEY,
  name TEXT    NOT NULL UNIQUE
);

CREATE TABLE ap_stack (
  -- stack id (hash based on methods)
  id      INT8 NOT NULL PRIMARY KEY,

  -- method frames as an array of method(id).
  methods JSON NOT NULL
);

CREATE TYPE ap_sample_item AS (
  -- the stack id that was observed
  stack_id INT8,

  -- duration of this stack sample in millis
  duration INT4
);

CREATE TABLE ap_sample (
  -- Timeslot of this sample in seconds since the epoch.
  -- The timestamp of the original event is truncated to the nearest
  -- time slot, which might be a large value like 60 seconds.
  timeslot    INT4 NOT NULL,

  -- the instance that send this sample
  instance_id INT4 NOT NULL REFERENCES ap_instance (id),

  -- version used for optimistic locking
  version     INT4 NOT NULL,

  -- the items of this sample. They should be normalized, so (item).stack_id
  -- should be unique.
  items       ap_sample_item[],

  UNIQUE (timeslot, instance_id)
);

-- function that returns all instance ids for a given service name.
CREATE OR REPLACE FUNCTION ap_instances_of(TEXT)
RETURNS INT4[] AS $$
  SELECT array_agg(id)
  FROM ap_instance
  WHERE service_id = (SELECT id FROM ap_service WHERE name = $1)
$$
LANGUAGE SQL;

