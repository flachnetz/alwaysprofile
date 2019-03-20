-- +migrate Up

CREATE TABLE service (
  id   SERIAL4 NOT NULL PRIMARY KEY,
  name TEXT    NOT NULL UNIQUE
);

CREATE TABLE instance (
  id         SERIAL4 NOT NULL PRIMARY KEY,
  uuid       UUID    NOT NULL UNIQUE,
  service_id INT4    NOT NULL REFERENCES service (id),
  tags       JSONB   NOT NULL DEFAULT '{}'::JSONB
);

CREATE TABLE method (
  id   SERIAL4 NOT NULL PRIMARY KEY,
  name TEXT    NOT NULL UNIQUE
);

CREATE TABLE stack (
  -- stack id (hash based on methods)
  id      INT8 NOT NULL PRIMARY KEY,

  -- method frames as an array of method(id).
  methods JSON NOT NULL
);

CREATE TYPE sample_item AS (
  -- the stack id that was observed
  stack_id INT8,

  -- duration of this stack sample in millis
  duration INT4
);

CREATE TABLE sample (
  -- Timeslot of this sample in seconds since the epoch.
  -- The timestamp of the original event is truncated to the nearest
  -- time slot, which might be a large value like 60 seconds.
  timeslot    INT4 NOT NULL,

  -- the instance that send this sample
  instance_id INT4 NOT NULL REFERENCES instance (id),

  -- version used for optimistic locking
  version     INT4 NOT NULL,

  -- the items of this sample. They should be normalized, so (item).stack_id
  -- should be unique.
  items       sample_item[],

  UNIQUE (timeslot, instance_id)
);


INSERT INTO service (name)
VALUES ('demo');


