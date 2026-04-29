-- Task Status Transition Tests
--
-- Run against a local Supabase instance:
--   supabase start
--   psql $DATABASE_URL -f supabase/tests/task_status_transitions.sql
--
-- Each test calls a helper that temporarily impersonates a user via
-- SET LOCAL role + SET LOCAL request.jwt.claims, then attempts a
-- status transition and checks whether it succeeded or raised an exception.
--
-- Exit code 0 = all tests passed.

BEGIN;

-- ── Test helpers ──────────────────────────────────────────────────────────────

CREATE TEMP TABLE _test_results (
  test_name TEXT,
  passed    BOOLEAN,
  message   TEXT
);

-- Run a block as a specific user (impersonates auth.uid() via JWT claims).
-- expected_to_fail=TRUE means we expect an exception; FALSE means success expected.
CREATE OR REPLACE FUNCTION _run_test(
  test_name       TEXT,
  user_id         UUID,
  task_id         UUID,
  new_status      TEXT,
  expected_to_fail BOOLEAN,
  on_hold_reason  TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_passed BOOLEAN := FALSE;
  v_message TEXT := '';
BEGIN
  BEGIN
    -- Impersonate user
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', user_id::TEXT)::TEXT, TRUE);

    IF on_hold_reason IS NOT NULL THEN
      UPDATE tasks SET status = new_status::task_status, on_hold_reason = on_hold_reason
      WHERE id = task_id;
    ELSE
      UPDATE tasks SET status = new_status::task_status
      WHERE id = task_id;
    END IF;

    IF expected_to_fail THEN
      v_passed := FALSE;
      v_message := 'Expected exception but got success for transition to ' || new_status;
    ELSE
      v_passed := TRUE;
      v_message := 'OK';
    END IF;

  EXCEPTION WHEN OTHERS THEN
    IF expected_to_fail THEN
      v_passed := TRUE;
      v_message := 'Correctly rejected: ' || SQLERRM;
    ELSE
      v_passed := FALSE;
      v_message := 'Unexpected error: ' || SQLERRM;
    END IF;
  END;

  -- Reset status back to original for next test
  -- (bypass trigger with service-role context — no auth.uid)
  PERFORM set_config('request.jwt.claims', '{}', TRUE);

  INSERT INTO _test_results VALUES (test_name, v_passed, v_message);
END;
$$ LANGUAGE plpgsql;


-- ── Fixture setup ─────────────────────────────────────────────────────────────

-- Users
INSERT INTO users (id, name, email, level, is_admin) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Creator',  'creator@test.com',  2, FALSE),
  ('00000000-0000-0000-0000-000000000002', 'Assignee', 'assignee@test.com', 3, FALSE),
  ('00000000-0000-0000-0000-000000000003', 'Other',    'other@test.com',    3, FALSE),
  ('00000000-0000-0000-0000-000000000004', 'Admin',    'admin@test.com',    1, TRUE)
ON CONFLICT (id) DO NOTHING;

-- Task: pending, creator=001, assignee=002
INSERT INTO tasks (id, title, status, assigned_by, priority, visibility) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Test task', 'pending', '00000000-0000-0000-0000-000000000001', 'medium', 'hierarchy_same')
ON CONFLICT (id) DO UPDATE SET status = 'pending', on_hold_reason = NULL;

INSERT INTO task_assignees (task_id, user_id) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002')
ON CONFLICT DO NOTHING;


-- ── Helper: reset task to a given status (bypasses trigger) ───────────────────

CREATE OR REPLACE FUNCTION _reset_task(new_status TEXT, reason TEXT DEFAULT NULL) RETURNS VOID AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{}', TRUE);
  UPDATE tasks
  SET status = new_status::task_status,
      on_hold_reason = reason
  WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001';
END;
$$ LANGUAGE plpgsql;


-- ── Tests: pending → in_progress ─────────────────────────────────────────────

SELECT _reset_task('pending');
SELECT _run_test(
  'assignee can start task (pending → in_progress)',
  '00000000-0000-0000-0000-000000000002',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'in_progress', FALSE
);

SELECT _reset_task('pending');
SELECT _run_test(
  'non-assignee cannot start task',
  '00000000-0000-0000-0000-000000000003',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'in_progress', TRUE
);

SELECT _reset_task('pending');
SELECT _run_test(
  'creator cannot start task (not an assignee)',
  '00000000-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'in_progress', TRUE
);


-- ── Tests: in_progress → on_hold ─────────────────────────────────────────────

SELECT _reset_task('in_progress');
SELECT _run_test(
  'assignee can pause task with reason',
  '00000000-0000-0000-0000-000000000002',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'on_hold', FALSE,
  'Blocked by dep'
);

SELECT _reset_task('in_progress');
SELECT _run_test(
  'assignee cannot pause without on_hold_reason',
  '00000000-0000-0000-0000-000000000002',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'on_hold', TRUE
);

SELECT _reset_task('in_progress');
SELECT _run_test(
  'creator cannot pause task',
  '00000000-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'on_hold', TRUE,
  'reason'
);


-- ── Tests: in_progress → completed ───────────────────────────────────────────

SELECT _reset_task('in_progress');
SELECT _run_test(
  'assignee can mark task as done (in_progress → completed)',
  '00000000-0000-0000-0000-000000000002',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'completed', FALSE
);

SELECT _reset_task('in_progress');
SELECT _run_test(
  'creator cannot mark task as done (not assignee)',
  '00000000-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'completed', TRUE
);


-- ── Tests: completed → archived (creator accepts) ────────────────────────────

SELECT _reset_task('completed');
SELECT _run_test(
  'creator can accept completed task (completed → archived)',
  '00000000-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'archived', FALSE
);

SELECT _reset_task('completed');
SELECT _run_test(
  'assignee cannot accept their own completion',
  '00000000-0000-0000-0000-000000000002',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'archived', TRUE
);


-- ── Tests: completed → in_progress (creator requests changes) ────────────────

SELECT _reset_task('completed');
SELECT _run_test(
  'creator can request changes (completed → in_progress)',
  '00000000-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'in_progress', FALSE
);

SELECT _reset_task('completed');
SELECT _run_test(
  'assignee cannot request changes on their own task',
  '00000000-0000-0000-0000-000000000002',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'in_progress', TRUE
);


-- ── Tests: on_hold → in_progress ─────────────────────────────────────────────

SELECT _reset_task('on_hold', 'was blocked');
SELECT _run_test(
  'assignee can resume from on_hold',
  '00000000-0000-0000-0000-000000000002',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'in_progress', FALSE
);

SELECT _reset_task('on_hold', 'was blocked');
SELECT _run_test(
  'creator cannot resume from on_hold',
  '00000000-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'in_progress', TRUE
);

-- Verify on_hold_reason is cleared after resume
DO $$
DECLARE v_reason TEXT;
BEGIN
  SELECT on_hold_reason INTO v_reason
  FROM tasks WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001';
  IF v_reason IS NOT NULL THEN
    INSERT INTO _test_results VALUES
      ('on_hold_reason cleared after resume', FALSE, 'reason was: ' || v_reason);
  ELSE
    INSERT INTO _test_results VALUES
      ('on_hold_reason cleared after resume', TRUE, 'OK');
  END IF;
END $$;


-- ── Tests: archived → in_progress (reopen) ───────────────────────────────────

SELECT _reset_task('archived');
SELECT _run_test(
  'creator can reopen archived task',
  '00000000-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'in_progress', FALSE
);

SELECT _reset_task('archived');
SELECT _run_test(
  'assignee cannot reopen archived task',
  '00000000-0000-0000-0000-000000000002',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'in_progress', TRUE
);


-- ── Tests: invalid transitions ────────────────────────────────────────────────

SELECT _reset_task('pending');
SELECT _run_test(
  'pending → archived is rejected',
  '00000000-0000-0000-0000-000000000002',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'archived', TRUE
);

SELECT _reset_task('pending');
SELECT _run_test(
  'pending → completed is rejected',
  '00000000-0000-0000-0000-000000000002',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'completed', TRUE
);

SELECT _reset_task('on_hold', 'reason');
SELECT _run_test(
  'on_hold → archived is rejected',
  '00000000-0000-0000-0000-000000000002',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'archived', TRUE
);


-- ── Tests: admin bypasses all rules ──────────────────────────────────────────

SELECT _reset_task('pending');
SELECT _run_test(
  'admin can make any transition (pending → archived)',
  '00000000-0000-0000-0000-000000000004',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'archived', FALSE
);


-- ── Tests: in_progress → archived (legacy direct complete by creator) ─────────

SELECT _reset_task('in_progress');
SELECT _run_test(
  'creator can directly archive in_progress task (legacy)',
  '00000000-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'archived', FALSE
);

SELECT _reset_task('in_progress');
SELECT _run_test(
  'assignee cannot directly archive in_progress task',
  '00000000-0000-0000-0000-000000000002',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'archived', TRUE
);


-- ── Results ───────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_total   INTEGER;
  v_passed  INTEGER;
  v_failed  INTEGER;
  r         RECORD;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE passed), COUNT(*) FILTER (WHERE NOT passed)
  INTO v_total, v_passed, v_failed
  FROM _test_results;

  RAISE NOTICE '';
  RAISE NOTICE '══════════════════════════════════════════════';
  RAISE NOTICE 'Task Status Transition Tests: % / % passed', v_passed, v_total;
  RAISE NOTICE '══════════════════════════════════════════════';

  FOR r IN SELECT * FROM _test_results ORDER BY passed, test_name LOOP
    IF r.passed THEN
      RAISE NOTICE '  ✓  %', r.test_name;
    ELSE
      RAISE NOTICE '  ✗  % — %', r.test_name, r.message;
    END IF;
  END LOOP;

  RAISE NOTICE '';

  IF v_failed > 0 THEN
    RAISE EXCEPTION '% test(s) failed', v_failed;
  END IF;
END $$;

ROLLBACK; -- Clean up all test fixtures
