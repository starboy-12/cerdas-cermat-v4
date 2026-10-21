BEGIN;

CREATE TABLE IF NOT EXISTS application_state (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  payload jsonb NOT NULL,
  revision bigint NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS curriculum (
  id text PRIMARY KEY,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  source jsonb NOT NULL DEFAULT '[]'::jsonb,
  reviewer text,
  reviewed_at timestamptz,
  publication_status text NOT NULL DEFAULT 'draft' CHECK (publication_status IN ('draft','in_review','approved','rejected','published','archived'))
);
CREATE TABLE IF NOT EXISTS education_level (
  id text PRIMARY KEY,
  label text NOT NULL,
  display_order integer NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS learning_phase (
  id text NOT NULL,
  level_id text NOT NULL REFERENCES education_level(id) ON DELETE CASCADE,
  label text NOT NULL,
  PRIMARY KEY (level_id, id)
);
CREATE TABLE IF NOT EXISTS subject (
  id text PRIMARY KEY,
  name text NOT NULL,
  family text NOT NULL,
  availability text NOT NULL DEFAULT 'required'
);
CREATE TABLE IF NOT EXISTS learning_topic (
  id text NOT NULL,
  level_id text NOT NULL,
  phase_id text NOT NULL,
  curriculum_id text NOT NULL REFERENCES curriculum(id),
  subject_id text NOT NULL REFERENCES subject(id),
  title text NOT NULL,
  objective text NOT NULL,
  quiz_id text,
  source jsonb NOT NULL DEFAULT '[]'::jsonb,
  reviewer text,
  reviewed_at timestamptz,
  publication_status text NOT NULL DEFAULT 'draft' CHECK (publication_status IN ('draft','in_review','approved','rejected','published','archived')),
  PRIMARY KEY (id, level_id, phase_id, curriculum_id),
  FOREIGN KEY (level_id, phase_id) REFERENCES learning_phase(level_id, id)
);

CREATE TABLE IF NOT EXISTS account (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('student','teacher','reviewer','admin')),
  password_hash text,
  password_salt text,
  google_subject text,
  created_at timestamptz NOT NULL DEFAULT now(),
  disabled_at timestamptz
);
ALTER TABLE account ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE account ALTER COLUMN password_salt DROP NOT NULL;
ALTER TABLE account ADD COLUMN IF NOT EXISTS google_subject text;
CREATE UNIQUE INDEX IF NOT EXISTS account_google_subject_unique ON account (google_subject) WHERE google_subject IS NOT NULL;
CREATE TABLE IF NOT EXISTS learning_identity (
  student_id text PRIMARY KEY,
  account_id text UNIQUE REFERENCES account(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE TABLE IF NOT EXISTS learning_class (
  id text PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS class_teacher (
  class_id text NOT NULL REFERENCES learning_class(id) ON DELETE CASCADE,
  teacher_id text NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  PRIMARY KEY (class_id, teacher_id)
);
CREATE TABLE IF NOT EXISTS class_student (
  class_id text NOT NULL REFERENCES learning_class(id) ON DELETE CASCADE,
  student_id text NOT NULL REFERENCES learning_identity(student_id) ON DELETE CASCADE,
  PRIMARY KEY (class_id, student_id)
);

CREATE TABLE IF NOT EXISTS content_document (
  id text PRIMARY KEY,
  schema_version integer NOT NULL CHECK (schema_version > 0),
  content_type text NOT NULL CHECK (content_type IN ('material','quiz','local-subject','lesson')),
  title text NOT NULL,
  curriculum_id text REFERENCES curriculum(id),
  level_id text REFERENCES education_level(id),
  phase_id text,
  subject_id text REFERENCES subject(id),
  topic_id text,
  publication_status text NOT NULL DEFAULT 'draft' CHECK (publication_status IN ('draft','in_review','approved','rejected','published','archived')),
  source jsonb NOT NULL DEFAULT '[]'::jsonb,
  reviewer text,
  reviewed_at timestamptz,
  payload jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 1,
  created_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS content_version (
  content_id text NOT NULL REFERENCES content_document(id) ON DELETE CASCADE,
  revision integer NOT NULL,
  actor text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  snapshot jsonb NOT NULL,
  PRIMARY KEY (content_id, revision)
);
CREATE TABLE IF NOT EXISTS reviewer_comment (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  content_id text NOT NULL REFERENCES content_document(id) ON DELETE CASCADE,
  revision integer,
  actor text NOT NULL,
  comment text NOT NULL CHECK (length(comment) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS quiz_package (
  id text PRIMARY KEY,
  level_id text NOT NULL,
  phase_id text NOT NULL,
  curriculum_id text NOT NULL REFERENCES curriculum(id),
  subject_id text NOT NULL REFERENCES subject(id),
  title text NOT NULL,
  publication_status text NOT NULL DEFAULT 'draft' CHECK (publication_status IN ('draft','in_review','approved','rejected','published','archived')),
  source jsonb NOT NULL DEFAULT '[]'::jsonb,
  reviewer text,
  reviewed_at timestamptz,
  FOREIGN KEY (level_id, phase_id) REFERENCES learning_phase(level_id, id)
);
ALTER TABLE learning_topic DROP CONSTRAINT IF EXISTS learning_topic_quiz_fk;
ALTER TABLE learning_topic ADD CONSTRAINT learning_topic_quiz_fk FOREIGN KEY (quiz_id) REFERENCES quiz_package(id) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE IF NOT EXISTS quiz_question (
  id text PRIMARY KEY,
  quiz_id text NOT NULL REFERENCES quiz_package(id) ON DELETE CASCADE,
  ordinal integer NOT NULL CHECK (ordinal > 0),
  prompt text NOT NULL,
  choices jsonb NOT NULL CHECK (jsonb_typeof(choices) = 'array' AND jsonb_array_length(choices) BETWEEN 2 AND 6),
  answer_index integer NOT NULL CHECK (answer_index >= 0),
  difficulty text NOT NULL CHECK (difficulty IN ('mudah','sedang','sulit')),
  explanation text NOT NULL,
  objective_id text,
  source jsonb NOT NULL DEFAULT '[]'::jsonb,
  publication_status text NOT NULL DEFAULT 'draft' CHECK (publication_status IN ('draft','in_review','approved','rejected','published','archived')),
  UNIQUE (quiz_id, ordinal),
  CHECK (answer_index < jsonb_array_length(choices))
);
CREATE TABLE IF NOT EXISTS quiz_attempt (
  id text PRIMARY KEY,
  student_id text NOT NULL REFERENCES learning_identity(student_id) ON DELETE CASCADE,
  quiz_id text REFERENCES quiz_package(id),
  package_key text NOT NULL,
  status text NOT NULL CHECK (status IN ('started','completed','abandoned')),
  score integer CHECK (score BETWEEN 0 AND 100),
  correct_count integer,
  question_count integer,
  started_at timestamptz,
  completed_at timestamptz,
  CHECK ((status = 'completed' AND score IS NOT NULL AND completed_at IS NOT NULL) OR status <> 'completed')
);
CREATE INDEX IF NOT EXISTS quiz_attempt_student_completed_idx ON quiz_attempt(student_id, completed_at DESC);
CREATE TABLE IF NOT EXISTS quiz_attempt_answer (
  attempt_id text NOT NULL REFERENCES quiz_attempt(id) ON DELETE CASCADE,
  question_id text NOT NULL,
  choice_index integer NOT NULL CHECK (choice_index BETWEEN 0 AND 5),
  is_correct boolean,
  explanation text,
  answered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (attempt_id, question_id)
);
CREATE TABLE IF NOT EXISTS progress_state (
  student_id text NOT NULL REFERENCES learning_identity(student_id) ON DELETE CASCADE,
  package_key text NOT NULL,
  current_page integer NOT NULL DEFAULT 0 CHECK (current_page >= 0),
  active_attempt_id text REFERENCES quiz_attempt(id) ON DELETE SET NULL,
  answer_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, package_key)
);
CREATE TABLE IF NOT EXISTS reading_progress (
  student_id text NOT NULL REFERENCES learning_identity(student_id) ON DELETE CASCADE,
  content_key text NOT NULL,
  current_page integer NOT NULL DEFAULT 0 CHECK (current_page >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, content_key)
);
CREATE TABLE IF NOT EXISTS school_content_selection (
  school_id text NOT NULL,
  content_id text NOT NULL REFERENCES content_document(id),
  enabled boolean NOT NULL DEFAULT true,
  configured_by text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (school_id, content_id)
);
CREATE TABLE IF NOT EXISTS media_asset (
  id text PRIMARY KEY,
  uri text NOT NULL,
  alt_text text NOT NULL,
  license_name text NOT NULL,
  license_uri text,
  creator text,
  source_uri text NOT NULL,
  reviewer text,
  reviewed_at timestamptz,
  publication_status text NOT NULL DEFAULT 'draft'
);
CREATE TABLE IF NOT EXISTS legacy_import (
  id text PRIMARY KEY,
  imported_at timestamptz NOT NULL DEFAULT now(),
  source_file text NOT NULL,
  manifest jsonb NOT NULL
);

COMMIT;
