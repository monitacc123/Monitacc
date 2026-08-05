/*
  # Create AI Usage Tracking Table

  1. New Tables
    - `ai_usage`
      - `id` (bigserial, primary key)
      - `user_id` (uuid, references users)
      - `tokens_used` (integer) - number of tokens used in this operation
      - `operation` (text) - type of AI operation: 'scan', 'bank_statement', 'analysis', 'insights'
      - `created_at` (timestamptz) - when the operation happened

  2. Security
    - Enable RLS on `ai_usage` table
    - Users can only view their own usage
    - Admins can view all usage via service role

  3. Notes
    - This table tracks every AI operation for billing/monitoring purposes
    - Used by admin dashboard to show token usage statistics
*/

CREATE TABLE IF NOT EXISTS ai_usage (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  tokens_used integer DEFAULT 0,
  operation text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_user_id ON ai_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created_at ON ai_usage(created_at);

ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ai usage"
  ON ai_usage FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ai usage"
  ON ai_usage FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
